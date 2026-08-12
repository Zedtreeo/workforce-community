import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subtotal: string | number;
  taxPercent: string | number;
  taxAmount: string | number;
  total: string | number;
  currency: string;
  status: string;
  notes?: string | null;
  paymentTerms?: string | null;
  paidAt?: string | null;
  paidAmount?: string | number | null;
  paymentRef?: string | null;
  client: {
    name: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    country: string;
    billingEmail?: string | null;
    payoneerEmail?: string | null;
    contactNumber?: string | null;
    registeredAddress?: string | null;
  };
  lineItems: {
    description: string;
    quantity: string | number;
    rate: string | number;
    amount: string | number;
  }[];
  tenant?: {
    name: string;
    gstNumber?: string | null;
    panNumber?: string | null;
    registeredAddress?: string | null;
    taxLine?: string | null;
    paymentInstructions?: string | null;
  } | null;
}

@Injectable()
export class InvoicePdfService {
  async generatePdf(invoice: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width - 100; // usable width
      const currency = invoice.currency;

      // ── Header ──
      const companyName = invoice.tenant?.name ?? 'Zedtreeo Workforce';
      doc.fontSize(22).font('Helvetica-Bold').text(companyName, 50, 50);
      doc.fontSize(9).font('Helvetica').fillColor('#666666');
      if (invoice.tenant?.registeredAddress) {
        invoice.tenant.registeredAddress.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => doc.text(line));
      }
      if (invoice.tenant?.taxLine) doc.text(invoice.tenant.taxLine);
      if (invoice.tenant?.gstNumber) doc.text(`GSTIN: ${invoice.tenant.gstNumber}`);
      if (invoice.tenant?.panNumber) doc.text(`PAN: ${invoice.tenant.panNumber}`);

      // Invoice title
      doc.moveDown(1.5);
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#1a1a1a').text('INVOICE', { align: 'right' });
      doc.fontSize(12).font('Helvetica').fillColor('#2563eb').text(invoice.invoiceNumber, { align: 'right' });

      // ── Invoice Meta ──
      const metaY = doc.y + 20;
      doc.fontSize(9).fillColor('#666666');

      // Left: Bill To
      doc.font('Helvetica-Bold').fillColor('#1a1a1a').text('BILL TO', 50, metaY);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11).text(invoice.client.name);
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      const contactName = [invoice.client.firstName, invoice.client.lastName].filter(Boolean).join(' ');
      if (contactName) doc.text(`Attn: ${contactName}`);
      // Address: keep explicit line breaks; otherwise wrap as one paragraph so
      // a comma-separated address doesn't become 6 tall lines. Falls back to country.
      if (invoice.client.registeredAddress) {
        const addr = invoice.client.registeredAddress;
        const lines = addr.includes('\n')
          ? addr.split('\n').map((s) => s.trim()).filter(Boolean)
          : [addr.replace(/\s*,\s*/g, ', ').trim()];
        lines.forEach((line) => doc.text(line, { width: 250 }));
      } else {
        doc.text(invoice.client.country);
      }
      if (invoice.client.contactNumber) doc.text(`Phone: ${invoice.client.contactNumber}`);
      doc.text(invoice.client.billingEmail ?? invoice.client.email);

      // Right: Invoice details
      const rightX = 350;
      doc.font('Helvetica').fontSize(9).fillColor('#666666');
      doc.text('Invoice Date:', rightX, metaY, { continued: true }).font('Helvetica-Bold').fillColor('#1a1a1a').text(`  ${this.fmtDate(invoice.invoiceDate)}`);
      doc.font('Helvetica').fillColor('#666666').text('Due Date:', rightX, metaY + 15, { continued: true }).font('Helvetica-Bold').fillColor('#1a1a1a').text(`  ${this.fmtDate(invoice.dueDate)}`);
      doc.font('Helvetica').fillColor('#666666').text('Period:', rightX, metaY + 30, { continued: true }).font('Helvetica-Bold').fillColor('#1a1a1a').text(`  ${this.fmtDate(invoice.periodStart)} – ${this.fmtDate(invoice.periodEnd)}`);
      doc.font('Helvetica').fillColor('#666666').text('Terms:', rightX, metaY + 45, { continued: true }).font('Helvetica-Bold').fillColor('#1a1a1a').text(`  ${invoice.paymentTerms ?? 'Due on Receipt'}`);
      if (invoice.status === 'PAID' && invoice.paidAt) {
        doc.font('Helvetica-Bold').fillColor('#16a34a').text('PAID', rightX, metaY + 60, { continued: true }).font('Helvetica').text(`  on ${this.fmtDate(invoice.paidAt)}`);
      }

      // ── Line Items Table ──
      const tableTop = Math.max(doc.y, metaY + 80) + 20;

      // Table header
      doc.rect(50, tableTop, pageW, 22).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
      doc.text('#', 55, tableTop + 7, { width: 25 });
      doc.text('Description', 80, tableTop + 7, { width: 250 });
      doc.text('Qty', 335, tableTop + 7, { width: 50, align: 'right' });
      doc.text('Rate', 390, tableTop + 7, { width: 70, align: 'right' });
      doc.text('Amount', 465, tableTop + 7, { width: 80, align: 'right' });

      // Table rows
      let rowY = tableTop + 28;
      doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');

      invoice.lineItems.forEach((li, idx) => {
        if (rowY > 700) {
          doc.addPage();
          rowY = 50;
        }

        if (idx % 2 === 1) {
          doc.rect(50, rowY - 4, pageW, 20).fill('#fafafa');
          doc.fillColor('#1a1a1a');
        }

        doc.text(String(idx + 1), 55, rowY, { width: 25 });
        doc.text(li.description, 80, rowY, { width: 250 });
        doc.text(String(Number(li.quantity)), 335, rowY, { width: 50, align: 'right' });
        doc.text(this.fmtMoney(li.rate), 390, rowY, { width: 70, align: 'right' });
        doc.font('Helvetica-Bold').text(this.fmtMoney(li.amount), 465, rowY, { width: 80, align: 'right' });
        doc.font('Helvetica');

        rowY += 22;
      });

      // ── Totals ──
      rowY += 10;
      doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#e5e7eb').stroke();
      rowY += 8;

      // Subtotal
      doc.font('Helvetica').fontSize(9).fillColor('#666666').text('Subtotal', 350, rowY, { width: 110, align: 'right' });
      doc.font('Helvetica-Bold').fillColor('#1a1a1a').text(`${currency} ${this.fmtMoney(invoice.subtotal)}`, 465, rowY, { width: 80, align: 'right' });

      // Tax
      if (Number(invoice.taxPercent) > 0) {
        rowY += 18;
        doc.font('Helvetica').fillColor('#666666').text(`Tax (${Number(invoice.taxPercent)}%)`, 350, rowY, { width: 110, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#1a1a1a').text(`${currency} ${this.fmtMoney(invoice.taxAmount)}`, 465, rowY, { width: 80, align: 'right' });
      }

      // Total
      rowY += 22;
      doc.moveTo(350, rowY).lineTo(545, rowY).strokeColor('#1a1a1a').lineWidth(1.5).stroke();
      rowY += 8;
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a').text('TOTAL', 350, rowY, { width: 110, align: 'right' });
      doc.text(`${currency} ${this.fmtMoney(invoice.total)}`, 465, rowY, { width: 80, align: 'right' });

      // ── Payment Instructions ──
      rowY += 40;
      if (rowY > 680) { doc.addPage(); rowY = 50; }

      doc.rect(50, rowY, pageW, 1).fill('#e5e7eb');
      rowY += 12;

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a').text('Payment Instructions', 50, rowY);
      rowY += 16;
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      // Tenant-configurable block (Invoices → Email Template & Payment Instructions)
      const instructions = invoice.tenant?.paymentInstructions?.trim()
        || 'Please remit payment via Payoneer.';
      for (const line of instructions.split('\n')) {
        if (rowY > 760) { doc.addPage(); rowY = 50; }
        doc.text(line.trim(), 50, rowY, { width: pageW });
        rowY += 14;
      }
      doc.text(`Reference: ${invoice.invoiceNumber}`, 50, rowY);
      rowY += 14;
      doc.text(`Amount Due: ${currency} ${this.fmtMoney(invoice.total)}`, 50, rowY);

      // ── Notes ──
      if (invoice.notes) {
        rowY += 30;
        if (rowY > 700) { doc.addPage(); rowY = 50; }
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666').text('Notes', 50, rowY);
        rowY += 14;
        doc.font('Helvetica').fillColor('#374151').text(invoice.notes, 50, rowY, { width: pageW });
      }

      // ── Footer ── (kept above the bottom margin + lineBreak:false so it never
      // spills onto a blank second page)
      doc.fontSize(8).fillColor('#9ca3af').text(
        'This is a computer-generated invoice. No signature required.',
        50, doc.page.height - 70,
        { align: 'center', width: pageW, lineBreak: false },
      );

      doc.end();
    });
  }

  private fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private fmtMoney(v: string | number): string {
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
