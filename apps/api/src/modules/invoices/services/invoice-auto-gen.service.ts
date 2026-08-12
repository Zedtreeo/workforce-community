// apps/api/src/modules/invoices/services/invoice-auto-gen.service.ts
//
// Idempotent draft-invoice creation for a (client, year, month) period.
// Used by:
//   1. assignments.service.create() hook  — when admin creates an assignment,
//      ensure a draft exists for the period containing assignment.startDate
//   2. Daily BullMQ cron — for the current month, ensure every active client
//      has a draft invoice
//
// Behavior:
//   - If a DRAFT invoice exists for (tenant, client, year, month): re-runs
//     line-item generation, adding any NEW assignments not already on the
//     invoice. Recomputes subtotal / tax / total. Existing line items kept.
//   - If a non-DRAFT invoice exists (SENT/PARTIALLY_PAID/PAID/etc): no-op.
//     Admin must explicitly cancel + regenerate if they want to redo.
//   - If no invoice exists: delegates to InvoicesService.generate()
//
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { InvoicesService } from '../invoices.service';
import { Prisma } from '@prisma/client';

export interface EnsureDraftInput {
  clientId: string;
  year: number;          // e.g. 2026
  month: number;         // 1-12
  dueDays?: number;
  taxPercent?: number;
}

@Injectable()
export class InvoiceAutoGenService {
  private readonly logger = new Logger(InvoiceAutoGenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Ensure a DRAFT invoice exists for the period. Idempotent. */
  async ensureDraft(tenantId: string, input: EnsureDraftInput, userId?: string) {
    const periodStart = new Date(Date.UTC(input.year, input.month - 1, 1));
    const periodEnd   = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59));

    const existing = await this.prisma.invoice.findFirst({
      where: {
        tenantId, clientId: input.clientId,
        periodStart, periodEnd,
        status: { not: 'CANCELLED' },
      },
      include: { lineItems: { select: { assignmentId: true } } },
    });

    if (!existing) {
      // No invoice → delegate to existing generator
      try {
        return await this.invoices.generate(tenantId, input, userId);
      } catch (e: any) {
        if (e?.message?.includes('No active assignments')) {
          this.logger.log(`ensureDraft skip — no active assignments for client ${input.clientId} in ${input.year}-${input.month}`);
          return null;
        }
        throw e;
      }
    }

    // Only update DRAFT — finalized invoices are immutable from this path
    if (existing.status !== 'DRAFT') {
      this.logger.debug(`ensureDraft skip — invoice ${existing.invoiceNumber} is ${existing.status}`);
      return existing;
    }

    // Find assignments not yet on the invoice and append them
    const linkedAssignmentIds = new Set(existing.lineItems.map((li) => li.assignmentId).filter(Boolean));
    const assignments = await this.prisma.employeeAssignment.findMany({
      where: {
        tenantId, clientId: input.clientId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        startDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        id: { notIn: Array.from(linkedAssignmentIds) as string[] },
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      orderBy: { startDate: 'asc' },
    });

    if (assignments.length === 0) {
      return existing; // nothing to add
    }

    // Append new line items + recompute totals
    const newItems = assignments.map((a, idx) => {
      const qty = a.billingCycle === 'MONTHLY' ? new Prisma.Decimal(1) : new Prisma.Decimal(160);
      const amount = qty.mul(a.billingRate);
      return {
        invoiceId: existing.id,
        assignmentId: a.id,
        description: `${a.employee.firstName} ${a.employee.lastName} — ${a.role ?? 'Staff'} (${this.monthName(input.month)} ${input.year})`,
        quantity: qty,
        rate: a.billingRate,
        amount,
        sortOrder: existing.lineItems.length + idx,
      };
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.createMany({ data: newItems });
      const allItems = await tx.invoiceLineItem.findMany({ where: { invoiceId: existing.id } });
      const subtotal = allItems.reduce(
        (s, li) => s.add(new Prisma.Decimal(li.amount)),
        new Prisma.Decimal(0),
      );
      const taxPercent = new Prisma.Decimal(existing.taxPercent);
      const taxAmount = subtotal.mul(taxPercent).div(100);
      const total = subtotal.add(taxAmount);

      return tx.invoice.update({
        where: { id: existing.id },
        data: { subtotal, taxAmount, total, updatedBy: userId },
        include: { client: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    this.logger.log(`ensureDraft appended ${newItems.length} line(s) to ${existing.invoiceNumber}`);
    return updated;
  }

  /**
   * Daily cron-callable: for every (tenant, client) with active assignments,
   * ensure a DRAFT for the current month.
   */
  async ensureAllDraftsForCurrentMonth() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const clientsWithActive = await this.prisma.client.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        assignments: { some: { status: 'ACTIVE' } },
      },
      select: { id: true, tenantId: true, name: true },
    });

    let touched = 0;
    for (const c of clientsWithActive) {
      try {
        const r = await this.ensureDraft(c.tenantId, { clientId: c.id, year, month });
        if (r) touched++;
      } catch (e: any) {
        this.logger.warn(`ensureDraft failed for client ${c.name} (${c.id}): ${e.message}`);
      }
    }
    this.logger.log(`ensureAllDraftsForCurrentMonth: scanned ${clientsWithActive.length}, touched ${touched}`);
    return { scanned: clientsWithActive.length, touched };
  }

  /** Called from assignments.service.create() hook. */
  async onAssignmentCreated(tenantId: string, assignmentId: string, userId?: string) {
    const a = await this.prisma.employeeAssignment.findFirst({
      where: { id: assignmentId, tenantId },
      select: { clientId: true, startDate: true },
    });
    if (!a) return;
    const start = new Date(a.startDate);
    return this.ensureDraft(tenantId, {
      clientId: a.clientId,
      year: start.getUTCFullYear(),
      month: start.getUTCMonth() + 1,
    }, userId);
  }

  private monthName(month: number): string {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month - 1];
  }
}
