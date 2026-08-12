import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { GenerateInvoiceDto } from './dto/generate-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { Prisma, InvoiceStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a draft invoice for a client for a billing period.
   * Auto-populates line items from active assignments during that period.
   */
  async generate(tenantId: string, dto: GenerateInvoiceDto, userId?: string) {
    const { clientId, year, month } = dto;

    // Validate client
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    // Check for duplicate invoice (same client + period)
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0); // last day of month
    const existing = await this.prisma.invoice.findFirst({
      where: {
        tenantId,
        clientId,
        periodStart,
        periodEnd,
        status: { not: 'CANCELLED' },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Invoice already exists for ${this.monthName(month)} ${year} (${existing.invoiceNumber}). Cancel it first to regenerate.`,
      );
    }

    // Get active assignments for this client during the period
    const assignments = await this.prisma.employeeAssignment.findMany({
      where: {
        tenantId,
        clientId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        startDate: { lte: periodEnd },
        OR: [
          { endDate: null },
          { endDate: { gte: periodStart } },
        ],
      },
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    if (assignments.length === 0) {
      throw new BadRequestException(
        `No active assignments found for this client in ${this.monthName(month)} ${year}.`,
      );
    }

    // Build line items
    const lineItems: Prisma.InvoiceLineItemCreateWithoutInvoiceInput[] = assignments.map(
      (a, idx) => {
        const qty = a.billingCycle === 'MONTHLY' ? new Prisma.Decimal(1) : new Prisma.Decimal(160); // default 160h/month for hourly
        const amount = qty.mul(a.billingRate);

        return {
          assignment: { connect: { id: a.id } },
          description: `${a.employee.firstName} ${a.employee.lastName} — ${a.role ?? 'Staff'} (${this.monthName(month)} ${year})`,
          quantity: qty,
          rate: a.billingRate,
          amount,
          sortOrder: idx,
        };
      },
    );

    // Calculate totals
    const subtotal = lineItems.reduce(
      (sum, li) => sum.add(li.amount as Prisma.Decimal),
      new Prisma.Decimal(0),
    );
    const taxPercent = new Prisma.Decimal(dto.taxPercent ?? 0);
    const taxAmount = subtotal.mul(taxPercent).div(100);
    const total = subtotal.add(taxAmount);

    // Invoice date & due date
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const dueDays = dto.dueDays ?? 15;
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + dueDays);

    // Generate invoice number in the client's entity series (FY from invoice date)
    const entity = await this.entityForClient(tenantId, clientId);
    const invoiceNumber = await this.nextInvoiceNumber(tenantId, invoiceDate, entity?.invoicePrefix);

    return this.prisma.invoice.create({
      data: {
        tenantId,
        clientId,
        billingEntityId: entity?.id,
        invoiceNumber,
        invoiceDate,
        dueDate,
        periodStart,
        periodEnd,
        subtotal,
        taxPercent,
        taxAmount,
        total,
        currency: client.currency,
        status: 'DRAFT',
        notes: dto.notes,
        paymentTerms: `Net ${dueDays}`,
        createdBy: userId,
        updatedBy: userId,
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        client: { select: { id: true, name: true, currency: true, country: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { lineItems: true } },
      },
    });
  }

  /**
   * Advance billing period for an employee, anchored on their BILLING DAY
   * (= assignment start-date day-of-month). periodStart = next occurrence of the
   * billing day on/after the raise date; the cycle runs one month (billingDay →
   * day before next billingDay). e.g. start 13th, raise June → "13th Jun–12th Jul'26".
   */
  private advancePeriod(raiseDate: Date, startDate: Date): { periodStart: Date; periodEnd: Date } {
    const billingDay = startDate.getDate();
    const baseMonth = raiseDate.getDate() <= billingDay ? raiseDate.getMonth() : raiseDate.getMonth() + 1;
    const psLastDay = new Date(raiseDate.getFullYear(), baseMonth + 1, 0).getDate(); // clamp 31→28/30
    const periodStart = new Date(raiseDate.getFullYear(), baseMonth, Math.min(billingDay, psLastDay));
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(periodEnd.getDate() - 1);
    return { periodStart, periodEnd };
  }

  /** Add n whole months to a date, preserving day-of-month (clamped 31→28/30). */
  private addMonths(d: Date, n: number): Date {
    const day = d.getDate();
    const res = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const lastDay = new Date(res.getFullYear(), res.getMonth() + 1, 0).getDate();
    res.setDate(Math.min(day, lastDay));
    return res;
  }

  /**
   * Clone an existing invoice into a new DRAFT.
   * - New auto-incremented invoice number; new invoice date (defaults to today).
   * - Period: 'same' copies verbatim; 'this'/'next' shift to the invoice-date month
   *   (or the following one). Assignment-linked line labels are regenerated to match;
   *   manual line descriptions are copied verbatim.
   * - Amounts/qty/rate per line are preserved (manual edits survive). Payment state cleared.
   */
  async duplicate(
    tenantId: string,
    id: string,
    dto: { invoiceDate?: string; periodMonth?: 'same' | 'this' | 'next' },
    userId?: string,
  ) {
    const orig = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          include: {
            assignment: {
              select: {
                id: true,
                role: true,
                startDate: true,
                employee: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    if (!orig) throw new NotFoundException(`Invoice #${id} not found`);

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const periodMonth = dto.periodMonth ?? 'next';

    // How many whole months to move the original period by.
    let monthShift = 0;
    if (periodMonth !== 'same') {
      const targetMonthOffset = periodMonth === 'next' ? 1 : 0;
      const target = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + targetMonthOffset, 1);
      monthShift =
        (target.getFullYear() - orig.periodStart.getFullYear()) * 12 +
        (target.getMonth() - orig.periodStart.getMonth());
    }

    const periodStart = monthShift === 0 ? orig.periodStart : this.addMonths(orig.periodStart, monthShift);
    const periodEnd = monthShift === 0 ? orig.periodEnd : this.addMonths(orig.periodEnd, monthShift);

    const lineItems: Prisma.InvoiceLineItemCreateWithoutInvoiceInput[] = orig.lineItems.map((li) => {
      let description = li.description;
      // Regenerate the period label only for assignment-linked lines when shifting months.
      if (monthShift !== 0 && li.assignment) {
        const origP = this.advancePeriod(orig.invoiceDate, li.assignment.startDate);
        const ns = this.addMonths(origP.periodStart, monthShift);
        const ne = this.addMonths(origP.periodEnd, monthShift);
        const emp = li.assignment.employee;
        description = `Monthly service fee for ${emp.firstName} ${emp.lastName} — ${li.assignment.role ?? 'Staff'} (${this.periodLabel(ns, ne)})`;
      }
      return {
        ...(li.assignmentId ? { assignment: { connect: { id: li.assignmentId } } } : {}),
        description,
        quantity: li.quantity,
        rate: li.rate,
        amount: li.amount,
        sortOrder: li.sortOrder,
      };
    });

    const subtotal = lineItems.reduce(
      (sum, li) => sum.add(li.amount as Prisma.Decimal),
      new Prisma.Decimal(0),
    );
    const taxPercent = orig.taxPercent;
    const taxAmount = subtotal.mul(taxPercent).div(100);
    const total = subtotal.add(taxAmount);

    // Preserve the original invoice→due gap (handles "Net N" and "Due on Receipt").
    const gapDays = Math.round(
      (orig.dueDate.getTime() - orig.invoiceDate.getTime()) / 86_400_000,
    );
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + gapDays);

    // Keep the original invoice's issuing entity + its number series.
    const dupEntity = orig.billingEntityId
      ? await this.prisma.billingEntity.findUnique({ where: { id: orig.billingEntityId } })
      : await this.defaultEntity(tenantId);
    const invoiceNumber = await this.nextInvoiceNumber(tenantId, invoiceDate, dupEntity?.invoicePrefix);

    return this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: orig.clientId,
        billingEntityId: dupEntity?.id,
        invoiceNumber,
        invoiceDate,
        dueDate,
        periodStart,
        periodEnd,
        subtotal,
        taxPercent,
        taxAmount,
        total,
        currency: orig.currency,
        status: 'DRAFT',
        notes: orig.notes,
        paymentTerms: orig.paymentTerms,
        payoneerLink: orig.payoneerLink,
        createdBy: userId,
        updatedBy: userId,
        lineItems: { create: lineItems },
      },
      include: {
        client: { select: { id: true, name: true, currency: true, country: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { lineItems: true } },
      },
    });
  }

  /**
   * Generate ONE advance invoice for one OR MORE employees (assignments) of the
   * SAME client.
   * - Raised on the given date (or today); payable on receipt (terms "Due on Receipt").
   * - One line item per employee, each covering that employee's own upcoming month
   *   (advance billing, anchored on their billing day).
   * - Invoice-level period spans the earliest start → latest end across the lines.
   */
  async generateForAssignment(
    tenantId: string,
    dto: { assignmentId?: string; assignmentIds?: string[]; invoiceDate?: string; taxPercent?: number; notes?: string },
    userId?: string,
  ) {
    // Merge legacy single id + the multi-select array, de-duped, order preserved.
    const ids = [...new Set([...(dto.assignmentIds ?? []), ...(dto.assignmentId ? [dto.assignmentId] : [])])];
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one employee to invoice.');
    }

    const assignments = await this.prisma.employeeAssignment.findMany({
      where: { id: { in: ids }, tenantId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        client: { select: { id: true, name: true, currency: true, deletedAt: true } },
      },
    });
    if (assignments.length !== ids.length) {
      throw new NotFoundException('One or more selected employees were not found.');
    }

    // All selected employees must belong to the SAME client (one invoice → one client).
    const clientIds = new Set(assignments.map((a) => a.clientId));
    if (clientIds.size > 1) {
      throw new BadRequestException('All selected employees must belong to the same client.');
    }
    const client = assignments[0].client;
    if (client.deletedAt) throw new BadRequestException('Client is archived');

    const raiseDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const invoiceDate = raiseDate;

    const lineItems: Prisma.InvoiceLineItemCreateWithoutInvoiceInput[] = [];
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      if (a.status === 'CANCELLED') {
        throw new BadRequestException(
          `Cannot invoice a cancelled assignment (${a.employee.firstName} ${a.employee.lastName}).`,
        );
      }

      const { periodStart, periodEnd } = this.advancePeriod(raiseDate, a.startDate);
      const periodLabel = this.periodLabel(periodStart, periodEnd);

      // Prevent a duplicate advance invoice for the same assignment + period start.
      const dup = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          clientId: a.clientId,
          periodStart,
          status: { not: 'CANCELLED' },
          lineItems: { some: { assignmentId: a.id } },
        },
        select: { invoiceNumber: true },
      });
      if (dup) {
        throw new ConflictException(
          `Advance invoice already exists for ${a.employee.firstName} from ${this.fmtDate(periodStart)} (${dup.invoiceNumber}).`,
        );
      }

      if (!minStart || periodStart < minStart) minStart = periodStart;
      if (!maxEnd || periodEnd > maxEnd) maxEnd = periodEnd;

      const qty = a.billingCycle === 'MONTHLY' ? new Prisma.Decimal(1) : new Prisma.Decimal(160);
      const amount = qty.mul(a.billingRate);
      lineItems.push({
        assignment: { connect: { id: a.id } },
        description: `Monthly service fee for ${a.employee.firstName} ${a.employee.lastName} — ${a.role ?? 'Staff'} (${periodLabel})`,
        quantity: qty,
        rate: a.billingRate,
        amount,
        sortOrder: i,
      });
    }

    const subtotal = lineItems.reduce(
      (sum, li) => sum.add(li.amount as Prisma.Decimal),
      new Prisma.Decimal(0),
    );
    const taxPercent = new Prisma.Decimal(dto.taxPercent ?? 0);
    const taxAmount = subtotal.mul(taxPercent).div(100);
    const total = subtotal.add(taxAmount);

    const advEntity = await this.entityForClient(tenantId, client.id);
    const invoiceNumber = await this.nextInvoiceNumber(tenantId, invoiceDate, advEntity?.invoicePrefix);

    return this.prisma.invoice.create({
      data: {
        tenantId,
        clientId: client.id,
        billingEntityId: advEntity?.id,
        invoiceNumber,
        invoiceDate,
        dueDate: invoiceDate, // advance — due on receipt
        periodStart: minStart!,
        periodEnd: maxEnd!,
        subtotal,
        taxPercent,
        taxAmount,
        total,
        currency: client.currency,
        status: 'DRAFT',
        notes: dto.notes,
        paymentTerms: 'Due on Receipt',
        createdBy: userId,
        updatedBy: userId,
        lineItems: {
          create: lineItems,
        },
      },
      include: {
        client: { select: { id: true, name: true, currency: true, country: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { lineItems: true } },
      },
    });
  }

  private fmtDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Ordinal day, e.g. 1→"1st", 13→"13th", 22→"22nd". */
  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  /** Billing-period label like "13th Jul-12th Aug'26", or "1st-31st Jul'26" within one month. */
  private periodLabel(start: Date, end: Date): string {
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yy = String(end.getFullYear()).slice(2);
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${this.ordinal(start.getDate())}-${this.ordinal(end.getDate())} ${M[end.getMonth()]}'${yy}`;
    }
    return `${this.ordinal(start.getDate())} ${M[start.getMonth()]}-${this.ordinal(end.getDate())} ${M[end.getMonth()]}'${yy}`;
  }

  /** Resolve an assignment's clientId for access checks (throws if not found). */
  async getAssignmentClientId(tenantId: string, assignmentId: string): Promise<string> {
    const a = await this.prisma.employeeAssignment.findFirst({
      where: { id: assignmentId, tenantId },
      select: { clientId: true },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return a.clientId;
  }

  /**
   * Resolve the (single) clientId shared by a set of assignments, for access checks.
   * Throws if any is missing or they span more than one client.
   */
  async getAssignmentsClientId(tenantId: string, assignmentIds: string[]): Promise<string> {
    const ids = [...new Set(assignmentIds)];
    if (ids.length === 0) throw new BadRequestException('Select at least one employee to invoice.');
    const rows = await this.prisma.employeeAssignment.findMany({
      where: { id: { in: ids }, tenantId },
      select: { clientId: true },
    });
    if (rows.length !== ids.length) throw new NotFoundException('One or more selected employees were not found.');
    const clientIds = new Set(rows.map((r) => r.clientId));
    if (clientIds.size > 1) throw new BadRequestException('All selected employees must belong to the same client.');
    return rows[0].clientId;
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      clientId?: string;
      status?: InvoiceStatus;
      year?: number;
    },
  ) {
    const { page = 1, limit = 20, clientId, status, year } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      ...(clientId && { clientId }),
      ...(status && { status }),
      ...(year && {
        invoiceDate: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { invoiceDate: 'desc' },
        include: {
          client: { select: { id: true, name: true, country: true, currency: true } },
          _count: { select: { lineItems: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        client: true,
        billingEntity: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
          include: {
            assignment: {
              select: {
                id: true,
                employee: {
                  select: { id: true, firstName: true, lastName: true, employeeCode: true },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice #${id} not found`);
    return invoice;
  }

  async update(tenantId: string, id: string, dto: UpdateInvoiceDto, userId?: string) {
    const invoice = await this.findOne(tenantId, id);

    if (invoice.status === 'PAID') {
      throw new ConflictException('Cannot modify a paid invoice.');
    }

    const data: any = { ...dto, updatedBy: userId };
    if (dto.invoiceDate) data.invoiceDate = new Date(dto.invoiceDate);
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.periodStart) data.periodStart = new Date(dto.periodStart);
    if (dto.periodEnd) data.periodEnd = new Date(dto.periodEnd);

    // Switching the issuing entity: adopt its invoice-number series so the LLP
    // gets its own sequence. Renumber using the (possibly new) invoice date's FY.
    if (dto.billingEntityId !== undefined && dto.billingEntityId !== (invoice as any).billingEntityId) {
      if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
        throw new ConflictException(`Cannot change the entity of a ${invoice.status} invoice.`);
      }
      if (dto.billingEntityId) {
        const entity = await this.prisma.billingEntity.findFirst({ where: { id: dto.billingEntityId, tenantId } });
        if (!entity) throw new NotFoundException('Billing entity not found');
        const invDate = data.invoiceDate ?? invoice.invoiceDate;
        data.invoiceNumber = await this.nextInvoiceNumber(tenantId, invDate, entity.invoicePrefix);
      }
    }

    // Recalculate totals if tax changed
    if (dto.taxPercent !== undefined) {
      const taxPercent = new Prisma.Decimal(dto.taxPercent);
      const taxAmount = (invoice.subtotal as any).mul(taxPercent).div(100);
      const total = (invoice.subtotal as any).add(taxAmount);
      data.taxPercent = taxPercent;
      data.taxAmount = taxAmount;
      data.total = total;
    }

    return this.prisma.invoice.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        billingEntity: { select: { id: true, name: true, invoicePrefix: true } },
        _count: { select: { lineItems: true } },
      },
    });
  }

  async markSent(tenantId: string, id: string, userId?: string) {
    const invoice = await this.findOne(tenantId, id);
    if (invoice.status !== 'DRAFT') {
      throw new ConflictException(`Invoice is ${invoice.status}, can only send DRAFT invoices.`);
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT', updatedBy: userId },
    });
  }

  async markPaid(tenantId: string, id: string, dto: MarkPaidDto, userId?: string) {
    const invoice = await this.findOne(tenantId, id);
    if (invoice.status === 'PAID') {
      throw new ConflictException('Invoice is already paid.');
    }
    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      throw new ConflictException(`Cannot mark ${invoice.status} invoice as paid.`);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paidAmount: new Prisma.Decimal(dto.paidAmount),
        paymentRef: dto.paymentRef,
        updatedBy: userId,
      },
    });
  }

  async cancel(tenantId: string, id: string, userId?: string) {
    const invoice = await this.findOne(tenantId, id);
    if (invoice.status === 'PAID') {
      throw new ConflictException('Cannot cancel a paid invoice. Void it instead.');
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED', updatedBy: userId },
    });
  }

  /**
   * Hard-delete an invoice. Only DRAFT or CANCELLED invoices may be deleted —
   * SENT/OVERDUE/PAID must be cancelled/voided, never removed.
   * Line items + payments cascade via the schema's onDelete: Cascade.
   */
  async remove(tenantId: string, id: string) {
    const invoice = await this.findOne(tenantId, id);
    if (invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED') {
      throw new ConflictException(
        `Only DRAFT or CANCELLED invoices can be deleted (this one is ${invoice.status}). Cancel or void it instead.`,
      );
    }
    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true, id, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Dashboard stats — total invoiced, collected, outstanding.
   */
  async getStats(tenantId: string) {
    const now = new Date();
    const [draft, outstanding, paid, partial, overdue] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { tenantId, status: 'DRAFT' }, _sum: { total: true }, _count: true }),
      // Outstanding = issued but not (fully) paid — SENT, OVERDUE or PARTIALLY_PAID
      this.prisma.invoice.aggregate({
        where: { tenantId, status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({ where: { tenantId, status: 'PAID' }, _sum: { paidAmount: true, total: true }, _count: true }),
      this.prisma.invoice.aggregate({ where: { tenantId, status: 'PARTIALLY_PAID' }, _sum: { paidAmount: true }, _count: true }),
      // Overdue = explicitly OVERDUE, or SENT past its due date
      this.prisma.invoice.aggregate({
        where: { tenantId, OR: [{ status: 'OVERDUE' }, { status: 'SENT', dueDate: { lt: now } }] },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const collected = Number(paid._sum.paidAmount ?? 0) + Number(partial._sum.paidAmount ?? 0);
    return {
      draft: { count: draft._count, amount: draft._sum.total ?? 0 },
      sent: { count: outstanding._count, amount: outstanding._sum.total ?? 0 },
      // fall back to invoice total for legacy PAID rows whose paidAmount was never set
      paid: { count: paid._count, amount: collected || Number(paid._sum.total ?? 0) },
      overdue: { count: overdue._count, amount: overdue._sum.total ?? 0 },
    };
  }

  async getTenantInfo(tenantId: string) {
    const [tenant, settings] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, gstNumber: true, panNumber: true },
      }),
      this.prisma.tenantInvoiceSettings.findUnique({
        where: { tenantId },
        select: { paymentInstructions: true },
      }),
    ]);
    return tenant ? { ...tenant, paymentInstructions: settings?.paymentInstructions ?? null } : tenant;
  }

  /**
   * The company details to print on an invoice — the invoice's billing entity
   * if set, otherwise the tenant record + tenant-level payment instructions.
   */
  async getIssuerInfo(tenantId: string, invoice: any) {
    const settings = await this.prisma.tenantInvoiceSettings.findUnique({
      where: { tenantId },
      select: { paymentInstructions: true },
    });
    const entity = invoice?.billingEntity
      ?? (invoice?.billingEntityId
        ? await this.prisma.billingEntity.findUnique({ where: { id: invoice.billingEntityId } })
        : null);
    if (entity) {
      return {
        name: entity.name,
        registeredAddress: entity.registeredAddress ?? null,
        taxLine: entity.taxLine ?? null,
        gstNumber: null,
        panNumber: null,
        paymentInstructions: entity.paymentInstructions ?? settings?.paymentInstructions ?? null,
      };
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, gstNumber: true, panNumber: true },
    });
    return {
      name: tenant?.name ?? 'HRMS Platform',
      registeredAddress: null,
      taxLine: null,
      gstNumber: tenant?.gstNumber ?? null,
      panNumber: tenant?.panNumber ?? null,
      paymentInstructions: settings?.paymentInstructions ?? null,
    };
  }

  // ── Billing entities (legal companies that issue invoices) ──

  listBillingEntities(tenantId: string) {
    return this.prisma.billingEntity.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { invoices: true } } },
    });
  }

  /** The tenant's default entity (creates a fallback from the tenant name if none). */
  private async defaultEntity(tenantId: string) {
    let entity = await this.prisma.billingEntity.findFirst({
      where: { tenantId, isDefault: true },
    });
    if (!entity) entity = await this.prisma.billingEntity.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    return entity;
  }

  /** Entity that bills a client: the client's mapped entity, else the tenant default. */
  private async entityForClient(tenantId: string, clientId: string, clientBillingEntityId?: string | null) {
    const beId = clientBillingEntityId !== undefined
      ? clientBillingEntityId
      : (await this.prisma.client.findUnique({ where: { id: clientId }, select: { billingEntityId: true } }))?.billingEntityId ?? null;
    if (beId) {
      const e = await this.prisma.billingEntity.findFirst({ where: { id: beId, tenantId, isActive: true } });
      if (e) return e;
    }
    return this.defaultEntity(tenantId);
  }

  async createBillingEntity(tenantId: string, dto: any) {
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Entity name is required');
    const invoicePrefix = (dto.invoicePrefix ?? '').trim();
    if (!invoicePrefix) throw new BadRequestException('Invoice number prefix is required (e.g. LSLLP/ZT)');
    const exists = await this.prisma.billingEntity.findFirst({ where: { tenantId, name } });
    if (exists) throw new ConflictException(`An entity named "${name}" already exists`);

    const isDefault = !!dto.isDefault;
    if (isDefault) {
      await this.prisma.billingEntity.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }
    return this.prisma.billingEntity.create({
      data: {
        tenantId, name, invoicePrefix,
        registeredAddress: dto.registeredAddress?.trim() || null,
        taxLine: dto.taxLine?.trim() || null,
        paymentInstructions: dto.paymentInstructions?.trim() || null,
        isDefault,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateBillingEntity(tenantId: string, id: string, dto: any) {
    const entity = await this.prisma.billingEntity.findFirst({ where: { id, tenantId } });
    if (!entity) throw new NotFoundException('Billing entity not found');

    const data: any = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Entity name is required');
      data.name = name;
    }
    if (dto.invoicePrefix !== undefined) {
      const p = dto.invoicePrefix.trim();
      if (!p) throw new BadRequestException('Invoice number prefix is required');
      data.invoicePrefix = p;
    }
    if (dto.registeredAddress !== undefined) data.registeredAddress = dto.registeredAddress?.trim() || null;
    if (dto.taxLine !== undefined) data.taxLine = dto.taxLine?.trim() || null;
    if (dto.paymentInstructions !== undefined) data.paymentInstructions = dto.paymentInstructions?.trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isDefault === true) {
      await this.prisma.billingEntity.updateMany({ where: { tenantId }, data: { isDefault: false } });
      data.isDefault = true;
    }
    return this.prisma.billingEntity.update({ where: { id }, data });
  }

  async deleteBillingEntity(tenantId: string, id: string) {
    const entity = await this.prisma.billingEntity.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { invoices: true } } },
    });
    if (!entity) throw new NotFoundException('Billing entity not found');
    if (entity.isDefault) throw new BadRequestException('Cannot delete the default entity — set another as default first');
    if (entity._count.invoices > 0) {
      throw new BadRequestException(`${entity._count.invoices} invoice(s) use this entity — reassign them first`);
    }
    await this.prisma.billingEntity.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Helpers ──────────────────────────────────────────────

  /** Indian financial year (Apr–Mar) for a date, formatted "26-27". */
  private finYear(date: Date): string {
    const y = date.getFullYear();
    const startYear = date.getMonth() >= 3 ? y : y - 1; // Apr (month index 3) onward
    return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
  }

  /**
   * Next invoice number in the form `ORG/{FY}/{seq}` — e.g. ORG/26-27/031.
   * Sequence auto-increments per financial year (resets each FY). 3-digit zero-padded.
   * Prefix is configurable via INVOICE_NUMBER_PREFIX (default "ORG").
   */
  private async nextInvoiceNumber(tenantId: string, invoiceDate: Date, prefixOverride?: string): Promise<string> {
    const prefix = prefixOverride || process.env.INVOICE_NUMBER_PREFIX || 'ORG';
    const fy = this.finYear(invoiceDate);
    const seriesPrefix = `${prefix}/${fy}/`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { tenantId, invoiceNumber: { startsWith: seriesPrefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    let seq = 1;
    if (lastInvoice) {
      const last = lastInvoice.invoiceNumber.slice(seriesPrefix.length); // the seq segment
      const n = parseInt(last, 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }

    return `${seriesPrefix}${String(seq).padStart(3, '0')}`;
  }

  private monthName(month: number): string {
    return [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ][month - 1];
  }
}
