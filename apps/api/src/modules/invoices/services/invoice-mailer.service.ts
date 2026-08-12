// apps/api/src/modules/invoices/services/invoice-mailer.service.ts
//
// Sends a generated invoice via email with the PDF attached.
// Same pattern as letter-mailer.service.ts (bypasses EmailService.send() so
// we can attach files via nodemailer directly).
//
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AuditService } from '../../audit/audit.service';
import { InvoicesService } from '../invoices.service';
import { InvoicePdfService } from '../invoice-pdf.service';
import * as nodemailer from 'nodemailer';

// ── Default invoice email template ──
// Body is PLAIN TEXT (with {{variables}}); it's converted to formatted HTML at
// send time so admins never write HTML. Supported variables:
// {{clientName}} {{invoiceNumber}} {{period}} {{total}} {{currency}}
// {{dueDate}} {{paymentTerms}} {{payoneerLink}}
export const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Invoice {{invoiceNumber}} — {{clientName}}';
export const DEFAULT_INVOICE_EMAIL_BODY_TEXT =
`Dear {{clientName}},

Please find attached invoice {{invoiceNumber}} for the period {{period}}.

Total due: {{currency}} {{total}}
Payment terms: {{paymentTerms}}
Due date: {{dueDate}}

Please reply to this email if you have any questions.

Best regards,
Accounts Team`;

export const INVOICE_EMAIL_VARIABLES = [
  'clientName', 'invoiceNumber', 'period', 'total', 'currency', 'dueDate', 'paymentTerms', 'payoneerLink',
];

// Printed under "Payment Instructions" on the invoice PDF when the tenant
// hasn't saved custom text (Reference + Amount Due lines are always appended).
export const DEFAULT_PAYMENT_INSTRUCTIONS = 'Please remit payment via Payoneer.';

export interface SendInvoiceInput {
  to: string;
  cc?: string;
  /** Per-send subject override (else the chosen/default template). */
  subject?: string;
  /** Per-send PLAIN-TEXT body override (else the chosen/default template). */
  body?: string;
  /** Which saved template to use when subject/body aren't overridden. */
  templateId?: string;
  /** Per-payment Payoneer link; falls back to the invoice's stored payoneerLink. */
  payoneerLink?: string;
}

@Injectable()
export class InvoiceMailerService {
  private readonly logger = new Logger(InvoiceMailerService.name);
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER || 'emailapikey', pass: process.env.SMTP_PASS || '' },
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  async send(tenantId: string, invoiceId: string, input: SendInvoiceInput, userId: string) {
    const invoice = await this.invoices.findOne(tenantId, invoiceId);
    if (invoice.status === 'CANCELLED' || invoice.status === 'VOID') {
      throw new BadRequestException(`Cannot send a ${invoice.status} invoice`);
    }
    if (!input.to || !input.to.includes('@')) {
      throw new BadRequestException('Recipient email required');
    }

    // Generate PDF on demand (issuer = invoice's billing entity or tenant)
    const issuerInfo = await this.invoices.getIssuerInfo(tenantId, invoice);
    const pdfBuffer = await this.pdf.generatePdf({ ...invoice, tenant: issuerInfo } as any);

    // Per-payment Payoneer link (request override → invoice's stored link).
    const payoneerLink = (input.payoneerLink?.trim() || (invoice as any).payoneerLink || '').trim();
    const payButton = payoneerLink
      ? `<p style="margin:24px 0;">
           <a href="${payoneerLink}" style="background:#ff4800;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">Pay via Payoneer</a>
         </p>
         <p style="font-size:12px;color:#666;">Or copy this link: <a href="${payoneerLink}">${payoneerLink}</a></p>`
      : '';

    // Template precedence: per-send override → chosen/default saved template → built-in.
    const tpl = input.templateId
      ? await this.prisma.invoiceEmailTemplate.findFirst({ where: { id: input.templateId, tenantId } })
      : await this.defaultTemplate(tenantId);
    const subjTpl = input.subject?.trim() || tpl?.subject || DEFAULT_INVOICE_EMAIL_SUBJECT;
    const bodyTpl = (input.body !== undefined && input.body !== null && input.body !== '')
      ? input.body
      : (tpl?.body ?? DEFAULT_INVOICE_EMAIL_BODY_TEXT);

    const vars = this.buildVars(invoice, payoneerLink);
    const subject = this.render(subjTpl, vars);
    // Body is plain text → convert to HTML (escaping) so admins never write HTML.
    let body = this.textToHtml(this.render(bodyTpl, vars));
    // Always ensure the Pay button is present when a link exists.
    if (payoneerLink && !body.includes(payoneerLink)) body = `${body}${payButton}`;

    // CC: always copy the billing mailbox + any user-supplied addresses (comma/semicolon
    // separated). Dedupe, and drop any that equal the To address.
    const billingCc = process.env.INVOICE_BILLING_CC || 'billing@example.com';
    const ccList = [
      ...(input.cc ? input.cc.split(/[,;]/).map((s) => s.trim()) : []),
      billingCc,
    ].filter(Boolean);
    const cc = [...new Set(ccList.map((e) => e.toLowerCase()))]
      .filter((e) => e !== input.to.toLowerCase());

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM_BILLING || '"Billing" <billing@example.com>',
      replyTo: process.env.SMTP_REPLYTO_BILLING || 'billing@example.com',
      to: input.to,
      cc: cc.length ? cc : undefined,
      subject,
      html: body,
      attachments: [{
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    // Flip status DRAFT → SENT (or keep current if already further along)
    const nextStatus = invoice.status === 'DRAFT' ? 'SENT' : invoice.status;
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: nextStatus,
        sentAt: new Date(),
        sentTo: input.to,
        updatedBy: userId,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    await this.audit.log({
      tenantId, userId,
      action: 'SEND',
      entity: 'Invoice',
      entityId: invoiceId,
      changes: { to: input.to, cc: cc.join(', '), subject, statusBefore: invoice.status, statusAfter: nextStatus },
    });

    this.logger.log(`Sent ${invoice.invoiceNumber} to ${input.to}`);
    return updated;
  }

  /** PDF payment-instructions block + the {{variable}} list (for the settings page). */
  async getEmailTemplate(tenantId: string) {
    const s = await this.prisma.tenantInvoiceSettings.findUnique({ where: { tenantId } });
    return {
      paymentInstructions: s?.paymentInstructions ?? DEFAULT_PAYMENT_INSTRUCTIONS,
      variables: INVOICE_EMAIL_VARIABLES,
      defaults: { paymentInstructions: DEFAULT_PAYMENT_INSTRUCTIONS },
    };
  }

  /** Save the PDF payment instructions (empty → revert to default). */
  async updateEmailTemplate(tenantId: string, dto: { paymentInstructions?: string }) {
    const paymentInstructions = dto.paymentInstructions?.trim() || null;
    await this.prisma.tenantInvoiceSettings.upsert({
      where: { tenantId },
      create: { tenantId, paymentInstructions },
      update: { paymentInstructions },
    });
    return this.getEmailTemplate(tenantId);
  }

  // ── Named email templates (plain-text body) ──

  private async defaultTemplate(tenantId: string) {
    return (await this.prisma.invoiceEmailTemplate.findFirst({ where: { tenantId, isDefault: true } }))
      ?? (await this.prisma.invoiceEmailTemplate.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } }));
  }

  async listTemplates(tenantId: string) {
    const templates = await this.prisma.invoiceEmailTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return {
      templates,
      variables: INVOICE_EMAIL_VARIABLES,
      defaults: { subject: DEFAULT_INVOICE_EMAIL_SUBJECT, body: DEFAULT_INVOICE_EMAIL_BODY_TEXT },
    };
  }

  async createTemplate(tenantId: string, dto: { name?: string; subject?: string; body?: string; isDefault?: boolean }) {
    const name = (dto.name ?? '').trim();
    const subject = (dto.subject ?? '').trim();
    const body = (dto.body ?? '').trim();
    if (!name) throw new BadRequestException('Template name is required');
    if (!subject) throw new BadRequestException('Subject is required');
    if (!body) throw new BadRequestException('Body is required');
    const exists = await this.prisma.invoiceEmailTemplate.findFirst({ where: { tenantId, name } });
    if (exists) throw new BadRequestException(`A template named "${name}" already exists`);
    if (dto.isDefault) {
      await this.prisma.invoiceEmailTemplate.updateMany({ where: { tenantId }, data: { isDefault: false } });
    }
    return this.prisma.invoiceEmailTemplate.create({
      data: { tenantId, name, subject, body, isDefault: !!dto.isDefault },
    });
  }

  async updateTemplate(tenantId: string, id: string, dto: { name?: string; subject?: string; body?: string; isDefault?: boolean }) {
    const tpl = await this.prisma.invoiceEmailTemplate.findFirst({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Template not found');
    const data: any = {};
    if (dto.name !== undefined) { const n = dto.name.trim(); if (!n) throw new BadRequestException('Template name is required'); data.name = n; }
    if (dto.subject !== undefined) { const s = dto.subject.trim(); if (!s) throw new BadRequestException('Subject is required'); data.subject = s; }
    if (dto.body !== undefined) { const b = dto.body.trim(); if (!b) throw new BadRequestException('Body is required'); data.body = b; }
    if (dto.isDefault === true) {
      await this.prisma.invoiceEmailTemplate.updateMany({ where: { tenantId }, data: { isDefault: false } });
      data.isDefault = true;
    }
    return this.prisma.invoiceEmailTemplate.update({ where: { id }, data });
  }

  async deleteTemplate(tenantId: string, id: string) {
    const tpl = await this.prisma.invoiceEmailTemplate.findFirst({ where: { id, tenantId } });
    if (!tpl) throw new NotFoundException('Template not found');
    const count = await this.prisma.invoiceEmailTemplate.count({ where: { tenantId } });
    if (count <= 1) throw new BadRequestException('Cannot delete the only template — create another first');
    await this.prisma.invoiceEmailTemplate.delete({ where: { id } });
    if (tpl.isDefault) {
      const next = await this.prisma.invoiceEmailTemplate.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
      if (next) await this.prisma.invoiceEmailTemplate.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  }

  /** Convert a plain-text body (with blank-line paragraphs) to simple, safe HTML. */
  private textToHtml(text: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  private fmt(d: Date | string | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  /** Build the {{variable}} substitution map for an invoice. */
  private buildVars(invoice: any, payoneerLink: string): Record<string, string> {
    return {
      clientName: invoice.client?.name ?? '',
      invoiceNumber: invoice.invoiceNumber,
      period: this.periodLabel(invoice.periodStart, invoice.periodEnd),
      total: Number(invoice.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currency: invoice.currency,
      dueDate: this.fmt(invoice.dueDate),
      paymentTerms: invoice.paymentTerms ?? 'Due on Receipt',
      payoneerLink: payoneerLink || '',
    };
  }

  /** Replace {{var}} tokens (unknown tokens → empty string). */
  private render(tpl: string, vars: Record<string, string>): string {
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in vars ? vars[k] : ''));
  }

  /** "13th Jun-12th Jul'26" (or "1st-31st Jul'26" within one month). */
  private periodLabel(start: Date | string, end: Date | string): string {
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const s = new Date(start);
    const e = new Date(end);
    const yy = String(e.getUTCFullYear()).slice(2);
    if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
      return `${this.ordinal(s.getUTCDate())}-${this.ordinal(e.getUTCDate())} ${M[e.getUTCMonth()]}'${yy}`;
    }
    return `${this.ordinal(s.getUTCDate())} ${M[s.getUTCMonth()]}-${this.ordinal(e.getUTCDate())} ${M[e.getUTCMonth()]}'${yy}`;
  }
}
