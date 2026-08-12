// apps/api/src/modules/invoices/services/invoice-line-items.service.ts
//
// Add / edit / remove invoice line items in DRAFT state only.
// After any mutation, recomputes subtotal + taxAmount + total.
// "regenerate" wipes assignment-linked items and re-runs auto-gen logic,
// preserving any manually-added items (assignmentId == null).
//
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AuditService } from '../../audit/audit.service';
import { Prisma } from '@prisma/client';

export interface UpsertLineItemInput {
  description: string;
  quantity: number;       // can be 1 for fixed-fee items
  rate: number;           // can be negative for deductions
  sortOrder?: number;
}

@Injectable()
export class InvoiceLineItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(tenantId: string, invoiceId: string) {
    await this.assertExists(tenantId, invoiceId);
    return this.prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { sortOrder: 'asc' },
      include: {
        assignment: {
          select: {
            id: true,
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
        },
      },
    });
  }

  async add(tenantId: string, invoiceId: string, dto: UpsertLineItemInput, userId: string) {
    await this.assertDraft(tenantId, invoiceId);
    if (!dto.description?.trim()) throw new BadRequestException('description required');

    const result = await this.prisma.$transaction(async (tx) => {
      const max = await tx.invoiceLineItem.aggregate({
        where: { invoiceId }, _max: { sortOrder: true },
      });
      const sortOrder = dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1;

      await tx.invoiceLineItem.create({
        data: {
          invoiceId,
          description: dto.description.trim(),
          quantity: new Prisma.Decimal(dto.quantity),
          rate: new Prisma.Decimal(dto.rate),
          amount: new Prisma.Decimal(dto.quantity).mul(dto.rate),
          sortOrder,
        },
      });
      return this.recomputeTotals(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'LINE_ITEM_ADD',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { description: dto.description, quantity: dto.quantity, rate: dto.rate },
    });
    return result;
  }

  async update(tenantId: string, invoiceId: string, lineId: string, dto: Partial<UpsertLineItemInput>, userId: string) {
    await this.assertDraft(tenantId, invoiceId);
    const existing = await this.prisma.invoiceLineItem.findFirst({
      where: { id: lineId, invoiceId },
    });
    if (!existing) throw new NotFoundException('Line item not found');

    const next = {
      description: dto.description ?? existing.description,
      quantity: dto.quantity ?? Number(existing.quantity),
      rate: dto.rate ?? Number(existing.rate),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.update({
        where: { id: lineId },
        data: {
          description: next.description.trim(),
          quantity: new Prisma.Decimal(next.quantity),
          rate: new Prisma.Decimal(next.rate),
          amount: new Prisma.Decimal(next.quantity).mul(next.rate),
        },
      });
      return this.recomputeTotals(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'LINE_ITEM_UPDATE',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: {
        lineId,
        before: { description: existing.description, quantity: existing.quantity, rate: existing.rate },
        after: next,
      },
    });
    return result;
  }

  async remove(tenantId: string, invoiceId: string, lineId: string, userId: string) {
    await this.assertDraft(tenantId, invoiceId);
    const existing = await this.prisma.invoiceLineItem.findFirst({
      where: { id: lineId, invoiceId },
    });
    if (!existing) throw new NotFoundException('Line item not found');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.delete({ where: { id: lineId } });
      return this.recomputeTotals(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'LINE_ITEM_DELETE',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { description: existing.description, amount: existing.amount },
    });
    return result;
  }

  /**
   * Wipe assignment-linked items, re-derive them from current active assignments
   * for the invoice's period. PRESERVES any manually-added line items
   * (those with assignmentId == null).
   */
  async regenerate(tenantId: string, invoiceId: string, userId: string) {
    const invoice = await this.assertDraft(tenantId, invoiceId);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Snapshot existing items
      const existing = await tx.invoiceLineItem.findMany({ where: { invoiceId } });
      const manualItems = existing.filter((li) => !li.assignmentId);
      const linkedCount = existing.length - manualItems.length;

      // 2. Remove all assignment-linked items
      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId, assignmentId: { not: null } },
      });

      // 3. Re-derive from active assignments in the period
      const assignments = await tx.employeeAssignment.findMany({
        where: {
          tenantId,
          clientId: invoice.clientId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          startDate: { lte: invoice.periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: invoice.periodStart } }],
        },
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { startDate: 'asc' },
      });

      const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][
        new Date(invoice.periodStart).getUTCMonth()
      ];
      const year = new Date(invoice.periodStart).getUTCFullYear();

      const startSort = manualItems.length;
      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        const qty = a.billingCycle === 'MONTHLY' ? new Prisma.Decimal(1) : new Prisma.Decimal(160);
        await tx.invoiceLineItem.create({
          data: {
            invoiceId,
            assignmentId: a.id,
            description: `${a.employee.firstName} ${a.employee.lastName} — ${a.role ?? 'Staff'} (${monthName} ${year})`,
            quantity: qty,
            rate: a.billingRate,
            amount: qty.mul(a.billingRate),
            sortOrder: startSort + i,
          },
        });
      }
      return {
        ...(await this.recomputeTotals(tx as any, tenantId, invoiceId, userId)),
        _meta: {
          linkedRemoved: linkedCount,
          linkedAdded: assignments.length,
          manualPreserved: manualItems.length,
        },
      };
    });

    await this.audit.log({
      tenantId, userId,
      action: 'LINE_ITEM_REGENERATE',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: result._meta,
    });
    return result;
  }

  // ─────────── helpers ───────────
  private async assertExists(tenantId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  private async assertDraft(tenantId: string, invoiceId: string) {
    const inv = await this.assertExists(tenantId, invoiceId);
    if (inv.status !== 'DRAFT') {
      throw new ConflictException(`Invoice is ${inv.status} — line items can only be edited in DRAFT. Cancel and regenerate if needed.`);
    }
    return inv;
  }

  private async recomputeTotals(tx: PrismaService, tenantId: string, invoiceId: string, userId: string) {
    const items = await tx.invoiceLineItem.findMany({ where: { invoiceId } });
    const subtotal = items.reduce((s, li) => s.add(new Prisma.Decimal(li.amount)), new Prisma.Decimal(0));
    const inv = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, tenantId } });
    const taxPercent = new Prisma.Decimal(inv.taxPercent);
    const taxAmount = subtotal.mul(taxPercent).div(100);
    const total = subtotal.add(taxAmount);

    return tx.invoice.update({
      where: { id: invoiceId },
      data: { subtotal, taxAmount, total, updatedBy: userId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: { select: { id: true, name: true, currency: true } },
      },
    });
  }
}
