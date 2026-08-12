import {
  Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculatePayStructure, PayComponent, CalculationInput,
} from './formula-engine';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Salary Structures ─────────────────────────────

  async getSalaryStructures(tenantId: string, params: { employeeId?: string }) {
    return this.prisma.salaryStructure.findMany({
      where: {
        tenantId,
        ...(params.employeeId && { employeeId: params.employeeId }),
        isActive: true,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, designation: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSalaryStructure(tenantId: string, dto: CreateSalaryStructureDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Deactivate any existing active structure for this employee
    await this.prisma.salaryStructure.updateMany({
      where: { tenantId, employeeId: dto.employeeId, isActive: true },
      data: { isActive: false, effectiveTo: new Date(dto.effectiveFrom) },
    });

    // Calculate components
    const basic = dto.basic;
    const hra = dto.hra ?? Math.round(basic * 0.4);           // 40% of basic default
    const da = dto.da ?? 0;
    const specialAllow = dto.specialAllow ?? 0;
    const otherAllow = dto.otherAllow ?? 0;
    const grossSalary = basic + hra + da + specialAllow + otherAllow;

    // Deductions
    const pfEmployee = dto.pfEmployee ?? Math.min(Math.round(basic * 0.12), 1800);    // 12% of basic, max ₹1800
    const pfEmployer = dto.pfEmployer ?? Math.min(Math.round(basic * 0.12), 1800);
    const esiEmployee = dto.esiEmployee ?? (grossSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0); // 0.75% if gross <= 21k
    const esiEmployer = dto.esiEmployer ?? (grossSalary <= 21000 ? Math.round(grossSalary * 0.0325) : 0); // 3.25%
    const profTax = dto.profTax ?? 200;   // Standard PT
    const tds = dto.tds ?? 0;

    const totalDeductions = pfEmployee + esiEmployee + profTax + tds;
    const netSalary = grossSalary - totalDeductions;
    const ctc = (grossSalary + pfEmployer + esiEmployer) * 12;

    return this.prisma.salaryStructure.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        basic, hra, da, specialAllow, otherAllow, grossSalary,
        pfEmployee, pfEmployer, esiEmployee, esiEmployer, profTax, tds,
        netSalary, ctc,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
    });
  }

  // ── Payroll Runs ──────────────────────────────────

  async getPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId },
      include: { _count: { select: { payslips: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async runPayroll(tenantId: string, dto: RunPayrollDto, userId: string) {
    // Check for duplicate run
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_month_year: { tenantId, month: dto.month, year: dto.year } },
    });
    if (existing) throw new ConflictException(`Payroll already exists for ${dto.month}/${dto.year}. Delete it first to re-run.`);

    // Get all active employees with active salary structures
    const structures = await this.prisma.salaryStructure.findMany({
      where: { tenantId, isActive: true },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeCode: true,
            status: true, joinDate: true, exitDate: true,
            engagementType: true, consultantTdsRate: true, taxRegime: true,
          },
        },
      },
    });

    if (structures.length === 0) {
      throw new BadRequestException('No active salary structures found. Create salary structures first.');
    }

    // Filter: only ACTIVE employees
    const activeStructures = structures.filter((s) => s.employee.status === 'ACTIVE');
    if (activeStructures.length === 0) {
      throw new BadRequestException('No active employees with salary structures.');
    }

    // Calculate working days for the month (simple: 30 days, weekends excluded = ~22)
    const daysInMonth = new Date(dto.year, dto.month, 0).getDate();
    const workingDays = this.getWorkingDays(dto.year, dto.month);

    // Get leave data for LOP calculation
    const monthStart = new Date(dto.year, dto.month - 1, 1);
    const monthEnd = new Date(dto.year, dto.month, 0);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const payslipData: Array<{
      tenantId: string; employeeId: string; month: number; year: number;
      basic: number; hra: number; da: number; specialAllow: number; otherAllow: number;
      grossEarnings: number; pfEmployee: number; esiEmployee: number; profTax: number;
      tds: number; otherDeductions: number; totalDeductions: number; netPay: number;
      workingDays: number; paidDays: number; lopDays: number;
    }> = [];

    for (const struct of activeStructures) {
      // Count unpaid leave days (APPROVED leaves with isPaid=false type, or ABSENT days)
      const unpaidLeaves = await this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId: struct.employeeId,
          status: 'APPROVED',
          startDate: { lte: monthEnd },
          endDate: { gte: monthStart },
        },
        include: { leaveType: { select: { isPaid: true } } },
      });

      // Uploaded monthly attendance override takes precedence over agent/web-derived data.
      const monthlyOverride = await this.prisma.monthlyAttendanceOverride.findUnique({
        where: { tenantId_employeeId_year_month: { tenantId, employeeId: struct.employeeId, year: dto.year, month: dto.month } },
      });

      let lopDays = 0;
      let paidDays = 0;
      if (monthlyOverride) {
        // Working days from the upload = paid days (clamped to the month's working days).
        paidDays = Math.min(workingDays, Math.max(0, Number(monthlyOverride.workingDays)));
        lopDays = Math.max(0, workingDays - paidDays);
      } else {
        for (const leave of unpaidLeaves) {
          if (!leave.leaveType.isPaid) {
            lopDays += Number(leave.days);
          }
        }
        const absentCount = await this.prisma.attendance.count({
          where: {
            tenantId,
            employeeId: struct.employeeId,
            date: { gte: monthStart, lte: monthEnd },
            status: 'ABSENT',
          },
        });
        lopDays += absentCount;
        paidDays = Math.max(0, workingDays - lopDays);
      }
      const payRatio = workingDays > 0 ? paidDays / workingDays : 0;

      // Pro-rate earnings
      const basic = Math.round(Number(struct.basic) * payRatio);
      const hra = Math.round(Number(struct.hra) * payRatio);
      const da = Math.round(Number(struct.da) * payRatio);
      const specialAllow = Math.round(Number(struct.specialAllow) * payRatio);
      const otherAllow = Math.round(Number(struct.otherAllow) * payRatio);
      const grossEarnings = basic + hra + da + specialAllow + otherAllow;

      // Deductions (full month unless gross changes significantly)
      const pfEmp = Math.round(Number(struct.pfEmployee) * payRatio);
      const esiEmp = Math.round(Number(struct.esiEmployee) * payRatio);
      const profTax = Number(struct.profTax);  // Fixed monthly
      const tds = Number(struct.tds);          // Fixed monthly estimate
      const totalDed = pfEmp + esiEmp + profTax + tds;

      const netPay = grossEarnings - totalDed;

      totalGross += grossEarnings;
      totalDeductions += totalDed;
      totalNet += netPay;

      payslipData.push({
        tenantId,
        employeeId: struct.employeeId,
        month: dto.month,
        year: dto.year,
        basic, hra, da, specialAllow, otherAllow, grossEarnings,
        pfEmployee: pfEmp, esiEmployee: esiEmp, profTax, tds,
        otherDeductions: 0,
        totalDeductions: totalDed,
        netPay,
        workingDays,
        paidDays,
        lopDays,
      });
    }

    // Create payroll run + payslips in transaction
    const payrollRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          tenantId,
          month: dto.month,
          year: dto.year,
          runDate: new Date(),
          status: 'COMPLETED',
          totalGross,
          totalDeductions,
          totalNet,
          employeeCount: payslipData.length,
          processedBy: userId,
          notes: dto.notes,
        },
      });

      // Create payslips
      for (const slip of payslipData) {
        await tx.payslip.create({
          data: { ...slip, payrollRunId: run.id },
        });
      }

      return run;
    });

    return this.prisma.payrollRun.findUnique({
      where: { id: payrollRun.id },
      include: {
        payslips: {
          include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
        },
      },
    });
  }

  // ── Payslips ──────────────────────────────────────

  async getPayslips(tenantId: string, params: { month?: number; year?: number; employeeId?: string }) {
    return this.prisma.payslip.findMany({
      where: {
        tenantId,
        ...(params.month && { month: params.month }),
        ...(params.year && { year: params.year }),
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, designation: true, engagementType: true, bankAccount: true, bankIfsc: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayslip(tenantId: string, id: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: {
            firstName: true, lastName: true, employeeCode: true, designation: true, engagementType: true,
            email: true, pfNumber: true, esiNumber: true, panNumber: true,
            bankAccount: true, bankIfsc: true,
            department: { select: { name: true } },
          },
        },
        payrollRun: { select: { runDate: true, status: true } },
        lines: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!payslip) throw new NotFoundException('Payslip not found');
    return payslip;
  }

  async getPayslipPdf(
    tenantId: string,
    id: string,
    requester?: { email?: string; role?: string },
  ) {
    const payslip = await this.getPayslip(tenantId, id);

    // Ownership gate: only ADMIN/OWNER may pull an arbitrary employee's payslip.
    // Everyone else (MEMBER/MANAGER self-service) may download ONLY their own —
    // otherwise any employee could enumerate ids and read colleagues' salaries.
    if (requester && !['ADMIN', 'OWNER'].includes(requester.role ?? '')) {
      const me = requester.email
        ? await this.prisma.employee.findFirst({
            where: { tenantId, email: requester.email, deletedAt: null },
            select: { id: true },
          })
        : null;
      if (!me || me.id !== (payslip as any).employeeId) {
        throw new ForbiddenException('You can only download your own payslip');
      }
    }

    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, gstNumber: true, panNumber: true, pfNumber: true, esiNumber: true },
    });

    // Year-to-date totals (this employee, same FY-year, months up to & incl. this one)
    const ytdSlips = await this.prisma.payslip.findMany({
      where: { tenantId, employeeId: (payslip as any).employeeId, year: payslip.year, month: { lte: payslip.month } },
      select: { grossEarnings: true, totalDeductions: true, netPay: true },
    });
    const ytd = ytdSlips.reduce(
      (a, s) => ({
        gross: a.gross + Number(s.grossEarnings),
        ded: a.ded + Number(s.totalDeductions),
        net: a.net + Number(s.netPay),
      }),
      { gross: 0, ded: 0, net: 0 },
    );

    // Leave summary — active leave types for the year
    const leaveBalances = await this.prisma.leaveBalance.findMany({
      where: { tenantId, employeeId: (payslip as any).employeeId, year: payslip.year, leaveType: { isActive: true } },
      include: { leaveType: { select: { name: true } } },
    });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // pdfkit's built-in Helvetica has no ₹ (U+20B9) glyph (renders as a wrong
    // char), so use "Rs." which always renders. Indian digit grouping kept.
    const fmt = (v: number | any) => `Rs. ${Number(v).toLocaleString('en-IN')}`;

    // ── Header ──
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#111111').text(tenant?.name || 'Company', { align: 'center' });
    const tenantIds = [tenant?.panNumber ? `PAN: ${tenant.panNumber}` : null, tenant?.gstNumber ? `GSTIN: ${tenant.gstNumber}` : null].filter(Boolean).join('   |   ');
    if (tenantIds) {
      doc.fontSize(8).font('Helvetica').fillColor('#666666').text(tenantIds, { align: 'center' });
    }
    doc.fillColor('#111111').fontSize(10).font('Helvetica').text(`Payslip for ${monthNames[payslip.month]} ${payslip.year}`, { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ── Employee Info ──
    const emp = (payslip as any).employee;
    doc.fontSize(9).font('Helvetica');
    const infoY = doc.y;
    doc.text(`Employee: ${emp.firstName} ${emp.lastName}`, 40, infoY);
    doc.text(`Code: ${emp.employeeCode}`, 300, infoY);
    doc.text(`Designation: ${emp.designation || '—'}`, 40, infoY + 14);
    doc.text(`Department: ${emp.department?.name || '—'}`, 300, infoY + 14);
    doc.text(`PAN: ${emp.panNumber || '—'}`, 40, infoY + 28);
    doc.text(`PF No: ${emp.pfNumber || '—'}`, 300, infoY + 28);
    doc.text(`Bank A/C: ${emp.bankAccount || '—'}`, 40, infoY + 42);
    doc.text(`IFSC: ${emp.bankIfsc || '—'}`, 300, infoY + 42);
    doc.moveDown(4);

    // ── Days Summary ──
    doc.text(`Working Days: ${payslip.workingDays}  |  Paid Days: ${payslip.paidDays}  |  LOP Days: ${payslip.lopDays}`, 40);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);

    // ── Dynamic Earnings & Deductions ──
    // Check if we have itemized lines (V2 payslip) or legacy columns
    const lines = (payslip as any).lines || [];
    const hasLines = lines.length > 0;
    const isConsultantPS = (payslip as any).employee?.engagementType === 'CONSULTANT';

    // One-off heads added on this payslip (EARNING/DEDUCTION shown as line items;
    // REIMBURSEMENT is rendered separately below the totals as a non-taxable add).
    const adjList = Array.isArray((payslip as any).adjustments) ? ((payslip as any).adjustments as any[]) : [];
    const adjEarnings: Array<[string, number]> = adjList
      .filter((a) => a?.type === 'EARNING' && a?.label)
      .map((a) => [String(a.label), Number(a.amount || 0)]);
    const adjDeductions: Array<[string, number]> = adjList
      .filter((a) => a?.type === 'DEDUCTION' && a?.label)
      .map((a) => [String(a.label), Number(a.amount || 0)]);

    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('EARNINGS', 40, tableTop);
    doc.text('DEDUCTIONS', 300, tableTop);
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(9);

    // Build the earnings & deductions columns per payslip type, then append any
    // one-off heads so each shows as its own itemized line.
    let earnCol: Array<[string, number]> = [];
    let dedCol: Array<[string, number]> = [];

    if (isConsultantPS) {
      // Consultant: professional fee (base, excl. earning heads) + flat TDS
      const earnAdjTotal = adjEarnings.reduce((s, [, v]) => s + v, 0);
      earnCol = [['Professional Fees', Number(payslip.grossEarnings) - earnAdjTotal], ...adjEarnings];
      dedCol = [['TDS (2%)', Number(payslip.tds)], ...adjDeductions];
    } else if (hasLines) {
      // V2: dynamic lines from the formula engine
      const earnings = lines
        .filter((l: any) => l.headType === 'EARNING' && l.showOnPayslip)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      const deductions = lines
        .filter((l: any) => l.headType === 'DEDUCTION' && l.showOnPayslip)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
      earnCol = [...earnings.map((e: any) => [e.headName, Number(e.totalAmount)] as [string, number]), ...adjEarnings];
      dedCol = [...deductions.map((d: any) => [d.headName, Math.abs(Number(d.totalAmount))] as [string, number]), ...adjDeductions];
    } else {
      // Legacy: fixed component columns
      earnCol = [
        ['Basic', Number(payslip.basic)],
        ['HRA', Number(payslip.hra)],
        ['DA', Number(payslip.da)],
        ['Special Allowance', Number(payslip.specialAllow)],
        ['Other Allowance', Number(payslip.otherAllow)],
        ...adjEarnings,
      ];
      dedCol = [
        ['PF (Employee)', Number(payslip.pfEmployee)],
        ['ESI (Employee)', Number(payslip.esiEmployee)],
        ['Professional Tax', Number(payslip.profTax)],
        ['TDS', Number(payslip.tds)],
        ['Other Deductions', Number(payslip.otherDeductions)],
        ...adjDeductions,
      ];
    }

    const maxRows = Math.max(earnCol.length, dedCol.length);
    let rowY = doc.y;
    for (let i = 0; i < maxRows; i++) {
      if (i < earnCol.length) {
        doc.text(String(earnCol[i][0]), 40, rowY);
        doc.text(fmt(earnCol[i][1]), 200, rowY, { width: 80, align: 'right' });
      }
      if (i < dedCol.length) {
        doc.text(String(dedCol[i][0]), 300, rowY);
        doc.text(fmt(dedCol[i][1]), 460, rowY, { width: 80, align: 'right' });
      }
      rowY += 16;
    }
    doc.y = rowY;

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // ── Totals ──
    doc.font('Helvetica-Bold').fontSize(10);
    const totY = doc.y;
    doc.text('Gross Earnings', 40, totY);
    doc.text(fmt(payslip.grossEarnings), 200, totY, { width: 80, align: 'right' });
    doc.text('Total Deductions', 300, totY);
    doc.text(fmt(payslip.totalDeductions), 460, totY, { width: 80, align: 'right' });

    // ── Non-taxable reimbursements (added to net, excluded from gross/tax) ──
    const reimb = Array.isArray((payslip as any).adjustments)
      ? ((payslip as any).adjustments as any[])
          .filter((a) => a?.type === 'REIMBURSEMENT')
          .reduce((s, a) => s + Number(a.amount || 0), 0)
      : 0;
    if (reimb > 0) {
      doc.moveDown(0.6);
      doc.font('Helvetica').fontSize(9).fillColor('#555555');
      doc.text('Add: Reimbursement (non-taxable)', 40, doc.y);
      doc.font('Helvetica-Bold').fillColor('#111111');
      doc.text(`+ ${fmt(reimb)}`, 200, doc.y, { width: 80, align: 'right' });
      doc.fillColor('#000000');
    }

    doc.moveDown(1.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#333333');
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#111111');
    doc.text(`Net Pay: ${fmt(payslip.netPay)}`, { align: 'center' });
    doc.fillColor('#000000');

    // ── Year to Date ──
    const sectionHeader = (label: string) => {
      doc.moveDown(1);
      const y = doc.y;
      doc.rect(40, y, 515, 16).fill('#f0f0f0');
      doc.fillColor('#333333').font('Helvetica-Bold').fontSize(9).text(label, 46, y + 4);
      doc.fillColor('#000000');
      doc.y = y + 20;
    };

    sectionHeader('YEAR TO DATE');
    const ytdY = doc.y;
    doc.font('Helvetica').fontSize(9);
    doc.text(`Gross Earnings: ${fmt(ytd.gross)}`, 46, ytdY);
    doc.text(`Deductions: ${fmt(ytd.ded)}`, 240, ytdY);
    doc.text(`Net Paid: ${fmt(ytd.net)}`, 420, ytdY);
    doc.y = ytdY + 16;

    // ── Leave Summary ──
    if (leaveBalances.length) {
      sectionHeader('LEAVE SUMMARY (' + payslip.year + ')');
      doc.font('Helvetica').fontSize(9);
      for (const b of leaveBalances) {
        const avail = Number(b.entitled) + Number(b.carriedOver) + Number(b.adjustment) - Number(b.used);
        const ly = doc.y;
        doc.text(b.leaveType.name, 46, ly, { width: 180 });
        doc.text(`Entitled: ${Number(b.entitled)}`, 240, ly);
        doc.text(`Used: ${Number(b.used)}`, 360, ly);
        doc.font('Helvetica-Bold').text(`Balance: ${avail}`, 450, ly);
        doc.font('Helvetica');
        doc.y = ly + 15;
      }
    }

    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text('This is a system-generated payslip and does not require a signature.', { align: 'center' });

    doc.end();

    return new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ── Portal: My Payslips ───────────────────────────

  async getMyPayslips(tenantId: string, userEmail: string, params: { year?: number }) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, email: userEmail, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const year = params.year ?? new Date().getFullYear();

    const slips = await this.prisma.payslip.findMany({
      where: { tenantId, employeeId: employee.id, year },
      orderBy: { month: 'desc' },
    });
    // attach engagement type so the portal can render consultant payslips correctly
    return slips.map((p) => ({ ...p, employee: { engagementType: (employee as any).engagementType } }));
  }

  // ── Formula-based Payroll Run (V2) ────────────────

  async runPayrollV2(tenantId: string, dto: RunPayrollDto, userId: string) {
    // Check for duplicate run
    const existing = await this.prisma.payrollRun.findUnique({
      where: { tenantId_month_year: { tenantId, month: dto.month, year: dto.year } },
    });
    if (existing) {
      throw new ConflictException(`Payroll already exists for ${dto.month}/${dto.year}. Delete it first to re-run.`);
    }

    // Sequential payroll: the previous month must be frozen/finalized before running this month.
    {
      const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const prevMonth = dto.month === 1 ? 12 : dto.month - 1;
      const prevYear = dto.month === 1 ? dto.year - 1 : dto.year;
      const prevRun = await this.prisma.payrollRun.findUnique({
        where: { tenantId_month_year: { tenantId, month: prevMonth, year: prevYear } },
      });
      if (prevRun && !['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(prevRun.status)) {
        throw new BadRequestException(
          `Cannot run ${MONTHS[dto.month]} ${dto.year} payroll — the ${MONTHS[prevMonth]} ${prevYear} payroll is still open (${prevRun.status}). Freeze or finalize it first.`,
        );
      }
    }

    // Get all active pay structure assignments with template + components
    const assignments = await this.prisma.payStructureAssignment.findMany({
      where: { tenantId, isActive: true },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeCode: true,
            status: true, joinDate: true, exitDate: true,
            engagementType: true, consultantTdsRate: true, taxRegime: true,
          },
        },
        template: {
          include: {
            components: {
              include: { head: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    // Filter to ACTIVE employees only
    const activeAssignments = assignments.filter((a: any) => a.employee.status === 'ACTIVE');

    if (activeAssignments.length === 0) {
      throw new BadRequestException(
        'No active employees with pay structure assignments. Assign pay structures first.',
      );
    }

    // Actual-month-day proration: per-day = monthly CTC ÷ (real days in the
    // month, 30/31/28/29), paid = active calendar days this month (respects
    // joining/exit date), minus unpaid leave.
    const PAYROLL_DIVISOR = new Date(dto.year, dto.month, 0).getDate();
    const monthStart = new Date(dto.year, dto.month - 1, 1);
    const monthEnd = new Date(dto.year, dto.month, 0);
    const fy = this.financialYearOf(dto.month, dto.year);

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    interface PayslipCreateData {
      tenantId: string;
      employeeId: string;
      month: number;
      year: number;
      basic: number;
      hra: number;
      da: number;
      specialAllow: number;
      otherAllow: number;
      grossEarnings: number;
      pfEmployee: number;
      esiEmployee: number;
      profTax: number;
      tds: number;
      tdsBreakdown: any;
      otherDeductions: number;
      totalDeductions: number;
      netPay: number;
      workingDays: number;
      paidDays: number;
      lopDays: number;
      lines: Array<{
        headId: string;
        headName: string;
        headType: string;
        rate: number;
        amount: number;
        arrearAmount: number;
        totalAmount: number;
        formula: string | null;
        sortOrder: number;
        showOnPayslip: boolean;
      }>;
    }

    const payslipDataList: PayslipCreateData[] = [];

    for (const assignment of activeAssignments) {
      const ctcMonthly = Number(assignment.ctcMonthly) || 0;
      if (ctcMonthly === 0) continue;

      // Uploaded monthly attendance override takes precedence over agent/web-derived data.
      const monthlyOverride = await this.prisma.monthlyAttendanceOverride.findUnique({
        where: { tenantId_employeeId_year_month: { tenantId, employeeId: assignment.employeeId, year: dto.year, month: dto.month } },
      });

      // Actual-days model: pay for the employee's ACTIVE CALENDAR days (joining/
      // exit aware), out of the real days in the month, minus loss-of-pay days.
      // A full-present month → daysInMonth/daysInMonth = full pay.
      // RULE: no attendance → no payout. We pay ONLY when there is a source of
      // attendance for the month — the uploaded monthly sheet OR web clock-in/out
      // records. No sheet row AND no clock-in ⇒ paidDays = 0 (not paid).
      const totalDays = PAYROLL_DIVISOR;
      const emp: any = assignment.employee;
      const empJoin = emp.joinDate ? new Date(emp.joinDate) : monthStart;
      const empExit = emp.exitDate ? new Date(emp.exitDate) : null;
      const activeStart = empJoin > monthStart ? empJoin : monthStart;
      const activeEnd = empExit && empExit < monthEnd ? empExit : monthEnd;
      let activeCalDays = 0;
      if (activeEnd >= activeStart) {
        activeCalDays = Math.round((activeEnd.getTime() - activeStart.getTime()) / 86400000) + 1;
      }
      const expectedWD = this.workingDaysInRange(activeStart, activeEnd);

      // Working days the employee was actually present, from whichever source exists.
      // null = NO attendance source for the month.
      let workingDaysPresent: number | null = null;
      if (monthlyOverride) {
        workingDaysPresent = Number(monthlyOverride.workingDays);
      } else {
        const att = await this.prisma.attendance.groupBy({
          by: ['status'],
          where: {
            tenantId,
            employeeId: assignment.employeeId,
            date: { gte: activeStart, lte: activeEnd },
          },
          _count: { _all: true },
        });
        if (att.length > 0) {
          let present = 0;
          for (const a of att) {
            const c = a._count._all;
            if (a.status === 'PRESENT' || a.status === 'WFH' || a.status === 'LEAVE') present += c;
            else if (a.status === 'HALF_DAY') present += c * 0.5;
          }
          workingDaysPresent = present;
        }
      }

      let paidDays = 0;
      if (workingDaysPresent !== null) {
        const lop = Math.max(0, expectedWD - workingDaysPresent);
        paidDays = Math.max(0, Math.min(PAYROLL_DIVISOR, activeCalDays - lop));
      }
      // else: no attendance for the month → no payout (paidDays stays 0)
      const lopDays = Math.max(0, PAYROLL_DIVISOR - paidDays);

      // Build components from template
      const components: PayComponent[] = (assignment as any).template.components.map((c: any) => ({
        headId: c.headId,
        headCode: c.head.code,
        headName: c.head.name,
        headType: c.head.type as 'EARNING' | 'DEDUCTION',
        formula: c.formula,
        isVariable: c.isVariable,
        showOnPayslip: c.showOnPayslip,
        hasArrear: c.hasArrear,
        affectsPf: c.affectsPf,
        affectsEsi: c.affectsEsi,
        affectsPt: c.affectsPt,
        affectsGratuity: c.affectsGratuity,
        roundingMode: c.roundingMode,
        roundingPrecision: c.roundingPrecision,
        sortOrder: c.sortOrder,
        isStatutory: c.head.isStatutory,
        statutoryType: c.head.statutoryType,
      }));

      const input: CalculationInput = {
        ctcMonthly,
        totalDays,
        paidDays,
      };

      const result = calculatePayStructure(components, input);

      // Map formula engine output → legacy payslip columns for backward compat
      const findAmount = (code: string) =>
        result.lines.find((l) => l.headCode === code)?.amount || 0;

      const grossEarnings = result.summary.totalEarnings;
      let totalDed = result.summary.totalDeductions;
      let netPay = result.summary.netPay;

      // Auto TDS: consultants = flat % (194J/194C); employees = income-tax slab (Sec 192)
      let autoTds = 0;
      let tdsBreakdown: any = null;
      const isConsultant = (assignment.employee as any).engagementType === 'CONSULTANT';
      if (isConsultant) {
        const rate = Number((assignment.employee as any).consultantTdsRate ?? 2);
        autoTds = Math.round((grossEarnings * rate) / 100);
        tdsBreakdown = { method: 'FLAT', section: rate >= 10 ? '194J' : '194C', ratePct: rate, monthlyGross: Math.round(grossEarnings), monthlyTds: autoTds };
      } else {
        const regime = (((assignment.employee as any).taxRegime as 'NEW' | 'OLD') || 'NEW');
        const res = await this.computeEmployeeMonthlyTds(tenantId, assignment.employeeId, ctcMonthly * 12, ctcMonthly * 0.5 * 12, ctcMonthly * 0.25 * 12, regime, fy);
        autoTds = res.monthly;
        tdsBreakdown = res.breakdown;
      }
      totalDed = totalDed + autoTds;
      netPay = grossEarnings - totalDed;

      totalGross += grossEarnings;
      totalDeductions += totalDed;
      totalNet += netPay;

      payslipDataList.push({
        tenantId,
        employeeId: assignment.employeeId,
        month: dto.month,
        year: dto.year,
        // Legacy columns. Consultants are paid a single consolidated professional fee (no Basic/HRA/Special split).
        basic: isConsultant ? 0 : (findAmount('BASIC_DA') || findAmount('BASIC')),
        hra: isConsultant ? 0 : findAmount('HRA'),
        da: isConsultant ? 0 : findAmount('DA'),
        specialAllow: isConsultant ? 0 : (findAmount('SPCLA') || findAmount('SPECIAL_ALLOW')),
        otherAllow: isConsultant ? 0 : (findAmount('BONUS') || findAmount('OTHER_ALLOW')),
        grossEarnings,
        pfEmployee: isConsultant ? 0 : findAmount('PF_EE'),
        esiEmployee: isConsultant ? 0 : findAmount('ESI_EE'),
        profTax: isConsultant ? 0 : findAmount('PT'),
        tds: (isConsultant ? 0 : findAmount('TDS')) + autoTds,
        tdsBreakdown,
        otherDeductions: 0,
        totalDeductions: totalDed,
        netPay,
        workingDays: totalDays,
        paidDays,
        lopDays,
        // Itemized lines. Consultants get a single "Professional Fees" line.
        lines: isConsultant
          ? []
          : result.lines.map((l) => ({
              headId: l.headId,
              headName: l.headName,
              headType: l.headType,
              rate: l.rate,
              amount: l.amount,
              arrearAmount: l.arrearAmount,
              totalAmount: l.totalAmount,
              formula: l.formula,
              sortOrder: l.sortOrder,
              showOnPayslip: l.showOnPayslip,
            })),
      });
    }

    if (payslipDataList.length === 0) {
      throw new BadRequestException('No employees with valid CTC amounts to process.');
    }

    // Create payroll run + payslips + payslip lines in transaction
    const payrollRun = await this.prisma.$transaction(async (tx: any) => {
      const run = await tx.payrollRun.create({
        data: {
          tenantId,
          month: dto.month,
          year: dto.year,
          runDate: new Date(),
          status: 'COMPLETED',
          totalGross,
          totalDeductions,
          totalNet,
          employeeCount: payslipDataList.length,
          processedBy: userId,
          notes: dto.notes,
        },
      });

      for (const data of payslipDataList) {
        const { lines, ...payslipFields } = data;

        const payslip = await tx.payslip.create({
          data: { ...payslipFields, payrollRunId: run.id },
        });

        // Create itemized payslip lines
        if (lines.length > 0) {
          await tx.payslipLine.createMany({
            data: lines.map((l: any) => ({
              payslipId: payslip.id,
              headId: l.headId,
              headName: l.headName,
              headType: l.headType,
              rate: l.rate,
              amount: l.amount,
              arrearAmount: l.arrearAmount,
              totalAmount: l.totalAmount,
              formula: l.formula,
              sortOrder: l.sortOrder,
              showOnPayslip: l.showOnPayslip,
            })),
          });
        }
      }

      return run;
    });

    return this.prisma.payrollRun.findUnique({
      where: { id: payrollRun.id },
      include: {
        payslips: {
          include: {
            employee: { select: { firstName: true, lastName: true, employeeCode: true } },
            lines: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  // ── Helpers ───────────────────────────────────────

  private financialYearOf(month: number, year: number): string {
    const start = month >= 4 ? year : year - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  }

  /** Monthly TDS for a salaried employee (Sec 192) with full computation breakdown. */
  private async computeEmployeeMonthlyTds(
    tenantId: string, employeeId: string, annualGross: number, annualBasic: number, annualHra: number,
    regime: 'NEW' | 'OLD', fy: string,
  ): Promise<{ monthly: number; breakdown: any }> {
    const cfg = await this.prisma.taxRegimeConfig.findUnique({
      where: { tenantId_regime_financialYear: { tenantId, regime, financialYear: fy } },
    });
    if (!cfg) {
      return { monthly: 0, breakdown: { method: 'SLAB', regime, financialYear: fy, note: 'No tax configuration found for this financial year', monthlyTds: 0 } };
    }
    const deductionItems: { label: string; amount: number }[] = [];
    let declarationApplied = false;
    if (regime === 'OLD') {
      const d = await this.prisma.itDeclaration.findUnique({
        where: { tenantId_employeeId_financialYear: { tenantId, employeeId, financialYear: fy } },
      });
      if (d && d.status === 'APPROVED') {
        declarationApplied = true;
        const cap = (v: any, c: number) => Math.min(Number(v) || 0, c);
        const push = (label: string, amt: number) => { if (amt > 0) deductionItems.push({ label, amount: Math.round(amt) }); };
        push('80C', cap(d.sec80C, 150000));
        push('80CCD(1B) NPS', cap(d.sec80CCD1B, 50000));
        push('80D Medical', cap(d.sec80D, 100000));
        push('80TTA Savings interest', cap(d.sec80TTA, 10000));
        push('24(b) Home loan interest', cap(d.homeLoanInterest, 200000));
        push('80E Education loan', Number(d.sec80E) || 0);
        push('80G Donations', Number(d.sec80G) || 0);
        push('Other deductions', Number(d.otherDeductions) || 0);
        const rent = Number(d.hraRentPaid) || 0;
        if (rent > 0 && annualBasic > 0) {
          const hraExempt = Math.max(0, Math.min(annualHra, rent - 0.1 * annualBasic, (d.metroCity ? 0.5 : 0.4) * annualBasic));
          push('HRA exemption', hraExempt);
        }
      }
    }
    const totalDeductions = deductionItems.reduce((a, b) => a + b.amount, 0);
    const stdDed = Number(cfg.standardDeduction);
    const taxable = Math.max(0, annualGross - stdDed - totalDeductions);
    const slabRows = await this.prisma.taxSlab.findMany({
      where: { tenantId, regime, financialYear: fy }, orderBy: { sortOrder: 'asc' },
    });
    const slabBreak: any[] = [];
    let grossTax = 0;
    for (const sl of slabRows) {
      const from = Number(sl.fromAmount);
      const to = sl.toAmount == null ? Infinity : Number(sl.toAmount);
      const inBand = taxable > from ? Math.min(taxable, to) - from : 0;
      const t = inBand * (Number(sl.ratePct) / 100);
      if (inBand > 0) slabBreak.push({ from, to: sl.toAmount == null ? null : Number(sl.toAmount), rate: Number(sl.ratePct), taxable: Math.round(inBand), tax: Math.round(t) });
      grossTax += t;
    }
    const rebateApplied = taxable <= Number(cfg.rebateMaxTaxable);
    const taxAfterRebate = rebateApplied ? 0 : grossTax;
    const cessPct = Number(cfg.cessPct);
    const cessAmount = (taxAfterRebate * cessPct) / 100;
    const annualTax = taxAfterRebate + cessAmount;
    const monthly = Math.round(annualTax / 12);
    const breakdown = {
      method: 'SLAB', regime, financialYear: fy,
      annualGross: Math.round(annualGross), standardDeduction: stdDed,
      declarationApplied, deductions: deductionItems, totalDeductions,
      taxableIncome: Math.round(taxable),
      slabs: slabBreak, grossTax: Math.round(grossTax),
      rebateApplied, rebateMaxTaxable: Number(cfg.rebateMaxTaxable),
      taxAfterRebate: Math.round(taxAfterRebate),
      cessPct, cessAmount: Math.round(cessAmount),
      annualTax: Math.round(annualTax), monthlyTds: monthly,
    };
    return { monthly, breakdown };
  }

  private getWorkingDays(year: number, month: number): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    let working = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0 && day !== 6) working++; // Exclude Sat & Sun
    }
    return working;
  }

  /** Count Mon–Fri working days in an inclusive [start, end] date range. */
  private workingDaysInRange(start: Date, end: Date): number {
    let working = 0;
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (d <= e) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) working++;
      d.setDate(d.getDate() + 1);
    }
    return working;
  }
}
