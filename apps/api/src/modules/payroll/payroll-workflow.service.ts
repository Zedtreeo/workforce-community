import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { PayrollService } from './payroll.service';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PayrollWorkflowService handles the 7-stage payroll pipeline:
 * 1. Attendance Collection (handled by AttendanceService)
 * 2. Consolidation — merge agent + manual data
 * 3. Rectification — admin reviews and locks attendance
 * 4. Run Payroll — compute using pay structures
 * 5. Review & Modify — admin adjusts individual payslips
 * 6. Freeze — lock payroll, generate bank XLSX
 * 7. Finalize — generate payslips, push to portal
 */
@Injectable()
export class PayrollWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollService: PayrollService,
  ) {}

  // ── Monthly attendance summary upload (overrides agent/web for payroll) ──

  async getMonthlyAttendance(tenantId: string, month: number, year: number) {
    const rows = await this.prisma.monthlyAttendanceOverride.findMany({
      where: { tenantId, month, year },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    });
    return rows
      .map((r) => ({
        id: r.id,
        employeeCode: r.employee.employeeCode,
        name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
        workingDays: Number(r.workingDays),
        timeoff: Number(r.timeoff),
        overTime: Number(r.overTime),
        lateCount: r.lateCount,
        earlyCount: r.earlyCount,
      }))
      .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
  }

  /** Clear ALL uploaded monthly attendance for a month (re-upload or revert). */
  async clearMonthlyAttendance(tenantId: string, month: number, year: number) {
    const res = await this.prisma.monthlyAttendanceOverride.deleteMany({
      where: { tenantId, month, year },
    });
    return { deleted: res.count };
  }

  /** Delete a single uploaded row (fix one employee without re-uploading). */
  async deleteMonthlyAttendanceRow(tenantId: string, id: string) {
    const res = await this.prisma.monthlyAttendanceOverride.deleteMany({
      where: { id, tenantId },
    });
    return { deleted: res.count };
  }

  async parseMonthlyAttendanceXlsx(buffer: Buffer): Promise<any[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const rows: any[] = [];
    let headers: string[] = [];
    ws.eachRow((row, i) => {
      const vals = ((row.values as any[]) || []).slice(1).map((v) => (v == null ? '' : String(v).trim()));
      if (i === 1) { headers = vals.map((h) => h.toLowerCase()); return; }
      const get = (name: string) => { const idx = headers.indexOf(name); return idx >= 0 ? vals[idx] : ''; };
      const code = get('employee id') || vals[0];
      if (!code) return;
      rows.push({
        employeeCode: code,
        workingDays: get('working days'),
        timeoff: get('timeoff'),
        overTime: get('over time'),
        lateCount: get('late count'),
        earlyCount: get('early count'),
      });
    });
    return rows;
  }

  async uploadMonthlyAttendance(
    tenantId: string, month: number, year: number,
    rows: Array<{ employeeCode: string; workingDays: any; timeoff?: any; overTime?: any; lateCount?: any; earlyCount?: any }>,
    userId: string,
  ) {
    if (!month || !year) throw new BadRequestException('month and year are required');
    // Re-upload is always allowed (admin correcting attendance) — overrides are upserted
    // even if the month was previously locked. The override is the source of truth for pay.

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, employeeCode: true },
    });
    const codeToId = new Map(employees.map((e) => [e.employeeCode, e.id]));
    const num = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

    let imported = 0, skipped = 0;
    const errors: string[] = [];
    const matched: string[] = [];
    for (const r of rows) {
      const code = String(r.employeeCode ?? '').trim();
      if (!code) { skipped++; continue; }
      const employeeId = codeToId.get(code);
      if (!employeeId) { errors.push(`Employee code ${code} not found`); skipped++; continue; }
      await this.prisma.monthlyAttendanceOverride.upsert({
        where: { tenantId_employeeId_year_month: { tenantId, employeeId, year, month } },
        update: { workingDays: num(r.workingDays), timeoff: num(r.timeoff), overTime: num(r.overTime), lateCount: Math.round(num(r.lateCount)), earlyCount: Math.round(num(r.earlyCount)), source: 'UPLOAD', uploadedBy: userId },
        create: { tenantId, employeeId, year, month, workingDays: num(r.workingDays), timeoff: num(r.timeoff), overTime: num(r.overTime), lateCount: Math.round(num(r.lateCount)), earlyCount: Math.round(num(r.earlyCount)), source: 'UPLOAD', uploadedBy: userId },
      });
      imported++; matched.push(code);
    }
    return { month, year, imported, skipped, errors, matched, totalEmployeesInSystem: employees.length };
  }

  // ── Stage 2: Consolidation ────────────────────────

  async consolidateAttendance(tenantId: string, month: number, year: number, userId: string) {
    // Check if consolidation already exists
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM attendance_consolidations WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      tenantId, month, year
    );

    if (existing.length > 0 && existing[0].status !== 'OPEN') {
      throw new ConflictException(`Attendance for ${month}/${year} is already ${existing[0].status}`);
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // Get all active employees
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    // Merge monitoring clock-in data into attendance records where missing
    for (const emp of employees) {
      // Get monitoring time logs for the month
      const timeLogs = await this.prisma.timeLog.findMany({
        where: {
          tenantId,
          employeeId: emp.id,
          date: { gte: monthStart, lte: monthEnd },
        },
        orderBy: { date: 'asc' },
      });

      for (const log of timeLogs) {
        const logDate = new Date(log.date);
        logDate.setHours(0, 0, 0, 0);

        // Check if manual attendance exists for this date
        const existingAtt = await this.prisma.attendance.findFirst({
          where: { tenantId, employeeId: emp.id, date: logDate },
        });

        if (!existingAtt) {
          // Create attendance from agent data
          await this.prisma.attendance.create({
            data: {
              tenantId,
              employeeId: emp.id,
              date: logDate,
              status: 'PRESENT',
              checkIn: log.clockIn,
              checkOut: log.clockOut,
              workHours: log.duration ? Number(log.duration) : null,
              source: 'SYSTEM',
              notes: 'Auto-generated from desktop agent',
            },
          });
        }
      }
    }

    // Calculate summary stats
    const stats = await this.prisma.attendance.groupBy({
      by: ['status'],
      where: {
        tenantId,
        date: { gte: monthStart, lte: monthEnd },
      },
      _count: true,
    });

    const totalPresent = stats.find(s => s.status === 'PRESENT')?._count || 0;
    const totalAbsent = stats.find(s => s.status === 'ABSENT')?._count || 0;
    const totalHalfDay = stats.find(s => s.status === 'HALF_DAY')?._count || 0;
    const totalLeave = stats.find(s => s.status === 'LEAVE')?._count || 0;

    // Count LOP from unpaid leaves
    const unpaidLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      include: { leaveType: { select: { isPaid: true } } },
    });
    const totalLop = unpaidLeaves.filter(l => !l.leaveType.isPaid).reduce((sum, l) => sum + Number(l.days), 0);

    // Upsert consolidation record
    if (existing.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE attendance_consolidations SET status = 'CONSOLIDATED', total_employees = $1, total_present = $2, total_absent = $3, total_half_day = $4, total_leave = $5, total_lop = $6, consolidated_by = $7, consolidated_at = NOW(), updated_at = NOW() WHERE tenant_id = $8 AND month = $9 AND year = $10`,
        employees.length, totalPresent, totalAbsent, totalHalfDay, totalLeave, totalLop, userId, tenantId, month, year
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO attendance_consolidations (id, tenant_id, month, year, status, total_employees, total_present, total_absent, total_half_day, total_leave, total_lop, consolidated_by, consolidated_at) VALUES (gen_random_uuid()::text, $1, $2, $3, 'CONSOLIDATED', $4, $5, $6, $7, $8, $9, $10, NOW())`,
        tenantId, month, year, employees.length, totalPresent, totalAbsent, totalHalfDay, totalLeave, totalLop, userId
      );
    }

    return {
      month, year, status: 'CONSOLIDATED',
      totalEmployees: employees.length,
      totalPresent, totalAbsent, totalHalfDay, totalLeave, totalLop,
    };
  }

  async getConsolidation(tenantId: string, month: number, year: number) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM attendance_consolidations WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      tenantId, month, year
    );
    if (rows.length === 0) return null;
    return rows[0];
  }

  // ── Stage 3: Rectification ────────────────────────

  async getAttendanceReport(tenantId: string, month: number, year: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true, firstName: true, lastName: true, employeeCode: true, designation: true,
        attendance: {
          where: { date: { gte: monthStart, lte: monthEnd } },
          orderBy: { date: 'asc' },
        },
      },
    });

    // Calculate working days (exclude weekends + holidays)
    const holidays = await this.prisma.holiday.findMany({
      where: { tenantId, year, date: { gte: monthStart, lte: monthEnd } },
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    let workingDays = 0;
    const d = new Date(monthStart);
    while (d <= monthEnd) {
      const dow = d.getDay();
      const dateStr = d.toISOString().split('T')[0];
      if (dow !== 0 && dow !== 6 && !holidayDates.has(dateStr)) {
        workingDays++;
      }
      d.setDate(d.getDate() + 1);
    }

    const report = employees.map(emp => {
      const present = emp.attendance.filter(a => a.status === 'PRESENT').length;
      const absent = emp.attendance.filter(a => a.status === 'ABSENT').length;
      const halfDay = emp.attendance.filter(a => a.status === 'HALF_DAY').length;
      const leave = emp.attendance.filter(a => a.status === 'LEAVE').length;
      const wfh = emp.attendance.filter(a => a.status === 'WFH').length;
      const paidDays = present + wfh + (halfDay * 0.5);
      const lopDays = workingDays - paidDays - leave;

      return {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`,
        designation: emp.designation,
        workingDays,
        present, absent, halfDay, leave, wfh,
        paidDays: Math.max(0, paidDays),
        lopDays: Math.max(0, lopDays),
        records: emp.attendance,
      };
    });

    return { month, year, workingDays, holidays: holidays.length, employees: report };
  }

  async rectifyAttendance(tenantId: string, month: number, year: number, userId: string) {
    const consolidation = await this.getConsolidation(tenantId, month, year);
    if (!consolidation) throw new BadRequestException('Consolidation not done yet. Run consolidation first.');
    if (consolidation.status === 'LOCKED') throw new ConflictException('Attendance already locked');

    await this.prisma.$executeRawUnsafe(
      `UPDATE attendance_consolidations SET status = 'RECTIFIED', rectified_by = $1, rectified_at = NOW(), updated_at = NOW() WHERE tenant_id = $2 AND month = $3 AND year = $4`,
      userId, tenantId, month, year
    );

    return { status: 'RECTIFIED', month, year };
  }

  async lockAttendance(tenantId: string, month: number, year: number, userId: string) {
    const consolidation = await this.getConsolidation(tenantId, month, year);
    if (!consolidation) throw new BadRequestException('Consolidation not done yet');
    if (consolidation.status === 'LOCKED') throw new ConflictException('Already locked');

    await this.prisma.$executeRawUnsafe(
      `UPDATE attendance_consolidations SET status = 'LOCKED', locked_at = NOW(), updated_at = NOW() WHERE tenant_id = $1 AND month = $2 AND year = $3`,
      tenantId, month, year
    );

    return { status: 'LOCKED', month, year };
  }

  // ── Stage 5: Review & Modify ──────────────────────

  async modifyPayslip(tenantId: string, payslipId: string, modifications: {
    basic?: number;
    hra?: number;
    da?: number;
    specialAllow?: number;
    otherAllow?: number;
    pfEmployee?: number;
    esiEmployee?: number;
    profTax?: number;
    tds?: number;
    otherDeductions?: number;
    adjustments?: Array<{ type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string; amount: number }>;
    notes?: string;
  }) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
      include: { payrollRun: true, employee: { select: { engagementType: true, consultantTdsRate: true } } },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(payslip.payrollRun.status)) {
      throw new ConflictException('Cannot modify payslip — payroll is frozen or finalized');
    }

    // Recalculate totals
    const basic = modifications.basic ?? Number(payslip.basic);
    const hra = modifications.hra ?? Number(payslip.hra);
    const da = modifications.da ?? Number(payslip.da);
    const specialAllow = modifications.specialAllow ?? Number(payslip.specialAllow);
    const otherAllow = modifications.otherAllow ?? Number(payslip.otherAllow);
    const adjustments = Array.isArray(modifications.adjustments)
      ? modifications.adjustments
          .filter((a) => a && (a.type === 'EARNING' || a.type === 'DEDUCTION' || a.type === 'REIMBURSEMENT') && a.label)
          .map((a) => ({ type: a.type, label: String(a.label), amount: Number(a.amount) || 0 }))
      : ((payslip.adjustments as any[]) ?? []);
    const earnAdj = adjustments.filter((a) => a.type === 'EARNING').reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const dedAdj = adjustments.filter((a) => a.type === 'DEDUCTION').reduce((sum, a) => sum + Number(a.amount || 0), 0);
    // Reimbursements are NON-TAXABLE: added to net pay, excluded from gross
    // (so they never affect taxable income, TDS, PF or ESI).
    const reimbAdj = adjustments.filter((a) => a.type === 'REIMBURSEMENT').reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const grossEarnings = basic + hra + da + specialAllow + otherAllow + earnAdj;

    const pfEmployee = modifications.pfEmployee ?? Number(payslip.pfEmployee);
    const esiEmployee = modifications.esiEmployee ?? Number(payslip.esiEmployee);
    const profTax = modifications.profTax ?? Number(payslip.profTax);
    let tds = modifications.tds ?? Number(payslip.tds);
    if ((payslip as any).employee?.engagementType === 'CONSULTANT') {
      const rate = Number((payslip as any).employee.consultantTdsRate ?? 2);
      tds = Math.round((grossEarnings * rate) / 100);
    }
    const otherDeductions = modifications.otherDeductions ?? Number(payslip.otherDeductions);
    const totalDeductions = pfEmployee + esiEmployee + profTax + tds + otherDeductions + dedAdj;
    const netPay = grossEarnings - totalDeductions + reimbAdj;

    const updated = await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        basic, hra, da, specialAllow, otherAllow, grossEarnings,
        pfEmployee, esiEmployee, profTax, tds, otherDeductions, totalDeductions, netPay,
        adjustments: adjustments as any,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
    });

    // Keep the payroll-run aggregate in sync so the summary reflects edits immediately
    const agg = await this.prisma.payslip.aggregate({
      where: { payrollRunId: payslip.payrollRunId },
      _sum: { grossEarnings: true, totalDeductions: true, netPay: true },
    });
    await this.prisma.payrollRun.update({
      where: { id: payslip.payrollRunId },
      data: {
        totalGross: agg._sum.grossEarnings ?? 0,
        totalDeductions: agg._sum.totalDeductions ?? 0,
        totalNet: agg._sum.netPay ?? 0,
      },
    });

    return updated;
  }

  // Recompute a payslip's derived totals from its stored base components + the
  // given adjustments (base components exclude adjustments). Returns the update data.
  private recomputePayslipData(p: any, adjustments: any[]) {
    const earnAdj = adjustments.filter((a) => a.type === 'EARNING').reduce((s, a) => s + Number(a.amount || 0), 0);
    const dedAdj = adjustments.filter((a) => a.type === 'DEDUCTION').reduce((s, a) => s + Number(a.amount || 0), 0);
    const reimbAdj = adjustments.filter((a) => a.type === 'REIMBURSEMENT').reduce((s, a) => s + Number(a.amount || 0), 0);
    const grossEarnings = Number(p.basic) + Number(p.hra) + Number(p.da) + Number(p.specialAllow) + Number(p.otherAllow) + earnAdj;
    let tds = Number(p.tds);
    if (p.employee?.engagementType === 'CONSULTANT') {
      const rate = Number(p.employee.consultantTdsRate ?? 2);
      tds = Math.round((grossEarnings * rate) / 100);
    }
    const totalDeductions = Number(p.pfEmployee) + Number(p.esiEmployee) + Number(p.profTax) + tds + Number(p.otherDeductions) + dedAdj;
    const netPay = grossEarnings - totalDeductions + reimbAdj;
    return { grossEarnings, tds, totalDeductions, netPay, adjustments: adjustments as any };
  }

  private async syncRunAggregate(payrollRunId: string) {
    const agg = await this.prisma.payslip.aggregate({
      where: { payrollRunId },
      _sum: { grossEarnings: true, totalDeductions: true, netPay: true },
    });
    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        totalGross: agg._sum.grossEarnings ?? 0,
        totalDeductions: agg._sum.totalDeductions ?? 0,
        totalNet: agg._sum.netPay ?? 0,
      },
    });
  }

  private async assertRunEditable(tenantId: string, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(run.status)) {
      throw new ConflictException('Cannot change heads — payroll is frozen or finalized');
    }
    return run;
  }

  // ── Add a one-off head (earning/deduction/reimbursement) to EVERY payslip in a run ──
  async bulkAddHead(
    tenantId: string,
    payrollRunId: string,
    head: { type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string; amount: number },
  ) {
    const type = head?.type;
    const label = String(head?.label ?? '').trim();
    const amount = Number(head?.amount) || 0;
    if (!['EARNING', 'DEDUCTION', 'REIMBURSEMENT'].includes(type) || !label) {
      throw new ConflictException('A head needs a type (EARNING/DEDUCTION/REIMBURSEMENT) and a label');
    }
    await this.assertRunEditable(tenantId, payrollRunId);

    const payslips = await this.prisma.payslip.findMany({
      where: { payrollRunId },
      include: { employee: { select: { engagementType: true, consultantTdsRate: true } } },
    });

    const newHead = { type, label, amount };
    for (const p of payslips) {
      const adjustments = [...(((p.adjustments as any[]) ?? [])), newHead];
      await this.prisma.payslip.update({ where: { id: p.id }, data: this.recomputePayslipData(p, adjustments) });
    }
    await this.syncRunAggregate(payrollRunId);
    return { updated: payslips.length, head: newHead };
  }

  // ── Remove a head (matched by type + label) from EVERY payslip in a run ──
  async bulkRemoveHead(
    tenantId: string,
    payrollRunId: string,
    head: { type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string },
  ) {
    const type = head?.type;
    const label = String(head?.label ?? '').trim();
    if (!type || !label) throw new ConflictException('Specify the head type and label to remove');
    await this.assertRunEditable(tenantId, payrollRunId);

    const payslips = await this.prisma.payslip.findMany({
      where: { payrollRunId },
      include: { employee: { select: { engagementType: true, consultantTdsRate: true } } },
    });

    let removed = 0;
    let changedSlips = 0;
    for (const p of payslips) {
      const existing = ((p.adjustments as any[]) ?? []);
      const kept = existing.filter((a) => !(a.type === type && String(a.label) === label));
      if (kept.length === existing.length) continue; // nothing matched on this payslip
      removed += existing.length - kept.length;
      changedSlips++;
      await this.prisma.payslip.update({ where: { id: p.id }, data: this.recomputePayslipData(p, kept) });
    }
    if (changedSlips > 0) await this.syncRunAggregate(payrollRunId);
    return { updated: changedSlips, removed };
  }

  // ── Recalculate a run: regenerate payslips from CURRENT pay structures /
  //    attendance, preserving the manual one-off heads on each payslip ──
  async recalculatePayroll(tenantId: string, payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: { payslips: { select: { employeeId: true, adjustments: true } } },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(run.status)) {
      throw new ConflictException('Cannot recalculate — payroll is frozen or finalized. Reopen it first.');
    }

    const month = run.month;
    const year = run.year;

    // Pre-validate the sequential-payroll guard BEFORE deleting anything, so a
    // recalc can never leave the month with no run.
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevRun = await this.prisma.payrollRun.findUnique({
      where: { tenantId_month_year: { tenantId, month: prevMonth, year: prevYear } },
    });
    if (prevRun && !['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(prevRun.status)) {
      throw new BadRequestException(
        `Cannot recalculate — the previous month (${prevMonth}/${prevYear}) payroll is still open. Freeze or finalize it first.`,
      );
    }

    // Snapshot the manual heads per employee so they survive the regenerate.
    const adjByEmp = new Map<string, any[]>();
    for (const p of run.payslips) {
      const adj = Array.isArray(p.adjustments) ? (p.adjustments as any[]) : [];
      if (adj.length) adjByEmp.set(p.employeeId, adj);
    }

    // Delete the run (lines → payslips → run), then regenerate via the same V2 engine.
    await this.prisma.$transaction(async (tx) => {
      await tx.payslipLine.deleteMany({ where: { payslip: { payrollRunId } } });
      await tx.payslip.deleteMany({ where: { payrollRunId } });
      await tx.payrollRun.delete({ where: { id: payrollRunId } });
    });
    await this.payrollService.runPayrollV2(tenantId, { month, year } as any, userId);

    // Re-apply the snapshotted heads onto the fresh payslips.
    let headsReapplied = 0;
    const fresh = await this.prisma.payrollRun.findUnique({
      where: { tenantId_month_year: { tenantId, month, year } },
      include: { payslips: { include: { employee: { select: { engagementType: true, consultantTdsRate: true } } } } },
    });
    if (fresh && adjByEmp.size) {
      for (const p of fresh.payslips) {
        const adj = adjByEmp.get(p.employeeId);
        if (!adj?.length) continue;
        await this.prisma.payslip.update({ where: { id: p.id }, data: this.recomputePayslipData(p, adj) });
        headsReapplied++;
      }
      if (headsReapplied > 0) await this.syncRunAggregate(fresh.id);
    }

    return { recalculated: true, runId: fresh?.id, payslips: fresh?.payslips.length ?? 0, headsReapplied };
  }

  // ── Stage 6: Freeze & Bank File ───────────────────

  async freezePayroll(tenantId: string, payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(run.status)) {
      throw new ConflictException('Payroll already frozen');
    }

    return this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'FROZEN',
        frozenAt: new Date(),
        frozenBy: userId,
      },
    });
  }

  async generateBankFile(tenantId: string, payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                firstName: true, lastName: true, employeeCode: true,
                bankAccount: true, bankIfsc: true, bankName: true, bankBranch: true,
              },
            },
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (!['FROZEN', 'REVIEWED', 'COMPUTED', 'COMPLETED'].includes(run.status) && run.status !== 'BANK_GENERATED') {
      throw new BadRequestException('Payroll must be frozen before generating bank file');
    }

    // Generate Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Zedtreeo Workforce';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Bank Transfer');

    // Header row
    sheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Employee Code', key: 'code', width: 15 },
      { header: 'Employee Name', key: 'name', width: 30 },
      { header: 'Bank Name', key: 'bankName', width: 25 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Account Number', key: 'account', width: 25 },
      { header: 'IFSC Code', key: 'ifsc', width: 15 },
      { header: 'Net Pay (INR)', key: 'netPay', width: 18 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    // Data rows
    let totalNet = 0;
    run.payslips.forEach((slip, idx) => {
      const emp = slip.employee;
      const netPay = Number(slip.netPay);
      totalNet += netPay;

      sheet.addRow({
        sno: idx + 1,
        code: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`,
        bankName: emp.bankName || '-',
        branch: emp.bankBranch || '-',
        account: emp.bankAccount || 'NOT PROVIDED',
        ifsc: emp.bankIfsc || '-',
        netPay,
      });
    });

    // Total row
    const totalRow = sheet.addRow({
      sno: '', code: '', name: 'TOTAL', bankName: '', branch: '', account: '', ifsc: '',
      netPay: totalNet,
    });
    totalRow.font = { bold: true, size: 11 };

    // Format currency column
    sheet.getColumn('netPay').numFmt = '#,##0.00';

    // Save to uploads directory
    const filename = `bank-transfer-${run.year}-${String(run.month).padStart(2, '0')}.xlsx`;
    const uploadDir = path.join(process.cwd(), 'uploads', 'payroll');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);

    await workbook.xlsx.writeFile(filePath);

    // Update payroll run
    const fileUrl = `/uploads/payroll/${filename}`;
    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'BANK_GENERATED',
        bankFileUrl: fileUrl,
        bankFileGeneratedAt: new Date(),
      },
    });

    return {
      status: 'BANK_GENERATED',
      fileUrl,
      filename,
      employeeCount: run.payslips.length,
      totalNet,
    };
  }

  // ── Tax Payout (TDS) file — month / quarter / financial-year ──
  private resolveTaxPeriod(
    scope: 'MONTH' | 'QUARTER' | 'YEAR',
    opts: { month?: number; year?: number; fy?: number; quarter?: number },
  ): { periodMonths: Array<{ m: number; y: number }>; periodLabel: string } {
    const MN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (scope === 'MONTH') {
      const month = Number(opts.month), year = Number(opts.year);
      return { periodMonths: [{ m: month, y: year }], periodLabel: `${MN[month]} ${year}` };
    }
    const fyStartYear = opts.fy != null
      ? Number(opts.fy)
      : (Number(opts.month) >= 4 ? Number(opts.year) : Number(opts.year) - 1);
    const fyMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((m) => ({ m, y: m >= 4 ? fyStartYear : fyStartYear + 1 }));
    const fyLabel = `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
    if (scope === 'YEAR') return { periodMonths: fyMonths, periodLabel: fyLabel };
    // QUARTER — Indian TDS quarters: Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar
    let qNo = Number(opts.quarter);
    if (!(qNo >= 1 && qNo <= 4)) {
      const idx = fyMonths.findIndex((x) => x.m === Number(opts.month));
      qNo = idx >= 0 ? Math.floor(idx / 3) + 1 : 1;
    }
    const periodMonths = fyMonths.slice((qNo - 1) * 3, (qNo - 1) * 3 + 3);
    return { periodMonths, periodLabel: `Q${qNo} ${fyLabel} (${periodMonths.map((p) => MN[p.m]).join('–')})` };
  }

  async taxPayoutFile(tenantId: string, payrollRunId: string, scope: 'MONTH' | 'QUARTER' | 'YEAR' = 'MONTH') {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    const { periodMonths, periodLabel } = this.resolveTaxPeriod(scope, { month: run.month, year: run.year });
    return this.buildTaxPayout(tenantId, periodMonths, periodLabel, scope);
  }

  async taxPayoutByPeriod(
    tenantId: string,
    scope: 'MONTH' | 'QUARTER' | 'YEAR',
    opts: { month?: number; year?: number; fy?: number; quarter?: number },
  ) {
    const { periodMonths, periodLabel } = this.resolveTaxPeriod(scope, opts);
    return this.buildTaxPayout(tenantId, periodMonths, periodLabel, scope);
  }

  private async buildTaxPayout(
    tenantId: string,
    periodMonths: Array<{ m: number; y: number }>,
    periodLabel: string,
    scope: string,
  ) {

    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, OR: periodMonths.map((p) => ({ month: p.m, year: p.y })) },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, panNumber: true, engagementType: true, consultantTdsRate: true } },
      },
    });

    // Aggregate TDS per employee over the period.
    type Row = { code: string; name: string; pan: string; type: string; section: string; gross: number; tds: number };
    const byEmp = new Map<string, Row>();
    for (const p of payslips) {
      const e: any = p.employee;
      const isConsultant = e.engagementType === 'CONSULTANT';
      const section = isConsultant ? (Number(e.consultantTdsRate) >= 10 ? '194J' : '194C') : '192';
      const cur = byEmp.get(p.employeeId) || {
        code: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), pan: e.panNumber || '—',
        type: isConsultant ? 'Contract' : 'Employee', section, gross: 0, tds: 0,
      };
      cur.gross += Number(p.grossEarnings);
      cur.tds += Number(p.tds);
      byEmp.set(p.employeeId, cur);
    }
    const rows = [...byEmp.values()];
    const salaried = rows.filter((r) => r.type === 'Employee').sort((a, b) => a.name.localeCompare(b.name));
    const contract = rows.filter((r) => r.type === 'Contract').sort((a, b) => a.name.localeCompare(b.name));

    const tenant = await this.prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true, panNumber: true, tanNumber: true } });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zedtreeo Workforce';
    wb.created = new Date();
    const ws = wb.addWorksheet('TDS Payout');
    ws.columns = [
      { key: 'code', width: 15 }, { key: 'name', width: 30 }, { key: 'pan', width: 16 },
      { key: 'section', width: 12 }, { key: 'gross', width: 16 }, { key: 'tds', width: 16 },
    ];

    const title = ws.addRow([`TDS Payout — ${periodLabel}`]);
    title.font = { bold: true, size: 13 };
    ws.addRow([`${tenant?.name || ''}   TAN: ${tenant?.tanNumber || '—'}   PAN: ${tenant?.panNumber || '—'}`]).font = { size: 9, color: { argb: 'FF666666' } };
    ws.addRow([]);

    let grandTds = 0;
    const addGroup = (heading: string, list: Row[]) => {
      const h = ws.addRow([heading]);
      h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      const head = ws.addRow(['Emp Code', 'Name', 'PAN', 'Section', 'Gross Paid', 'TDS']);
      head.font = { bold: true };
      let sub = 0;
      for (const r of list) {
        ws.addRow([r.code, r.name, r.pan, r.section, Math.round(r.gross), Math.round(r.tds)]);
        sub += r.tds;
      }
      const st = ws.addRow(['', '', '', 'Subtotal', '', Math.round(sub)]);
      st.font = { bold: true };
      ws.addRow([]);
      grandTds += sub;
      return sub;
    };

    addGroup('SALARIED — Section 192 (Form 24Q)', salaried);
    addGroup('CONTRACT / PROFESSIONAL — Section 194 (Form 26Q)', contract);
    const gt = ws.addRow(['', '', '', 'TOTAL TDS PAYABLE', '', Math.round(grandTds)]);
    gt.font = { bold: true, size: 12 };
    ws.getColumn('gross').numFmt = '#,##0';
    ws.getColumn('tds').numFmt = '#,##0';

    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as any);
    const filename = `tax-payout-${scope.toLowerCase()}-${periodLabel.replace(/[^A-Za-z0-9]+/g, '-')}.xlsx`;
    return { buffer, filename, totalTds: Math.round(grandTds), employees: salaried.length, contractors: contract.length };
  }

  // ── Payroll summary export — the per-employee breakdown table as XLSX ──
  async payrollSummaryFile(tenantId: string, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: {
        payslips: {
          include: { employee: { select: { firstName: true, lastName: true, employeeCode: true, engagementType: true } } },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    const MN = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Zedtreeo Workforce';
    const ws = wb.addWorksheet('Payroll Summary');
    ws.columns = [
      { header: 'Emp Code', key: 'code', width: 14 },
      { header: 'Name', key: 'name', width: 28 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Salary', key: 'salary', width: 14 },
      { header: 'Add. Earning', key: 'addEarn', width: 14 },
      { header: 'Reimbursement', key: 'reimb', width: 15 },
      { header: 'Tax Ded (TDS)', key: 'tds', width: 14 },
      { header: 'Other Deduc', key: 'otherDed', width: 14 },
      { header: 'Net Pay', key: 'net', width: 14 },
    ];
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    const sumAdj = (adj: any, type: string) =>
      Array.isArray(adj) ? adj.filter((a: any) => a?.type === type).reduce((s: number, a: any) => s + Number(a.amount || 0), 0) : 0;
    const t = { salary: 0, addEarn: 0, reimb: 0, tds: 0, otherDed: 0, net: 0 };
    for (const p of run.payslips) {
      const addEarn = sumAdj(p.adjustments, 'EARNING');
      const reimb = sumAdj(p.adjustments, 'REIMBURSEMENT');
      const salary = Number(p.grossEarnings) - addEarn;
      const tds = Number(p.tds);
      const otherDed = Number(p.totalDeductions) - tds;
      const net = Number(p.netPay);
      ws.addRow({
        code: p.employee.employeeCode,
        name: `${p.employee.firstName} ${p.employee.lastName}`,
        type: (p.employee as any).engagementType === 'CONSULTANT' ? 'Contract' : 'Employee',
        salary: Math.round(salary), addEarn: Math.round(addEarn), reimb: Math.round(reimb),
        tds: Math.round(tds), otherDed: Math.round(otherDed), net: Math.round(net),
      });
      t.salary += salary; t.addEarn += addEarn; t.reimb += reimb; t.tds += tds; t.otherDed += otherDed; t.net += net;
    }
    const totalRow = ws.addRow({
      code: '', name: 'TOTAL', type: '',
      salary: Math.round(t.salary), addEarn: Math.round(t.addEarn), reimb: Math.round(t.reimb),
      tds: Math.round(t.tds), otherDed: Math.round(t.otherDed), net: Math.round(t.net),
    });
    totalRow.font = { bold: true };
    ['salary', 'addEarn', 'reimb', 'tds', 'otherDed', 'net'].forEach((k) => { ws.getColumn(k).numFmt = '#,##0'; });

    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as any);
    const filename = `payroll-summary-${MN[run.month]}-${run.year}.xlsx`;
    return { buffer, filename, employees: run.payslips.length };
  }

  // ── Stage 7: Finalize ─────────────────────────────

  async finalizePayroll(tenantId: string, payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: {
        payslips: {
          include: {
            employee: { select: { id: true, email: true, firstName: true } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status === 'FINALIZED' || run.status === 'PAID') {
      throw new ConflictException('Payroll already finalized');
    }

    // Mark all payslips as paid
    const now = new Date();
    await this.prisma.payslip.updateMany({
      where: { payrollRunId },
      data: { paidAt: now },
    });

    // Update payroll run status
    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        status: 'FINALIZED',
        finalizedAt: now,
        finalizedBy: userId,
      },
    });

    // Create notifications for each employee
    for (const slip of run.payslips) {
      const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

      // Find user by email
      const user = await this.prisma.user.findFirst({
        where: { tenantId, email: slip.employee.email },
      });

      if (user) {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId: user.id,
            type: 'PAYSLIP_GENERATED',
            title: `Payslip for ${monthNames[run.month]} ${run.year}`,
            message: `Your payslip for ${monthNames[run.month]} ${run.year} is now available. Net Pay: ₹${Number(slip.netPay).toLocaleString('en-IN')}`,
            linkUrl: '/portal/payslips',
          },
        }).catch(() => {}); // Non-blocking
      }
    }

    return {
      status: 'FINALIZED',
      month: run.month,
      year: run.year,
      employeesNotified: run.payslips.length,
    };
  }

  // ── Upload Attendance CSV ─────────────────────────

  async uploadAttendanceCsv(tenantId: string, month: number, year: number, data: Array<{
    employeeCode: string;
    date: string;
    status: string;
    checkIn?: string;
    checkOut?: string;
    notes?: string;
  }>, userId: string) {
    // Validate consolidation isn't locked
    const consolidation = await this.getConsolidation(tenantId, month, year);
    if (consolidation?.status === 'LOCKED') {
      throw new ConflictException('Attendance is locked for this month');
    }

    // Map employee codes to IDs
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, employeeCode: true },
    });
    const codeToId = new Map(employees.map(e => [e.employeeCode, e.id]));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of data) {
      const employeeId = codeToId.get(row.employeeCode);
      if (!employeeId) {
        errors.push(`Employee code ${row.employeeCode} not found`);
        skipped++;
        continue;
      }

      const date = new Date(row.date);
      if (isNaN(date.getTime())) {
        errors.push(`Invalid date: ${row.date} for ${row.employeeCode}`);
        skipped++;
        continue;
      }
      date.setHours(0, 0, 0, 0);

      const validStatuses = ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND', 'WFH'];
      const status = row.status?.toUpperCase();
      if (!validStatuses.includes(status)) {
        errors.push(`Invalid status: ${row.status} for ${row.employeeCode} on ${row.date}`);
        skipped++;
        continue;
      }

      try {
        await this.prisma.attendance.upsert({
          where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
          update: {
            status: status as any,
            checkIn: row.checkIn ? new Date(row.checkIn) : undefined,
            checkOut: row.checkOut ? new Date(row.checkOut) : undefined,
            notes: row.notes || `CSV upload by admin`,
            source: 'MANUAL',
            markedBy: userId,
          },
          create: {
            tenantId,
            employeeId,
            date,
            status: status as any,
            checkIn: row.checkIn ? new Date(row.checkIn) : null,
            checkOut: row.checkOut ? new Date(row.checkOut) : null,
            notes: row.notes || `CSV upload by admin`,
            source: 'MANUAL',
            markedBy: userId,
          },
        });
        imported++;
      } catch (e) {
        errors.push(`Error for ${row.employeeCode} on ${row.date}: ${(e as Error).message}`);
        skipped++;
      }
    }

    return { imported, skipped, errors: errors.slice(0, 20) };
  }

  // ── Payroll Run Detail ────────────────────────────

  async getPayrollRunDetail(tenantId: string, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: {
        payslips: {
          include: {
            employee: {
              select: {
                firstName: true, lastName: true, employeeCode: true, designation: true,
                bankAccount: true, bankIfsc: true, bankName: true, bankBranch: true,
              },
            },
            lines: { orderBy: { sortOrder: 'asc' } },
          },
          orderBy: { employee: { firstName: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  // ── Delete / Reset Payroll Run ────────────────────

  async reopenPayroll(tenantId: string, payrollRunId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: payrollRunId, tenantId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['FINALIZED', 'PAID'].includes(run.status)) {
      throw new ConflictException('Cannot reopen a finalized/disbursed payroll. Delete & re-run if you must change it.');
    }
    const updated = await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'DRAFT', bankFileUrl: null, bankFileGeneratedAt: null } as any,
    });
    return { reopened: true, status: updated.status };
  }

  async deletePayrollRun(tenantId: string, payrollRunId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (['FINALIZED', 'PAID'].includes(run.status)) {
      throw new ConflictException('Cannot delete a finalized payroll');
    }

    // Delete payslip lines first, then payslips, then run
    await this.prisma.$transaction(async (tx) => {
      await tx.payslipLine.deleteMany({
        where: { payslip: { payrollRunId } },
      });
      await tx.payslip.deleteMany({ where: { payrollRunId } });
      await tx.payrollRun.delete({ where: { id: payrollRunId } });
    });

    return { deleted: true };
  }
}
