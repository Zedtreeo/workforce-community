// apps/api/src/modules/letters/services/letter-mailer.service.ts
//
// Sends a generated letter as an email attachment. Uses the existing
// EmailService transporter (nodemailer) but supports attachments — which
// the default EmailService.send() doesn't expose. We bypass it for this
// path and send directly via nodemailer.
//
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AuditService } from '../../audit/audit.service';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

interface SendOpts {
  to: string;
  subject?: string;
  bodyHtml?: string;
  attachAs?: 'docx' | 'pdf';
}

@Injectable()
export class LetterMailerService {
  private readonly logger = new Logger(LetterMailerService.name);
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zeptomail.in',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: { user: process.env.SMTP_USER || 'emailapikey', pass: process.env.SMTP_PASS || '' },
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async sendLetter(tenantId: string, letterId: string, opts: SendOpts, userId: string) {
    const letter = await this.prisma.generatedLetter.findFirst({
      where: { id: letterId, tenantId },
      include: { template: true, employee: true, client: true },
    });
    if (!letter) throw new NotFoundException('Letter not found');

    const attachAs = opts.attachAs ?? 'pdf';
    const filePath = attachAs === 'pdf' ? letter.pdfPath : letter.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new BadRequestException(`${attachAs.toUpperCase()} file not available for this letter`);
    }

    const recipientName =
      letter.employee
        ? `${letter.employee.firstName} ${letter.employee.lastName}`
        : letter.client?.name ?? 'recipient';
    const defaultSubject = `${this.titleFromType(letter.type)} — ${letter.referenceNo ?? letter.id}`;
    const defaultBody = `<p>Dear ${recipientName},</p>
      <p>Please find attached your ${this.titleFromType(letter.type).toLowerCase()}.</p>
      <p>If you have any questions, please reply to this email.</p>
      <p>Best regards,<br/>HR Team</p>`;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM_HR || '"Legelp HR" <hr@legelp.com>',
      replyTo: process.env.SMTP_REPLYTO_HR || 'hr@legelp.com',
      to: opts.to,
      subject: opts.subject || defaultSubject,
      html: opts.bodyHtml || defaultBody,
      attachments: [{
        filename: path.basename(filePath),
        path: filePath,
      }],
    });

    const updated = await this.prisma.generatedLetter.update({
      where: { id: letterId },
      data: { status: 'SENT', sentAt: new Date(), sentTo: opts.to },
    });

    await this.audit.log({
      tenantId, userId,
      action: 'SEND',
      entity: 'GeneratedLetter',
      entityId: letterId,
      changes: { to: opts.to, attachAs, subject: opts.subject || defaultSubject },
    });

    this.logger.log(`Sent ${letter.type} (${letter.referenceNo}) to ${opts.to}`);
    return updated;
  }

  private titleFromType(t: string): string {
    return {
      OFFER_LETTER:       'Offer Letter',
      APPOINTMENT_LETTER: 'Appointment Letter',
      EXPERIENCE_LETTER:  'Experience & Relieving Letter',
      CLIENT_AGREEMENT:   'Service Agreement',
    }[t] ?? 'Letter';
  }
}
