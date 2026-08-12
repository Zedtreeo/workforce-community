import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { EmployeesService } from '../employees/employees.service';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export interface Adjustment { label: string; amount: number; }

export interface FnF {
  employee: string;
  code: string;
  lastWorkingDay: string;
  ctcMonthly: number;
  pendingSalaryDays: number;
  daysInMonth: number;
  pendingSalaryAmount: number;
  adjustments: Adjustment[];
  netSettlement: number;
}

@Injectable()
export class ExitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
  ) {}

  async list(tenantId: string, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    const rows = await this.prisma.employeeExit.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    const empIds = rows.map((r) => r.employeeId);
    const emps = await this.prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    const byId = new Map(emps.map((e) => [e.id, e]));
    return rows.map((r) => {
      const e = byId.get(r.employeeId);
      return {
        ...r,
        employeeName: e ? `${e.firstName} ${e.lastName}`.trim() : null,
        employeeCode: e?.employeeCode ?? null,
      };
    });
  }

  async getByEmployee(tenantId: string, employeeId: string) {
    return this.prisma.employeeExit.findFirst({ where: { tenantId, employeeId } });
  }

  private async activeCtcMonthly(tenantId: string, employeeId: string, fallbackAnnual: any): Promise<number> {
    const a = await this.prisma.payStructureAssignment.findFirst({
      where: { tenantId, employeeId, isActive: true },
      select: { ctcMonthly: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (a?.ctcMonthly) return Number(a.ctcMonthly);
    return fallbackAnnual ? Number(fallbackAnnual) / 12 : 0;
  }

  async initiate(
    tenantId: string,
    dto: { employeeId: string; lastWorkingDay: string; resignationDate?: string; reason?: string; exitType?: string },
    userId?: string,
  ) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    const existing = await this.prisma.employeeExit.findUnique({ where: { employeeId: dto.employeeId } });
    if (existing && existing.status === 'SETTLED') {
      throw new ConflictException('This employee has already been settled/exited.');
    }
    const lwd = new Date(dto.lastWorkingDay);
    if (Number.isNaN(lwd.getTime())) throw new BadRequestException('lastWorkingDay must be a valid date.');
    const exitType = dto.exitType === 'TERMINATION' ? 'TERMINATION' : 'RESIGNATION';

    const exit = await this.prisma.employeeExit.upsert({
      where: { employeeId: dto.employeeId },
      create: {
        tenantId,
        employeeId: dto.employeeId,
        exitType,
        resignationDate: dto.resignationDate ? new Date(dto.resignationDate) : null,
        lastWorkingDay: lwd,
        reason: dto.reason || null,
        status: 'INITIATED',
        initiatedBy: userId,
      },
      update: {
        status: 'INITIATED',
        exitType,
        resignationDate: dto.resignationDate ? new Date(dto.resignationDate) : null,
        lastWorkingDay: lwd,
        reason: dto.reason || null,
        initiatedBy: userId,
      },
    });
    await this.prisma.employee.update({
      where: { id: dto.employeeId },
      data: { status: 'ON_NOTICE', exitDate: lwd },
    });
    return exit;
  }

  async previewFnF(tenantId: string, employeeId: string, adjustments: Adjustment[] = []): Promise<FnF> {
    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
      select: { salary: true, firstName: true, lastName: true, employeeCode: true },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    const exit = await this.prisma.employeeExit.findUnique({ where: { employeeId } });
    if (!exit) throw new NotFoundException('No exit has been initiated for this employee.');

    const ctcMonthly = await this.activeCtcMonthly(tenantId, employeeId, emp.salary);
    const lwd = new Date(exit.lastWorkingDay);
    // Pending salary = days from the 1st of the exit month through the last
    // working day, prorated over the ACTUAL number of days in that month.
    const pendingSalaryDays = lwd.getUTCDate();
    const daysInMonth = new Date(lwd.getUTCFullYear(), lwd.getUTCMonth() + 1, 0).getDate();
    const pendingSalaryAmount = Math.round((ctcMonthly * pendingSalaryDays) / daysInMonth);
    const adj = (adjustments || [])
      .filter((a) => a && typeof a.label === 'string' && a.label.trim() && typeof a.amount === 'number' && !Number.isNaN(a.amount))
      .map((a) => ({ label: a.label.trim(), amount: Math.round(a.amount) }));
    const adjSum = adj.reduce((s, a) => s + a.amount, 0);
    return {
      employee: `${emp.firstName} ${emp.lastName}`.trim(),
      code: emp.employeeCode,
      lastWorkingDay: lwd.toISOString().slice(0, 10),
      ctcMonthly: Math.round(ctcMonthly),
      pendingSalaryDays,
      daysInMonth,
      pendingSalaryAmount,
      adjustments: adj,
      netSettlement: pendingSalaryAmount + adjSum,
    };
  }

  async settle(
    tenantId: string,
    employeeId: string,
    dto: { adjustments?: Adjustment[]; notes?: string },
    userId?: string,
  ) {
    const exit = await this.prisma.employeeExit.findUnique({ where: { employeeId } });
    if (!exit || exit.tenantId !== tenantId) throw new NotFoundException('No exit initiated for this employee.');
    if (exit.status === 'SETTLED') throw new BadRequestException('This exit is already settled.');

    const fnf = await this.previewFnF(tenantId, employeeId, dto.adjustments || []);
    const pdfPath = await this.generateSettlementPdf(tenantId, fnf, dto.notes);

    const updated = await this.prisma.employeeExit.update({
      where: { employeeId },
      data: {
        status: 'SETTLED',
        ctcMonthly: fnf.ctcMonthly,
        pendingSalaryDays: fnf.pendingSalaryDays,
        pendingSalaryAmount: fnf.pendingSalaryAmount,
        adjustments: fnf.adjustments as any,
        netSettlement: fnf.netSettlement,
        settlementNotes: dto.notes || null,
        settlementPdfPath: pdfPath,
        settledAt: new Date(),
        settledBy: userId,
      },
    });
    // Deactivate the employee + cut portal access.
    await this.prisma.employee.update({ where: { id: employeeId }, data: { status: 'TERMINATED' } });
    try {
      await this.employees.revokePortalAccess(tenantId, employeeId);
    } catch {
      /* best-effort */
    }
    return updated;
  }

  async cancel(tenantId: string, employeeId: string) {
    const exit = await this.prisma.employeeExit.findUnique({ where: { employeeId } });
    if (!exit || exit.tenantId !== tenantId) throw new NotFoundException('No exit found for this employee.');
    if (exit.status === 'SETTLED') throw new BadRequestException('A settled exit cannot be cancelled.');
    await this.prisma.employeeExit.update({ where: { employeeId }, data: { status: 'CANCELLED' } });
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { status: 'ACTIVE', exitDate: null },
    });
    return { ok: true };
  }

  async settlementPdf(tenantId: string, employeeId: string) {
    const exit = await this.prisma.employeeExit.findFirst({ where: { tenantId, employeeId } });
    if (!exit?.settlementPdfPath || !fs.existsSync(exit.settlementPdfPath)) {
      throw new NotFoundException('No settlement statement available.');
    }
    return { buffer: fs.readFileSync(exit.settlementPdfPath), fileName: path.basename(exit.settlementPdfPath) };
  }

  private async generateSettlementPdf(tenantId: string, fnf: FnF, notes?: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const dir = path.join(process.cwd(), 'uploads', tenantId, 'settlements');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `FnF-${fnf.code}-${Date.now()}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(file);
    doc.pipe(stream);

    doc.fontSize(18).text('Full & Final Settlement', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#555').text(tenant?.name || '', { align: 'center' });
    doc.fillColor('#000').moveDown(1);

    doc.fontSize(10);
    doc.text(`Employee: ${fnf.employee} (${fnf.code})`);
    doc.text(`Last Working Day: ${fnf.lastWorkingDay}`);
    doc.text(`Statement Date: ${new Date().toISOString().slice(0, 10)}`);
    doc.moveDown(1);

    const money = (n: number) => n.toLocaleString('en-IN');
    doc.font('Helvetica-Bold').text('Settlement Breakdown');
    doc.font('Helvetica').moveDown(0.5);
    doc.text(`Pending salary (${fnf.pendingSalaryDays} of ${fnf.daysInMonth} day(s) @ ${money(fnf.ctcMonthly)}/month):`, { continued: true });
    doc.text(`  ${money(fnf.pendingSalaryAmount)}`, { align: 'right' });
    for (const a of fnf.adjustments) {
      doc.text(`${a.label}:`, { continued: true });
      doc.text(`  ${a.amount >= 0 ? '+' : '−'}${money(Math.abs(a.amount))}`, { align: 'right' });
    }
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Net Settlement Payable:', { continued: true });
    doc.text(`  ${money(fnf.netSettlement)}`, { align: 'right' });
    doc.font('Helvetica').fontSize(10);

    if (notes) {
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#555').text(`Notes: ${notes}`);
      doc.fillColor('#000');
    }
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#888').text('This is a system-generated settlement statement.', { align: 'center' });

    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
    return file;
  }
}
