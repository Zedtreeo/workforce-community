import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  baseLayout,
  heading,
  paragraph,
  dataTable,
  ctaButton,
  statusBadge,
  bigNumber,
  divider,
  alertBox,
  plainTextFallback,
  TenantBrand,
  escapeHtml,
} from './email-templates';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zeptomail.in',
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER || 'emailapikey',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  async send(payload: EmailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM_CONTACT || '"Legelp" <contact@legelp.com>',
        replyTo: process.env.SMTP_REPLYTO_CONTACT || 'contact@legelp.com',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        attachments: payload.attachments,
      });
      this.logger.log(`Email sent: ${payload.subject} → ${payload.to}`);
    } catch (error: any) {
      this.logger.error(`Email failed: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // LEAVE MANAGEMENT
  // ═══════════════════════════════════════════════════════

  async sendLeaveApplied(
    to: string,
    data: {
      employeeName: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      days: number;
      reason?: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('New Leave Request') +
      paragraph(`<strong>${escapeHtml(data.employeeName)}</strong> has submitted a leave request for your review.`) +
      dataTable([
        { label: 'Leave Type', value: escapeHtml(data.leaveType) },
        { label: 'From', value: escapeHtml(data.startDate) },
        { label: 'To', value: escapeHtml(data.endDate) },
        { label: 'Duration', value: `${data.days} day${data.days > 1 ? 's' : ''}` },
        ...(data.reason ? [{ label: 'Reason', value: escapeHtml(data.reason) }] : []),
      ]) +
      (data.portalUrl ? ctaButton('Review on Portal', data.portalUrl, brand?.accentColor) : '') +
      paragraph('Please review and approve or reject this request.');

    return this.send({
      to,
      subject: `Leave Request: ${data.employeeName} — ${data.leaveType} (${data.days}d)`,
      html: baseLayout(body, brand, {
        previewText: `${data.employeeName} requested ${data.days} day(s) of ${data.leaveType}`,
      }),
      text: plainTextFallback([
        { heading: 'New Leave Request', body: `${data.employeeName} has submitted a leave request.\n\nType: ${data.leaveType}\nFrom: ${data.startDate}\nTo: ${data.endDate}\nDays: ${data.days}${data.reason ? `\nReason: ${data.reason}` : ''}` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // APPRAISALS
  // ═══════════════════════════════════════════════════════

  async sendAppraisalOpen(
    to: string,
    data: { employeeName: string; cycleNumber: number; portalUrl?: string },
    brand?: Partial<TenantBrand>,
  ) {
    const yr = data.cycleNumber;
    const yrText = `${yr} year${yr > 1 ? 's' : ''}`;
    const body =
      heading(`🎉 Congratulations on ${yrText} with us!`) +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph(
        `It's time for your annual appraisal. We'd love to hear how your year went — ` +
        `please take a few minutes to complete your <strong>self-review</strong>.`,
      ) +
      (data.portalUrl ? ctaButton('Start my self-review', data.portalUrl, brand?.accentColor) : '') +
      paragraph('Your manager and HR will review it as part of your salary review. Thank you!');

    return this.send({
      to,
      subject: 'Your annual appraisal is open — complete your self-review',
      html: baseLayout(body, brand, {
        previewText: 'Your annual appraisal is open — please complete your self-review.',
      }),
      text: plainTextFallback([
        {
          heading: 'Your annual appraisal is open',
          body: `Hi ${data.employeeName},\n\nCongratulations on ${yrText} with us! It's time for your annual appraisal — please complete your self-review${data.portalUrl ? ` at ${data.portalUrl}` : ' in your employee portal'}.`,
        },
      ]),
    });
  }

  async sendLeaveDecision(
    to: string,
    data: {
      employeeName: string;
      leaveType: string;
      status: string;
      startDate: string;
      endDate: string;
      reviewNote?: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const approved = data.status === 'APPROVED';
    const color = approved ? '#16a34a' : '#dc2626';
    const statusText = approved ? 'Approved' : 'Rejected';

    const body =
      heading(`Leave ${statusText}`, color) +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph(
        `Your <strong>${escapeHtml(data.leaveType)}</strong> leave request has been ` +
        statusBadge(statusText, color),
      ) +
      dataTable([
        { label: 'From', value: escapeHtml(data.startDate) },
        { label: 'To', value: escapeHtml(data.endDate) },
        { label: 'Status', value: `<strong style="color:${color};">${statusText}</strong>` },
        ...(data.reviewNote ? [{ label: 'Note', value: escapeHtml(data.reviewNote) }] : []),
      ]) +
      (approved
        ? alertBox('Your leave has been recorded. Enjoy your time off!', 'success')
        : alertBox('Please contact your manager if you have questions about this decision.', 'info')) +
      (data.portalUrl ? ctaButton('View on Portal', data.portalUrl, brand?.accentColor) : '');

    return this.send({
      to,
      subject: `Leave ${statusText}: ${data.leaveType} (${data.startDate} – ${data.endDate})`,
      html: baseLayout(body, brand, {
        previewText: `Your ${data.leaveType} leave has been ${statusText.toLowerCase()}`,
      }),
      text: plainTextFallback([
        { heading: `Leave ${statusText}`, body: `Hi ${data.employeeName},\n\nYour ${data.leaveType} leave from ${data.startDate} to ${data.endDate} has been ${statusText.toLowerCase()}.${data.reviewNote ? `\n\nNote: ${data.reviewNote}` : ''}` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // INVOICING
  // ═══════════════════════════════════════════════════════

  async sendInvoiceGenerated(
    to: string,
    data: {
      clientName: string;
      invoiceNumber: string;
      totalAmount: string;
      currency: string;
      dueDate: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Invoice Generated') +
      paragraph(`Dear ${escapeHtml(data.clientName)},`) +
      paragraph('A new invoice has been generated for your account.') +
      bigNumber(`${escapeHtml(data.currency)} ${escapeHtml(data.totalAmount)}`, 'Amount Due') +
      dataTable([
        { label: 'Invoice #', value: escapeHtml(data.invoiceNumber) },
        { label: 'Amount', value: `${escapeHtml(data.currency)} ${escapeHtml(data.totalAmount)}` },
        { label: 'Due Date', value: escapeHtml(data.dueDate) },
      ]) +
      (data.portalUrl ? ctaButton('View Invoice', data.portalUrl, brand?.accentColor) : '') +
      paragraph('If you have any questions, please contact our accounts team.');

    return this.send({
      to,
      subject: `Invoice ${data.invoiceNumber} — ${data.currency} ${data.totalAmount}`,
      html: baseLayout(body, brand, {
        previewText: `Invoice ${data.invoiceNumber} for ${data.currency} ${data.totalAmount} is due ${data.dueDate}`,
      }),
      text: plainTextFallback([
        { heading: 'Invoice Generated', body: `Dear ${data.clientName},\n\nInvoice #${data.invoiceNumber}\nAmount: ${data.currency} ${data.totalAmount}\nDue Date: ${data.dueDate}` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // PAYROLL
  // ═══════════════════════════════════════════════════════

  async sendPayslipReady(
    to: string,
    data: {
      employeeName: string;
      month: string;
      year: number;
      netPay: string;
      currency?: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const currency = data.currency || '₹';

    const body =
      heading('Your Payslip is Ready') +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph(`Your payslip for <strong>${escapeHtml(data.month)} ${data.year}</strong> is now available.`) +
      bigNumber(`${currency}${escapeHtml(data.netPay)}`, 'Net Pay') +
      (data.portalUrl ? ctaButton('View Payslip', data.portalUrl, brand?.accentColor) : '') +
      paragraph('You can download your payslip from the Employee Portal.');

    return this.send({
      to,
      subject: `Payslip Ready — ${data.month} ${data.year}`,
      html: baseLayout(body, brand, {
        previewText: `Your ${data.month} ${data.year} payslip is ready — Net Pay: ${currency}${data.netPay}`,
      }),
      text: plainTextFallback([
        { heading: 'Payslip Ready', body: `Hi ${data.employeeName},\n\nYour payslip for ${data.month} ${data.year} is ready.\nNet Pay: ${currency}${data.netPay}\n\nView it on the Employee Portal.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════

  async sendDocumentExpiring(
    to: string,
    data: {
      employeeName: string;
      documentName: string;
      expiryDate: string;
      daysLeft: number;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const urgency = data.daysLeft <= 7 ? 'error' : data.daysLeft <= 30 ? 'warning' : 'info';

    const body =
      heading('Document Expiring Soon', '#f59e0b') +
      alertBox(
        `<strong>${escapeHtml(data.documentName)}</strong> for ${escapeHtml(data.employeeName)} expires in <strong>${data.daysLeft} day${data.daysLeft !== 1 ? 's' : ''}</strong>.`,
        urgency,
      ) +
      dataTable([
        { label: 'Employee', value: escapeHtml(data.employeeName) },
        { label: 'Document', value: escapeHtml(data.documentName) },
        { label: 'Expiry Date', value: escapeHtml(data.expiryDate) },
        { label: 'Days Left', value: `<strong style="color:${urgency === 'error' ? '#dc2626' : '#f59e0b'};">${data.daysLeft}</strong>` },
      ]) +
      (data.portalUrl ? ctaButton('Manage Documents', data.portalUrl, brand?.accentColor) : '') +
      paragraph('Please ensure the document is renewed before it expires.');

    return this.send({
      to,
      subject: `⚠️ Document Expiring: ${data.documentName} — ${data.daysLeft} days left`,
      html: baseLayout(body, brand, {
        previewText: `${data.documentName} for ${data.employeeName} expires in ${data.daysLeft} days`,
      }),
      text: plainTextFallback([
        { heading: 'Document Expiring', body: `${data.documentName} for ${data.employeeName}\nExpiry: ${data.expiryDate}\nDays Left: ${data.daysLeft}\n\nPlease renew before expiry.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // PORTAL INVITATIONS
  // ═══════════════════════════════════════════════════════

  async sendEmployeePortalInvite(
    to: string,
    data: {
      employeeName: string;
      loginUrl: string;
      tempPassword: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Welcome to the Employee Portal') +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph('Your employee portal account has been created. Here are your login details:') +
      dataTable([
        { label: 'Portal', value: `<a href="${escapeHtml(data.loginUrl)}/login" style="color:#2563eb;text-decoration:underline;">${escapeHtml(data.loginUrl)}/login</a>` },
        { label: 'Email', value: escapeHtml(to) },
        { label: 'Temporary Password', value: `<code style="font-family:monospace;font-size:15px;letter-spacing:1px;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${escapeHtml(data.tempPassword)}</code>` },
      ]) +
      alertBox('<strong>Important:</strong> Please change your password after your first login.', 'warning') +
      ctaButton('Log In Now', `${data.loginUrl}/login`, brand?.accentColor) +
      paragraph('Once logged in, you can access your attendance, leaves, payslips, and monitoring data.');

    return this.send({
      to,
      subject: 'Welcome to the Employee Portal — Your Login Credentials',
      html: baseLayout(body, brand, {
        previewText: 'Your employee portal account is ready. Log in to get started.',
      }),
      text: plainTextFallback([
        { heading: 'Welcome to the Employee Portal', body: `Hi ${data.employeeName},\n\nYour account is ready.\n\nPortal: ${data.loginUrl}/login\nEmail: ${to}\nTemp Password: ${data.tempPassword}\n\nPlease change your password after first login.` },
      ]),
    });
  }

  async sendPasswordResetLink(
    to: string,
    data: { employeeName: string; resetUrl: string },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Set Your New Password') +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph('A password reset was requested for your employee portal account. Click the button below to choose a new password. This link expires in 24 hours.') +
      ctaButton('Set New Password', data.resetUrl, brand?.accentColor) +
      paragraph(`If the button doesn't work, copy and paste this link into your browser:<br><a href="${escapeHtml(data.resetUrl)}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${escapeHtml(data.resetUrl)}</a>`) +
      alertBox('If you did not request this, you can safely ignore this email — your current password stays unchanged.', 'warning');

    return this.send({
      to,
      subject: 'Set Your Employee Portal Password',
      html: baseLayout(body, brand, { previewText: 'Set a new password for your employee portal account.' }),
      text: plainTextFallback([
        { heading: 'Set Your New Password', body: `Hi ${data.employeeName},\n\nA password reset was requested. Open this link to set a new password (expires in 24 hours):\n${data.resetUrl}\n\nIf you did not request this, ignore this email.` },
      ]),
    });
  }

  async sendPortalAccessLink(
    to: string,
    data: { employeeName: string; setupUrl: string },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Welcome to the Employee Portal') +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph('Your employee portal account has been created. Click the button below to set your password and activate your account. This link expires in 24 hours.') +
      ctaButton('Set Your Password', data.setupUrl, brand?.accentColor) +
      paragraph(`If the button doesn't work, copy and paste this link into your browser:<br><a href="${escapeHtml(data.setupUrl)}" style="color:#2563eb;text-decoration:underline;word-break:break-all;">${escapeHtml(data.setupUrl)}</a>`) +
      paragraph('Once set, you can log in to access your attendance, leaves, payslips, and more.');

    return this.send({
      to,
      subject: 'Welcome to the Employee Portal — Set Your Password',
      html: baseLayout(body, brand, { previewText: 'Set your password to activate your employee portal account.' }),
      text: plainTextFallback([
        { heading: 'Welcome to the Employee Portal', body: `Hi ${data.employeeName},\n\nYour account is ready. Set your password here (expires in 24 hours):\n${data.setupUrl}\n\nThen log in to access your portal.` },
      ]),
    });
  }

  async sendClientPortalInvite(
    to: string,
    data: {
      name: string;
      clientName: string;
      loginUrl: string;
      tempPassword: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Welcome to the Client Portal') +
      paragraph(`Hi ${escapeHtml(data.name)},`) +
      paragraph(`You've been invited to access the <strong>${escapeHtml(data.clientName)}</strong> portal.`) +
      dataTable([
        { label: 'Portal', value: `<a href="${escapeHtml(data.loginUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(data.loginUrl)}</a>` },
        { label: 'Email', value: escapeHtml(to) },
        { label: 'Temporary Password', value: `<code style="font-family:monospace;font-size:15px;letter-spacing:1px;background:#f1f5f9;padding:4px 8px;border-radius:4px;">${escapeHtml(data.tempPassword)}</code>` },
      ]) +
      alertBox('<strong>Important:</strong> Please change your password after your first login.', 'warning') +
      ctaButton('Log In Now', data.loginUrl, brand?.accentColor) +
      paragraph('You can view team assignments, invoices, and resource activity from the portal.');

    return this.send({
      to,
      subject: `You've been invited to the Client Portal — ${data.clientName}`,
      html: baseLayout(body, brand, {
        previewText: `Access the ${data.clientName} client portal to view your team and invoices.`,
      }),
      text: plainTextFallback([
        { heading: 'Client Portal Invite', body: `Hi ${data.name},\n\nYou've been invited to the ${data.clientName} portal.\n\nPortal: ${data.loginUrl}\nEmail: ${to}\nTemp Password: ${data.tempPassword}\n\nPlease change your password after first login.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: WELCOME / ONBOARDING
  // ═══════════════════════════════════════════════════════

  async sendWelcomeOnboarding(
    to: string,
    data: {
      employeeName: string;
      joiningDate: string;
      department: string;
      designation: string;
      managerName?: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const companyName = brand?.companyName || 'HRMS Platform';

    const body =
      heading(`Welcome to ${escapeHtml(companyName)}!`) +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph(`We're excited to have you on board! Here are your onboarding details:`) +
      dataTable([
        { label: 'Joining Date', value: escapeHtml(data.joiningDate) },
        { label: 'Department', value: escapeHtml(data.department) },
        { label: 'Designation', value: escapeHtml(data.designation) },
        ...(data.managerName ? [{ label: 'Reporting To', value: escapeHtml(data.managerName) }] : []),
      ]) +
      divider() +
      paragraph('<strong>What to expect next:</strong>') +
      paragraph('1. You\'ll receive your portal login credentials separately<br/>2. Complete your profile on the Employee Portal<br/>3. Review company policies and handbook<br/>4. Connect with your team') +
      (data.portalUrl ? ctaButton('Go to Portal', data.portalUrl, brand?.accentColor) : '') +
      paragraph(`Welcome aboard, ${escapeHtml(data.employeeName)}! We look forward to working with you.`);

    return this.send({
      to,
      subject: `Welcome to ${companyName}, ${data.employeeName}!`,
      html: baseLayout(body, brand, {
        previewText: `Welcome to ${companyName}! Your onboarding details are inside.`,
      }),
      text: plainTextFallback([
        { heading: `Welcome to ${companyName}!`, body: `Hi ${data.employeeName},\n\nWelcome aboard!\n\nJoining Date: ${data.joiningDate}\nDepartment: ${data.department}\nDesignation: ${data.designation}${data.managerName ? `\nReporting To: ${data.managerName}` : ''}\n\nPlease check the Employee Portal for next steps.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: PASSWORD RESET
  // ═══════════════════════════════════════════════════════

  async sendPasswordReset(
    to: string,
    data: {
      userName: string;
      resetUrl: string;
      expiresInMinutes?: number;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const expires = data.expiresInMinutes || 30;

    const body =
      heading('Password Reset Request') +
      paragraph(`Hi ${escapeHtml(data.userName)},`) +
      paragraph('We received a request to reset your password. Click the button below to create a new password:') +
      ctaButton('Reset Password', data.resetUrl, brand?.accentColor) +
      alertBox(`This link expires in <strong>${expires} minutes</strong>. If you didn't request this, you can safely ignore this email.`, 'warning') +
      divider() +
      paragraph('<span style="font-size:13px;color:#94a3b8;">If the button doesn\'t work, copy and paste this URL into your browser:</span>') +
      paragraph(`<span style="font-size:12px;color:#64748b;word-break:break-all;">${escapeHtml(data.resetUrl)}</span>`);

    return this.send({
      to,
      subject: 'Reset Your Password',
      html: baseLayout(body, brand, {
        previewText: 'Password reset requested. This link expires in ' + expires + ' minutes.',
      }),
      text: plainTextFallback([
        { heading: 'Password Reset', body: `Hi ${data.userName},\n\nReset your password here:\n${data.resetUrl}\n\nThis link expires in ${expires} minutes.\n\nIf you didn't request this, ignore this email.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: TAMPER ALERT (ADMIN)
  // ═══════════════════════════════════════════════════════

  async sendTamperAlert(
    to: string,
    data: {
      employeeName: string;
      employeeCode: string;
      alertType: string;
      description: string;
      timestamp: string;
      deviceInfo?: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('🚨 Tamper Alert Detected', '#dc2626') +
      alertBox(
        `A monitoring alert has been triggered for <strong>${escapeHtml(data.employeeName)}</strong> (${escapeHtml(data.employeeCode)}).`,
        'error',
      ) +
      dataTable([
        { label: 'Employee', value: `${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})` },
        { label: 'Alert Type', value: `<strong style="color:#dc2626;">${escapeHtml(data.alertType)}</strong>` },
        { label: 'Description', value: escapeHtml(data.description) },
        { label: 'Timestamp', value: escapeHtml(data.timestamp) },
        ...(data.deviceInfo ? [{ label: 'Device', value: escapeHtml(data.deviceInfo) }] : []),
      ]) +
      (data.portalUrl ? ctaButton('Review in Monitoring', data.portalUrl, '#dc2626') : '') +
      paragraph('Please investigate this alert promptly. Repeated alerts may indicate policy violations.');

    return this.send({
      to,
      subject: `🚨 Tamper Alert: ${data.employeeName} — ${data.alertType}`,
      html: baseLayout(body, brand, {
        previewText: `Tamper alert for ${data.employeeName}: ${data.alertType}`,
      }),
      text: plainTextFallback([
        { heading: 'TAMPER ALERT', body: `Employee: ${data.employeeName} (${data.employeeCode})\nAlert: ${data.alertType}\nDescription: ${data.description}\nTime: ${data.timestamp}${data.deviceInfo ? `\nDevice: ${data.deviceInfo}` : ''}\n\nPlease investigate immediately.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: ATTENDANCE REMINDER
  // ═══════════════════════════════════════════════════════

  async sendAttendanceReminder(
    to: string,
    data: {
      employeeName: string;
      date: string;
      shiftTime: string;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading('Attendance Reminder') +
      paragraph(`Hi ${escapeHtml(data.employeeName)},`) +
      paragraph('This is a friendly reminder to check in for your shift today.') +
      dataTable([
        { label: 'Date', value: escapeHtml(data.date) },
        { label: 'Shift', value: escapeHtml(data.shiftTime) },
      ]) +
      (data.portalUrl ? ctaButton('Check In Now', data.portalUrl, brand?.accentColor) : '') +
      paragraph('If you\'re unable to attend, please apply for leave on the portal or contact your manager.');

    return this.send({
      to,
      subject: `Attendance Reminder — ${data.date}`,
      html: baseLayout(body, brand, {
        previewText: `Don't forget to check in today. Your shift starts at ${data.shiftTime}.`,
      }),
      text: plainTextFallback([
        { heading: 'Attendance Reminder', body: `Hi ${data.employeeName},\n\nPlease check in for your shift.\nDate: ${data.date}\nShift: ${data.shiftTime}\n\nIf you can't attend, apply for leave or contact your manager.` },
      ]),
    });
  }

  // ═══════════════════════════════════════════════════════
  // NEW: MONTHLY SUMMARY DIGEST
  // ═══════════════════════════════════════════════════════

  async sendMonthlySummary(
    to: string,
    data: {
      recipientName: string;
      month: string;
      year: number;
      totalEmployees: number;
      activeAssignments: number;
      leavesApproved: number;
      invoicesGenerated: number;
      revenueCollected: string;
      currency: string;
      alertsCount: number;
      portalUrl?: string;
    },
    brand?: Partial<TenantBrand>,
  ) {
    const body =
      heading(`Monthly Summary — ${escapeHtml(data.month)} ${data.year}`) +
      paragraph(`Hi ${escapeHtml(data.recipientName)},`) +
      paragraph(`Here's your monthly overview for <strong>${escapeHtml(data.month)} ${data.year}</strong>:`) +
      divider() +

      // Workforce
      paragraph('<strong style="font-size:16px;">👥 Workforce</strong>') +
      dataTable([
        { label: 'Total Employees', value: String(data.totalEmployees) },
        { label: 'Active Assignments', value: String(data.activeAssignments) },
        { label: 'Leaves Approved', value: String(data.leavesApproved) },
      ]) +

      // Revenue
      paragraph('<strong style="font-size:16px;">💰 Revenue</strong>') +
      bigNumber(
        `${escapeHtml(data.currency)} ${escapeHtml(data.revenueCollected)}`,
        'Revenue Collected',
      ) +
      dataTable([
        { label: 'Invoices Generated', value: String(data.invoicesGenerated) },
      ]) +

      // Monitoring
      (data.alertsCount > 0
        ? alertBox(`<strong>${data.alertsCount}</strong> tamper alert${data.alertsCount > 1 ? 's' : ''} detected this month. Review in the Monitoring dashboard.`, 'warning')
        : alertBox('No tamper alerts this month.', 'success')) +

      (data.portalUrl ? ctaButton('View Full Dashboard', data.portalUrl, brand?.accentColor) : '');

    return this.send({
      to,
      subject: `Monthly Summary — ${data.month} ${data.year}`,
      html: baseLayout(body, brand, {
        previewText: `${data.month} ${data.year}: ${data.totalEmployees} employees, ${data.currency} ${data.revenueCollected} collected`,
      }),
      text: plainTextFallback([
        { heading: `Monthly Summary — ${data.month} ${data.year}`, body: `Hi ${data.recipientName},\n\nWorkforce:\n- Employees: ${data.totalEmployees}\n- Active Assignments: ${data.activeAssignments}\n- Leaves Approved: ${data.leavesApproved}\n\nRevenue:\n- Collected: ${data.currency} ${data.revenueCollected}\n- Invoices: ${data.invoicesGenerated}\n\nAlerts: ${data.alertsCount}` },
      ]),
    });
  }
}
