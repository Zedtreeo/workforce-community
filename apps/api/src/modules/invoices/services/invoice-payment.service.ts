// apps/api/src/modules/invoices/services/invoice-payment.service.ts
//
// Manages InvoicePayment rows + recomputes the invoice's outstanding balance
// + auto-flips status (DRAFT → SENT → PARTIALLY_PAID → PAID).
//
// Currency model:
//   - amount + currency  = what client actually paid (in client's currency)
//   - exchangeRate       = rate as of paidOn (admin enters, or 1.0 if same ccy)
//   - amountInInvoiceCurrency = amount * exchangeRate  (validated, never trusted blindly)
//   - bankFee            = receiver-side fee in client currency (Payoneer/wire)
//
// outstanding = invoice.total - SUM(amountInInvoiceCurrency) - amountWrittenOff
//
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AuditService } from '../../audit/audit.service';
import { Prisma, InvoiceStatus, PaymentMethod } from '@prisma/client';

export interface RecordPaymentInput {
  paidOn: string;                     // YYYY-MM-DD
  amount: number;                     // in `currency`
  currency: string;                   // ISO 4217
  exchangeRate?: number;              // if omitted and currency matches invoice, treated as 1.0
  method: PaymentMethod;
  reference?: string;
  bankFee?: number;
  notes?: string;
}

export interface WriteOffInput {
  amount: number;                     // in invoice currency
  reason: string;
}

@Injectable()
export class InvoicePaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.loadInvoice(tenantId, invoiceId);
    const payments = await this.prisma.invoicePayment.findMany({
      where: { tenantId, invoiceId },
      orderBy: { paidOn: 'desc' },
    });
    return {
      invoice: {
        id: invoice.id, total: invoice.total, currency: invoice.currency,
        amountWrittenOff: invoice.amountWrittenOff ?? 0,
        status: invoice.status,
      },
      payments,
      summary: this.computeSummary(invoice, payments),
    };
  }

  async recordPayment(tenantId: string, invoiceId: string, input: RecordPaymentInput, userId: string) {
    const invoice = await this.loadInvoice(tenantId, invoiceId);
    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      throw new ConflictException(`Cannot record payment on a ${invoice.status} invoice`);
    }
    if (input.amount <= 0) throw new BadRequestException('Payment amount must be > 0');

    // Compute amountInInvoiceCurrency
    const sameCcy = input.currency.toUpperCase() === invoice.currency.toUpperCase();
    const rate = input.exchangeRate ?? (sameCcy ? 1 : null);
    if (rate == null) {
      throw new BadRequestException(
        `Payment currency ${input.currency} differs from invoice currency ${invoice.currency} — exchangeRate is required`,
      );
    }
    if (rate <= 0) throw new BadRequestException('exchangeRate must be > 0');

    const amount = new Prisma.Decimal(input.amount);
    const amountInInvoiceCurrency = amount.mul(rate);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          tenantId,
          invoiceId,
          paidOn: new Date(input.paidOn),
          amount,
          currency: input.currency.toUpperCase(),
          exchangeRate: input.exchangeRate ? new Prisma.Decimal(input.exchangeRate) : null,
          amountInInvoiceCurrency,
          method: input.method,
          reference: input.reference,
          bankFee: input.bankFee != null ? new Prisma.Decimal(input.bankFee) : null,
          notes: input.notes,
          recordedBy: userId,
        },
      });
      return this.recomputeStatus(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'PAYMENT_RECORD',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { amount: input.amount, currency: input.currency, method: input.method, status: updated.status },
    });
    return updated;
  }

  async removePayment(tenantId: string, invoiceId: string, paymentId: string, userId: string) {
    const payment = await this.prisma.invoicePayment.findFirst({
      where: { id: paymentId, tenantId, invoiceId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.delete({ where: { id: paymentId } });
      return this.recomputeStatus(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'PAYMENT_DELETE',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { paymentId, amount: payment.amount, status: updated.status },
    });
    return updated;
  }

  async writeOff(tenantId: string, invoiceId: string, input: WriteOffInput, userId: string) {
    if (input.amount < 0) throw new BadRequestException('Write-off amount cannot be negative');
    if (!input.reason || input.reason.trim().length < 5) {
      throw new BadRequestException('Write-off reason required (min 5 chars)');
    }
    const invoice = await this.loadInvoice(tenantId, invoiceId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountWrittenOff: new Prisma.Decimal(input.amount),
          writeOffReason: input.reason.trim(),
          updatedBy: userId,
        },
      });
      return this.recomputeStatus(tx as any, tenantId, invoiceId, userId);
    });

    await this.audit.log({
      tenantId, userId,
      action: 'WRITE_OFF',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { amount: input.amount, reason: input.reason, status: updated.status },
    });
    return updated;
  }

  // ─────────── Status auto-flip logic ───────────
  /** Reads current payments + writeOff, recomputes outstanding, updates status. */
  private async recomputeStatus(tx: PrismaService, tenantId: string, invoiceId: string, userId: string) {
    const inv = await tx.invoice.findFirstOrThrow({ where: { id: invoiceId, tenantId } });
    const sum = await tx.invoicePayment.aggregate({
      where: { tenantId, invoiceId },
      _sum: { amountInInvoiceCurrency: true },
    });
    const paid = new Prisma.Decimal(sum._sum.amountInInvoiceCurrency ?? 0);
    const writtenOff = new Prisma.Decimal(inv.amountWrittenOff ?? 0);
    const outstanding = new Prisma.Decimal(inv.total).sub(paid).sub(writtenOff);

    // Determine next status
    let nextStatus: InvoiceStatus = inv.status;
    const epsilon = new Prisma.Decimal('0.01');
    if (paid.gt(0)) {
      if (outstanding.lte(epsilon)) nextStatus = 'PAID';
      else nextStatus = 'PARTIALLY_PAID';
    } else if (inv.status === 'PARTIALLY_PAID' || inv.status === 'PAID') {
      // All payments removed — revert to whatever it was (DRAFT/SENT)
      nextStatus = inv.sentAt ? 'SENT' : 'DRAFT';
    }

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        paidAmount: paid,                                 // mirror sum into legacy field
        paidAt: nextStatus === 'PAID' ? new Date() : null,
        updatedBy: userId,
      },
      include: {
        client: { select: { id: true, name: true, currency: true } },
        payments: { orderBy: { paidOn: 'desc' } },
      },
    });
  }

  private async loadInvoice(tenantId: string, invoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  private computeSummary(invoice: any, payments: any[]) {
    const paid = payments.reduce(
      (a, p) => a.add(new Prisma.Decimal(p.amountInInvoiceCurrency)),
      new Prisma.Decimal(0),
    );
    const writtenOff = new Prisma.Decimal(invoice.amountWrittenOff ?? 0);
    const total = new Prisma.Decimal(invoice.total);
    const outstanding = total.sub(paid).sub(writtenOff);
    const bankFees = payments.reduce(
      (a, p) => a.add(new Prisma.Decimal(p.bankFee ?? 0)),
      new Prisma.Decimal(0),
    );
    return {
      total:        total.toFixed(2),
      paid:         paid.toFixed(2),
      writtenOff:   writtenOff.toFixed(2),
      outstanding:  outstanding.toFixed(2),
      bankFees:     bankFees.toFixed(2),
      paymentCount: payments.length,
    };
  }
}
