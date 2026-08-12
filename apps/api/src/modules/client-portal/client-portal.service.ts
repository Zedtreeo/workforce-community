import {
  Injectable, UnauthorizedException, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { sendLoginOtpEmail } from '../../auth/otp-mailer';

const OTP_TTL_MIN = 5;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────── Auth (email OTP, gated by client email) ───────────────────────

  /** Send a 6-digit OTP to a client's portal email. Always returns generic ok (no email enumeration). */
  async sendOtp(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const client = await this.prisma.client.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, portalEnabled: true, isActive: true, deletedAt: null },
      select: { id: true, name: true, tenantId: true, email: true },
    });
    if (!client) return { ok: true };

    let user = await this.prisma.clientPortalUser.findFirst({
      where: { tenantId: client.tenantId, email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) {
      user = await this.prisma.clientPortalUser.create({
        data: { tenantId: client.tenantId, clientId: client.id, name: client.name, email: client.email, isActive: true },
      });
    }
    if (!user.isActive) return { ok: true };

    // Demo: client emails are placeholders and we don't round-trip a real inbox, so skip
    // sending/storing an OTP — verifyOtp accepts a fixed demo code instead.
    if (process.env.DEMO_MODE === 'true') return { ok: true };

    const otp = String(crypto.randomInt(100000, 1000000)); // 6 digits
    const otpHash = await bcrypt.hash(otp, 10);
    await this.prisma.clientPortalUser.update({
      where: { id: user.id },
      data: { otpHash, otpExpiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000), otpAttempts: 0 },
    });
    await sendLoginOtpEmail(client.email, otp, OTP_TTL_MIN);
    return { ok: true };
  }

  /** Verify the OTP and issue a client-portal session token. */
  async verifyOtp(emailRaw: string, otp: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.clientPortalUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
      include: { client: { select: { id: true, name: true, portalEnabled: true, isActive: true, deletedAt: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired code. Request a new one.');
    }
    if (!user.client.portalEnabled || !user.client.isActive || user.client.deletedAt) {
      throw new UnauthorizedException('Portal access is not enabled for this account.');
    }

    // Demo: accept a fixed code (no OTP email/write); issue the session token directly.
    if (process.env.DEMO_MODE === 'true') {
      const demoCode = process.env.DEMO_CLIENT_OTP || '123456';
      if (otp !== demoCode) throw new UnauthorizedException('Incorrect code.');
      const secret = process.env.BETTER_AUTH_SECRET;
      if (!secret) throw new Error('BETTER_AUTH_SECRET is required');
      const token = jwt.sign(
        { sub: user.id, clientId: user.clientId, tenantId: user.tenantId, type: 'client-portal' },
        secret, { expiresIn: '12h' },
      );
      return { token, user: { id: user.id, name: user.name, email: user.email, clientName: user.client.name } };
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      throw new UnauthorizedException('Invalid or expired code. Request a new one.');
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Code expired. Request a new one.');
    }
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }
    const valid = await bcrypt.compare(otp, user.otpHash);
    if (!valid) {
      await this.prisma.clientPortalUser.update({
        where: { id: user.id }, data: { otpAttempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Incorrect code.');
    }

    await this.prisma.clientPortalUser.update({
      where: { id: user.id },
      data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0, lastLoginAt: new Date() },
    });

    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new Error('BETTER_AUTH_SECRET is required');
    const token = jwt.sign(
      { sub: user.id, clientId: user.clientId, tenantId: user.tenantId, type: 'client-portal' },
      secret, { expiresIn: '12h' },
    );
    return { token, user: { id: user.id, name: user.name, email: user.email, clientName: user.client.name } };
  }

  // ─────────────────────── Admin: enable/disable portal per client ───────────────────────

  async getAccess(tenantId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true, email: true, portalEnabled: true, portalUsers: { select: { lastLoginAt: true } } },
    });
    if (!client) throw new NotFoundException('Client not found');
    return {
      portalEnabled: client.portalEnabled,
      email: client.email,
      lastLoginAt: client.portalUsers[0]?.lastLoginAt ?? null,
    };
  }

  async setAccess(tenantId: string, clientId: string, enabled: boolean) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, tenantId, deletedAt: null },
      select: { id: true, email: true, name: true },
    });
    if (!client) throw new NotFoundException('Client not found');
    if (enabled && !client.email?.trim()) {
      throw new BadRequestException('Add an email to this client before enabling portal access.');
    }
    await this.prisma.client.update({ where: { id: clientId }, data: { portalEnabled: enabled } });

    if (enabled) {
      const existing = await this.prisma.clientPortalUser.findFirst({ where: { tenantId, email: client.email } });
      if (!existing) {
        await this.prisma.clientPortalUser.create({
          data: { tenantId, clientId, name: client.name, email: client.email, isActive: true },
        });
      } else if (!existing.isActive) {
        await this.prisma.clientPortalUser.update({ where: { id: existing.id }, data: { isActive: true } });
      }
    }
    return { portalEnabled: enabled, email: client.email };
  }

  // ─────────────────────── Client-facing data (scoped to clientId; NO salary/billingRate) ───────────────────────

  // Public company info for the client portal (contact details only).
  async getCompany(tenantId: string) {
    return this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, website: true, phone: true, address: true, logo: true },
    });
  }

  // Company holidays are tenant-wide (the client's staff observe them).
  async getHolidays(tenantId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    return this.prisma.holiday.findMany({
      where: { tenantId, year: targetYear },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, name: true, isOptional: true },
    });
  }

  async getDashboard(tenantId: string, clientId: string) {
    const [client, activeStaff, totalInvoices, openInvoices, recentInvoices] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId, tenantId },
        select: { name: true, email: true, country: true, currency: true },
      }),
      this.prisma.employeeAssignment.count({ where: { clientId, tenantId, status: 'ACTIVE' } }),
      this.prisma.invoice.count({ where: { clientId, tenantId } }),
      this.prisma.invoice.count({ where: { clientId, tenantId, status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] } } }),
      this.prisma.invoice.findMany({
        where: { clientId, tenantId },
        orderBy: { invoiceDate: 'desc' }, take: 5,
        select: { id: true, invoiceNumber: true, total: true, currency: true, status: true, invoiceDate: true, dueDate: true },
      }),
    ]);
    return { client, activeStaff, totalInvoices, openInvoices, recentInvoices };
  }

  /** Assigned staff — name/role/schedule only. Never billingRate, salary, or bank details. */
  async getTeam(tenantId: string, clientId: string) {
    return this.prisma.employeeAssignment.findMany({
      where: { clientId, tenantId, status: 'ACTIVE' },
      select: {
        id: true, role: true, workSchedule: true, startDate: true, status: true,
        employee: { select: { firstName: true, lastName: true, designation: true, employeeCode: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  private async assignedEmployees(tenantId: string, clientId: string) {
    const assignments = await this.prisma.employeeAssignment.findMany({
      where: { clientId, tenantId, status: 'ACTIVE' },
      select: { employeeId: true, employee: { select: { firstName: true, lastName: true } } },
    });
    const nameById: Record<string, string> = {};
    for (const a of assignments) nameById[a.employeeId] = `${a.employee.firstName} ${a.employee.lastName}`;
    return { ids: assignments.map((a) => a.employeeId), nameById };
  }

  /** Attendance: daily records + monthly per-employee summary for assigned staff. */
  async getAttendance(tenantId: string, clientId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1;
    const y = year || now.getUTCFullYear();
    const { ids, nameById } = await this.assignedEmployees(tenantId, clientId);
    if (!ids.length) return { month: m, year: y, summary: [], records: [] };

    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    const records = await this.prisma.attendance.findMany({
      where: { tenantId, employeeId: { in: ids }, date: { gte: start, lte: end } },
      select: { employeeId: true, date: true, status: true, checkIn: true, checkOut: true, workHours: true },
      orderBy: { date: 'desc' },
    });

    const summary = ids.map((id) => {
      const recs = records.filter((r) => r.employeeId === id);
      const count = (s: string) => recs.filter((r) => r.status === s).length;
      return {
        employeeId: id,
        name: nameById[id],
        present: count('PRESENT') + count('WFH'),
        absent: count('ABSENT'),
        leave: count('LEAVE'),
        halfDay: count('HALF_DAY'),
        wfh: count('WFH'),
        totalHours: Math.round(recs.reduce((s, r) => s + Number(r.workHours || 0), 0) * 10) / 10,
      };
    });

    const recordsOut = records.map((r) => ({ ...r, name: nameById[r.employeeId] }));
    return { month: m, year: y, summary, records: recordsOut };
  }

  /** Leave requests for assigned staff — type/dates/days/status only (no reason, for privacy). */
  async getLeave(tenantId: string, clientId: string, year?: number) {
    const { ids, nameById } = await this.assignedEmployees(tenantId, clientId);
    if (!ids.length) return [];
    const y = year || new Date().getUTCFullYear();
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        employeeId: { in: ids },
        startDate: { gte: new Date(Date.UTC(y, 0, 1)), lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) },
      },
      select: {
        id: true, employeeId: true, startDate: true, endDate: true, days: true, status: true,
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 300,
    });
    return requests.map((r) => ({ ...r, name: nameById[r.employeeId] }));
  }

  async getInvoices(tenantId: string, clientId: string) {
    return this.prisma.invoice.findMany({
      where: { clientId, tenantId },
      orderBy: { invoiceDate: 'desc' },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, periodStart: true, periodEnd: true,
        subtotal: true, taxPercent: true, taxAmount: true, total: true, currency: true, status: true,
        paidAt: true, paidAmount: true, payoneerLink: true,
      },
    });
  }

  async getInvoiceDetail(tenantId: string, clientId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, clientId, tenantId },
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, dueDate: true, periodStart: true, periodEnd: true,
        subtotal: true, taxPercent: true, taxAmount: true, total: true, currency: true, status: true,
        notes: true, paymentTerms: true, payoneerLink: true, paidAt: true, paidAmount: true,
        lineItems: {
          select: { description: true, quantity: true, rate: true, amount: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
        client: { select: { name: true, email: true, country: true, currency: true, registeredAddress: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
