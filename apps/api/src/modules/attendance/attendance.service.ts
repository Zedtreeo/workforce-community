import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AuditService } from '../audit/audit.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark.dto';
import { RectifyAttendanceDto } from './dto/rectify-attendance.dto';
import { Prisma, AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Upsert a single attendance record (tenant + employee + date is unique).
   * If the row already exists, `reason` is required and an UPDATE AuditLog
   * entry is written.
   */
  async mark(
    tenantId: string,
    dto: MarkAttendanceDto & { reason?: string },
    markedBy?: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found in this tenant');
    }

    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    // Detect rectification — row already exists
    const existing = await this.prisma.attendance.findUnique({
      where: { tenantId_employeeId_date: { tenantId, employeeId: dto.employeeId, date } },
    });
    if (existing && !dto.reason) {
      throw new BadRequestException(
        'Rectifying an existing attendance row requires `reason` (min 5 chars)',
      );
    }

    const workHours = this.computeWorkHours(dto.checkIn, dto.checkOut);
    const checkIn = dto.checkIn ? new Date(dto.checkIn) : null;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : null;

    const after = await this.prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId: dto.employeeId, date } },
      create: {
        tenantId,
        employeeId: dto.employeeId,
        date,
        status: dto.status,
        checkIn,
        checkOut,
        workHours,
        notes: dto.notes,
        markedBy,
        source: 'MANUAL',
      },
      update: {
        status: dto.status,
        checkIn,
        checkOut,
        workHours,
        notes: dto.notes,
        markedBy,
        source: 'MANUAL',
      },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeCode: true,
          },
        },
      },
    });

    if (existing) {
      await this.audit.log({
        tenantId,
        userId: markedBy,
        action: 'UPDATE',
        entity: 'Attendance',
        entityId: after.id,
        changes: {
          before: this.snapshot(existing),
          after: this.snapshot(after),
          reason: dto.reason,
        },
      });
    } else {
      await this.audit.log({
        tenantId,
        userId: markedBy,
        action: 'CREATE',
        entity: 'Attendance',
        entityId: after.id,
        changes: { after: this.snapshot(after) },
      });
    }

    return after;
  }

  /**
   * Rectify by attendance row id — used by the Rectify drawer.
   * `reason` is required; writes UPDATE AuditLog with before/after snapshot.
   */
  async rectify(
    tenantId: string,
    id: string,
    dto: RectifyAttendanceDto,
    userId: string,
  ) {
    const existing = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Attendance row not found');

    const checkIn = dto.checkIn ? new Date(dto.checkIn) : null;
    const checkOut = dto.checkOut ? new Date(dto.checkOut) : null;
    if (checkIn && checkOut && checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }
    const workHours = this.computeWorkHours(dto.checkIn, dto.checkOut);

    const after = await this.prisma.attendance.update({
      where: { id },
      data: {
        status: dto.status,
        checkIn,
        checkOut,
        workHours,
        notes: dto.notes,
        markedBy: userId,
        source: 'MANUAL',
      },
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'UPDATE',
      entity: 'Attendance',
      entityId: id,
      changes: {
        before: this.snapshot(existing),
        after: this.snapshot(after),
        reason: dto.reason,
      },
    });

    return after;
  }

  /**
   * Change history for one attendance row.
   */
  async getAuditHistory(tenantId: string, attendanceId: string) {
    const row = await this.prisma.attendance.findFirst({
      where: { id: attendanceId, tenantId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Attendance row not found');

    return this.prisma.auditLog.findMany({
      where: { tenantId, entity: 'Attendance', entityId: attendanceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        userId: true,
        changes: true,
        ipAddress: true,
        createdAt: true,
      },
    });
  }

  /**
   * Bulk upsert — used by the "mark entire team for a day" flow.
   * Does NOT write audit log for performance; bulk operations are admin-only.
   */
  async bulkMark(tenantId: string, dto: BulkMarkAttendanceDto, markedBy?: string) {
    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const employeeIds = dto.entries.map((e) => e.employeeId);
    const validEmployees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds }, tenantId, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(validEmployees.map((e) => e.id));
    const filtered = dto.entries.filter((e) => validIds.has(e.employeeId));

    const results = await this.prisma.$transaction(
      filtered.map((entry) =>
        this.prisma.attendance.upsert({
          where: {
            tenantId_employeeId_date: {
              tenantId,
              employeeId: entry.employeeId,
              date,
            },
          },
          create: {
            tenantId,
            employeeId: entry.employeeId,
            date,
            status: entry.status,
            notes: entry.notes,
            markedBy,
            source: 'MANUAL',
          },
          update: {
            status: entry.status,
            notes: entry.notes,
            markedBy,
          },
        }),
      ),
    );

    return { count: results.length, skipped: dto.entries.length - results.length };
  }

  /**
   * List all employees with their attendance status on a specific date.
   */
  async getDailySheet(tenantId: string, dateStr: string) {
    const date = new Date(dateStr);
    date.setUTCHours(0, 0, 0, 0);

    const [employees, attendance] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId, deletedAt: null, status: 'ACTIVE' },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          designation: true,
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.attendance.findMany({
        where: { tenantId, date },
        // Include fields the UI needs for the Rectify drawer
        select: {
          id: true,
          employeeId: true,
          status: true,
          checkIn: true,
          checkOut: true,
          notes: true,
          source: true,
        },
      }),
    ]);

    const attendanceMap = new Map(attendance.map((a) => [a.employeeId, a]));

    const rows = employees.map((emp) => ({
      employee: emp,
      attendance: attendanceMap.get(emp.id) ?? null,
    }));

    const summary = {
      total: employees.length,
      present: attendance.filter((a) => a.status === 'PRESENT').length,
      absent: attendance.filter((a) => a.status === 'ABSENT').length,
      halfDay: attendance.filter((a) => a.status === 'HALF_DAY').length,
      leave: attendance.filter((a) => a.status === 'LEAVE').length,
      wfh: attendance.filter((a) => a.status === 'WFH').length,
      unmarked: employees.length - attendance.length,
    };

    return { date: dateStr, rows, summary };
  }

  /**
   * Get attendance history for a single employee within a date range.
   */
  async getEmployeeHistory(
    tenantId: string,
    employeeId: string,
    params: { from?: string; to?: string },
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const where: Prisma.AttendanceWhereInput = {
      tenantId,
      employeeId,
      ...(params.from || params.to
        ? {
            date: {
              ...(params.from && { gte: new Date(params.from) }),
              ...(params.to && { lte: new Date(params.to) }),
            },
          }
        : {}),
    };

    const records = await this.prisma.attendance.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200,
    });

    const { dailyHours, dailySessions, totalHours, totalSeconds } =
      await this.getDailyClockStats(tenantId, employeeId, params);

    return {
      employee,
      records,
      summary: this.summarize(records),
      dailyHours,
      dailySessions,
      totalHours,
      totalSeconds,
    };
  }

  /**
   * Per-day clock stats from time_logs: worked hours plus each day's first
   * clock-in and last clock-out (clockOut null while a session is running).
   *
   * A session belongs WHOLLY to its clock-in day (`TimeLog.date`, stamped at
   * clock-in) — an overnight shift (10 PM → 7 AM) is one 9h entry on the
   * clock-in date, never split at midnight. This matches how the clock-in
   * flow, the nightly consolidator and the 10h auto clock-out all attribute
   * attendance. Also used by the employee portal's monthly view.
   */
  async getDailyClockStats(
    tenantId: string,
    employeeId: string,
    params: { from?: string; to?: string },
  ) {
    const timeLogs = await this.prisma.timeLog.findMany({
      where: {
        tenantId,
        employeeId,
        ...(params.from || params.to
          ? {
              date: {
                ...(params.from && { gte: new Date(params.from) }),
                ...(params.to && { lte: new Date(params.to) }),
              },
            }
          : {}),
      },
      select: { date: true, clockIn: true, clockOut: true },
    });

    // Bucket whole sessions under their clock-in day.
    const hoursByDate: Record<string, number> = {};
    const firstInByDate: Record<string, number> = {};
    const lastOutByDate: Record<string, number> = {};
    const ongoingByDate: Record<string, boolean> = {};
    const now = Date.now();
    for (const tl of timeLogs) {
      const key = tl.date.toISOString().split('T')[0];
      const startMs = tl.clockIn.getTime();
      const endMs = tl.clockOut ? tl.clockOut.getTime() : now;
      hoursByDate[key] = (hoursByDate[key] || 0) + Math.max(0, Math.floor((endMs - startMs) / 1000));
      if (firstInByDate[key] === undefined || startMs < firstInByDate[key]) {
        firstInByDate[key] = startMs;
      }
      if (lastOutByDate[key] === undefined || endMs > lastOutByDate[key]) {
        lastOutByDate[key] = endMs;
        ongoingByDate[key] = !tl.clockOut;
      }
    }

    // Per-day clock-in/out from the time logs (source of truth for web clock-in)
    const dailySessions: Record<string, { clockIn: string; clockOut: string | null }> = {};
    for (const k of Object.keys(firstInByDate)) {
      dailySessions[k] = {
        clockIn: new Date(firstInByDate[k]).toISOString(),
        clockOut: ongoingByDate[k] ? null : new Date(lastOutByDate[k]).toISOString(),
      };
    }

    // Convert seconds → hours rounded to 2 decimals
    const dailyHours: Record<string, number> = {};
    let totalSeconds = 0;
    for (const [k, secs] of Object.entries(hoursByDate)) {
      dailyHours[k] = +(secs / 3600).toFixed(2);
      totalSeconds += secs;
    }

    return {
      dailyHours,
      dailySessions,
      totalHours: +(totalSeconds / 3600).toFixed(2),
      totalSeconds,
    };
  }

  /**
   * Tenant-wide monthly stats.
   */
  async getMonthlyStats(tenantId: string, year: number, month: number) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const records = await this.prisma.attendance.findMany({
      where: { tenantId, date: { gte: from, lte: to } },
      select: { status: true, employeeId: true },
    });

    return this.summarize(records);
  }

  /**
   * Delete a single attendance record.
   */
  async remove(tenantId: string, id: string) {
    const record = await this.prisma.attendance.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    return this.prisma.attendance.delete({ where: { id } });
  }

  // ──────────────── helpers ────────────────
  private snapshot(a: any) {
    return {
      status: a.status,
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      workHours: a.workHours,
      notes: a.notes,
      source: a.source,
    };
  }

  private computeWorkHours(
    checkIn?: string | Date | null,
    checkOut?: string | Date | null,
  ): Prisma.Decimal | null {
    if (!checkIn || !checkOut) return null;
    const inMs = new Date(checkIn).getTime();
    const outMs = new Date(checkOut).getTime();
    if (outMs <= inMs) return null;
    const hours = (outMs - inMs) / (1000 * 60 * 60);
    return new Prisma.Decimal(hours.toFixed(2));
  }

  private summarize(records: { status: AttendanceStatus }[]) {
    return {
      total: records.length,
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
      leave: records.filter((r) => r.status === 'LEAVE').length,
      holiday: records.filter((r) => r.status === 'HOLIDAY').length,
      weekend: records.filter((r) => r.status === 'WEEKEND').length,
      wfh: records.filter((r) => r.status === 'WFH').length,
    };
  }
}
