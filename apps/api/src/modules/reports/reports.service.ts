import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Attendance Report ──────────────────────────────

  async attendanceReport(
    tenantId: string,
    params: { startDate: string; endDate: string; employeeId?: string; departmentId?: string },
  ) {
    const { startDate, endDate, employeeId, departmentId } = params;

    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
      ...(employeeId && { employeeId }),
      ...(departmentId && { employee: { departmentId } }),
    };

    const records = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { firstName: 'asc' } }],
    });

    // Summary per employee
    const empMap: Record<string, {
      employee: any;
      present: number;
      absent: number;
      halfDay: number;
      leave: number;
      wfh: number;
      totalDays: number;
    }> = {};

    for (const rec of records) {
      if (!empMap[rec.employeeId]) {
        empMap[rec.employeeId] = {
          employee: rec.employee,
          present: 0, absent: 0, halfDay: 0, leave: 0, wfh: 0, totalDays: 0,
        };
      }
      const e = empMap[rec.employeeId];
      e.totalDays++;
      if (rec.status === 'PRESENT') e.present++;
      else if (rec.status === 'ABSENT') e.absent++;
      else if (rec.status === 'HALF_DAY') e.halfDay++;
      else if (rec.status === 'LEAVE') e.leave++;
      else if (rec.status === 'WFH') e.wfh++;
    }

    return {
      period: { startDate, endDate },
      totalRecords: records.length,
      summary: Object.values(empMap),
      records: records.map((r) => ({
        date: r.date,
        employeeId: r.employeeId,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeCode: r.employee.employeeCode,
        department: r.employee.department?.name || null,
        status: r.status,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        workHours: r.workHours ? Number(r.workHours) : null,
      })),
    };
  }

  // ── Work Hours Report (from monitoring time logs) ──

  async workHoursReport(
    tenantId: string,
    params: { startDate: string; endDate: string; employeeId?: string },
  ) {
    const { startDate, endDate, employeeId } = params;

    const where: Prisma.TimeLogWhereInput = {
      tenantId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
      ...(employeeId && { employeeId }),
    };

    const timeLogs = await this.prisma.timeLog.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
        },
      },
      orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
    });

    // Aggregate per employee per day
    const dailyMap: Record<string, Record<string, { totalSeconds: number; sessions: number }>> = {};

    for (const tl of timeLogs) {
      const dateKey = new Date(tl.date).toISOString().split('T')[0];
      if (!dailyMap[tl.employeeId]) dailyMap[tl.employeeId] = {};
      if (!dailyMap[tl.employeeId][dateKey]) dailyMap[tl.employeeId][dateKey] = { totalSeconds: 0, sessions: 0 };

      const entry = dailyMap[tl.employeeId][dateKey];
      entry.sessions++;
      if (tl.duration) {
        entry.totalSeconds += tl.duration;
      } else if (tl.clockOut) {
        entry.totalSeconds += Math.floor((tl.clockOut.getTime() - tl.clockIn.getTime()) / 1000);
      }
    }

    // Build employee summaries
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(employeeId && { id: employeeId }),
        id: { in: [...new Set(timeLogs.map((t) => t.employeeId))] },
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
      orderBy: { firstName: 'asc' },
    });

    const summary = employees.map((emp) => {
      const days = dailyMap[emp.id] || {};
      const dayEntries = Object.entries(days);
      const totalSeconds = dayEntries.reduce((s, [, d]) => s + d.totalSeconds, 0);
      const totalHours = +(totalSeconds / 3600).toFixed(2);
      const daysWorked = dayEntries.length;
      const avgHoursPerDay = daysWorked > 0 ? +(totalHours / daysWorked).toFixed(2) : 0;

      return {
        employee: emp,
        daysWorked,
        totalHours,
        avgHoursPerDay,
        dailyBreakdown: dayEntries.map(([date, d]) => ({
          date,
          hours: +(d.totalSeconds / 3600).toFixed(2),
          sessions: d.sessions,
        })),
      };
    });

    return {
      period: { startDate, endDate },
      summary,
    };
  }

  // ── Client Billing Summary ─────────────────────────

  async billingReport(
    tenantId: string,
    params: { year?: number; clientId?: string },
  ) {
    const year = params.year ?? new Date().getFullYear();

    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      periodStart: { gte: new Date(`${year}-01-01`) },
      periodEnd: { lt: new Date(`${year + 1}-01-01`) },
      ...(params.clientId && { clientId: params.clientId }),
    };

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, country: true, currency: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    // Group by client
    const clientMap: Record<string, {
      client: any;
      invoiceCount: number;
      totalBilled: number;
      totalPaid: number;
      totalOutstanding: number;
      currency: string;
    }> = {};

    for (const inv of invoices) {
      if (!clientMap[inv.clientId]) {
        clientMap[inv.clientId] = {
          client: inv.client,
          invoiceCount: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          currency: inv.currency,
        };
      }
      const c = clientMap[inv.clientId];
      c.invoiceCount++;
      c.totalBilled += Number(inv.total);
      if (inv.status === 'PAID') c.totalPaid += Number(inv.paidAmount ?? inv.total);
      if (inv.status === 'SENT' || inv.status === 'OVERDUE') c.totalOutstanding += Number(inv.total);
    }

    const clients = Object.values(clientMap).map((c) => ({
      ...c,
      totalBilled: +c.totalBilled.toFixed(2),
      totalPaid: +c.totalPaid.toFixed(2),
      totalOutstanding: +c.totalOutstanding.toFixed(2),
    }));

    const grandTotal = {
      totalBilled: +clients.reduce((s, c) => s + c.totalBilled, 0).toFixed(2),
      totalPaid: +clients.reduce((s, c) => s + c.totalPaid, 0).toFixed(2),
      totalOutstanding: +clients.reduce((s, c) => s + c.totalOutstanding, 0).toFixed(2),
      invoiceCount: invoices.length,
    };

    return { year, clients, grandTotal, invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      clientName: i.client.name,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      total: Number(i.total),
      currency: i.currency,
      status: i.status,
      paidAt: i.paidAt,
    })) };
  }

  // ── Employee Productivity (from activity snapshots) ──

  async productivityReport(
    tenantId: string,
    params: { startDate: string; endDate: string; employeeId?: string },
  ) {
    const { startDate, endDate, employeeId } = params;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // inclusive

    const snapGroups = await this.prisma.activitySnapshot.groupBy({
      by: ['employeeId'],
      where: {
        tenantId,
        capturedAt: { gte: start, lt: end },
        ...(employeeId && { employeeId }),
      },
      _avg: { activityPercent: true },
      _sum: { keystrokes: true, mouseClicks: true },
      _count: true,
    });

    const employeeIds = snapGroups.map((g) => g.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, tenantId },
      select: {
        id: true, firstName: true, lastName: true, employeeCode: true, designation: true,
        assignments: { where: { status: 'ACTIVE' }, select: { client: { select: { name: true } } }, take: 1 },
      },
    });
    const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

    // Also get time log hours
    const timeLogAgg = await this.prisma.timeLog.groupBy({
      by: ['employeeId'],
      where: {
        tenantId,
        date: { gte: new Date(startDate), lte: new Date(endDate) },
        ...(employeeId && { employeeId }),
      },
      _sum: { duration: true },
    });
    const hoursMap = Object.fromEntries(
      timeLogAgg.map((t) => [t.employeeId, +((t._sum.duration ?? 0) / 3600).toFixed(2)]),
    );

    const results = snapGroups.map((g) => {
      const emp = empMap[g.employeeId];
      return {
        employee: emp ? {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          employeeCode: emp.employeeCode,
          designation: emp.designation,
          clientName: emp.assignments[0]?.client?.name ?? null,
        } : { id: g.employeeId, name: 'Unknown', employeeCode: '', designation: null, clientName: null },
        avgActivity: Math.round(g._avg.activityPercent ?? 0),
        totalSnapshots: g._count,
        totalKeystrokes: g._sum.keystrokes ?? 0,
        totalClicks: g._sum.mouseClicks ?? 0,
        totalWorkHours: hoursMap[g.employeeId] ?? 0,
      };
    }).sort((a, b) => b.avgActivity - a.avgActivity);

    return {
      period: { startDate, endDate },
      employees: results,
      teamAvgActivity: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.avgActivity, 0) / results.length)
        : 0,
    };
  }

  // ── Leave Summary ──────────────────────────────────

  async leaveSummary(
    tenantId: string,
    params: { year?: number; employeeId?: string },
  ) {
    const year = params.year ?? new Date().getFullYear();

    const balances = await this.prisma.leaveBalance.findMany({
      where: {
        tenantId,
        year,
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true, isPaid: true } },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { leaveType: { name: 'asc' } }],
    });

    // Group by employee
    const grouped: Record<string, {
      employee: any;
      types: { leaveType: any; entitled: number; used: number; available: number }[];
      totalEntitled: number;
      totalUsed: number;
      totalAvailable: number;
    }> = {};

    for (const b of balances) {
      if (!grouped[b.employeeId]) {
        grouped[b.employeeId] = {
          employee: b.employee,
          types: [],
          totalEntitled: 0,
          totalUsed: 0,
          totalAvailable: 0,
        };
      }
      const available = Number(b.entitled) + Number(b.carriedOver) + Number(b.adjustment) - Number(b.used);
      grouped[b.employeeId].types.push({
        leaveType: b.leaveType,
        entitled: Number(b.entitled),
        used: Number(b.used),
        available,
      });
      grouped[b.employeeId].totalEntitled += Number(b.entitled);
      grouped[b.employeeId].totalUsed += Number(b.used);
      grouped[b.employeeId].totalAvailable += available;
    }

    // Recent leave requests
    const recentRequests = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      year,
      employees: Object.values(grouped),
      recentRequests: recentRequests.map((r) => ({
        id: r.id,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeCode: r.employee.employeeCode,
        leaveType: r.leaveType.name,
        leaveCode: r.leaveType.code,
        startDate: r.startDate,
        endDate: r.endDate,
        days: Number(r.days),
        status: r.status,
        reason: r.reason,
      })),
    };
  }
}
