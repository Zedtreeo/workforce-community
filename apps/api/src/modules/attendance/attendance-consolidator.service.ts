// apps/api/src/modules/attendance/attendance-consolidator.service.ts
//
// Rolls raw agent data (TimeLog + ActivitySnapshot) into one Attendance row
// per (tenant, employee, date) with source=AGENT.
//
// PRECEDENCE RULE: never overwrites rows where source ∈ {CSV, MANUAL}.
// Those are admin-authoritative.
//
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { Prisma } from '@prisma/client';

interface ConsolidateParams {
  tenantId?: string;          // omit to process all tenants
  employeeId?: string;
  from: Date;                 // inclusive UTC date
  to: Date;                   // inclusive UTC date
}

export interface ConsolidateResult {
  scanned: number;
  written: number;
  skippedAuthoritative: number;
  skippedNoData: number;
}

export interface ConsolidateParamsExport extends ConsolidateParams {}

@Injectable()
export class AttendanceConsolidatorService {
  private readonly logger = new Logger(AttendanceConsolidatorService.name);
  // CSV + MANUAL win — agent never overwrites them.
  private static readonly AUTHORITATIVE_SOURCES: string[] = ['CSV', 'MANUAL'];

  constructor(private readonly prisma: PrismaService) {}

  async consolidate(params: ConsolidateParams): Promise<ConsolidateResult> {
    const result: ConsolidateResult = {
      scanned: 0,
      written: 0,
      skippedAuthoritative: 0,
      skippedNoData: 0,
    };

    // Find (tenant, employee, date) triples that HAVE agent data in the window
    const triples = await this.prisma.timeLog.groupBy({
      by: ['tenantId', 'employeeId', 'date'],
      where: {
        date: { gte: this.startOfDayUTC(params.from), lte: this.endOfDayUTC(params.to) },
        ...(params.tenantId && { tenantId: params.tenantId }),
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
    });

    result.scanned = triples.length;

    for (const t of triples) {
      const dayStart = this.startOfDayUTC(t.date);
      const dayEnd = this.endOfDayUTC(t.date);

      // 1. Check existing Attendance row — skip if authoritative
      const existing = await this.prisma.attendance.findUnique({
        where: {
          tenantId_employeeId_date: {
            tenantId: t.tenantId,
            employeeId: t.employeeId,
            date: dayStart,
          },
        },
        select: { id: true, source: true },
      });
      if (existing && ['CSV', 'MANUAL'].includes(existing.source)) {
        result.skippedAuthoritative++;
        continue;
      }

      // 2. Pull all TimeLogs for the day
      const logs = await this.prisma.timeLog.findMany({
        where: {
          tenantId: t.tenantId,
          employeeId: t.employeeId,
          date: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { clockIn: 'asc' },
        select: { clockIn: true, clockOut: true, duration: true },
      });

      if (!logs.length) {
        result.skippedNoData++;
        continue;
      }

      const firstIn = logs[0].clockIn;
      const lastOut =
        logs
          .map((l) => l.clockOut)
          .filter((x): x is Date => x !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      // Sum durations (seconds) → work hours
      const totalSec = logs.reduce(
        (acc, l) =>
          acc +
          (l.duration ??
            (l.clockOut ? Math.floor((l.clockOut.getTime() - l.clockIn.getTime()) / 1000) : 0)),
        0,
      );
      const workHours = new Prisma.Decimal((totalSec / 3600).toFixed(2));

      // Optional: surface idle ratio in notes from ActivitySnapshot
      const snapAgg = await this.prisma.activitySnapshot.aggregate({
        where: {
          tenantId: t.tenantId,
          employeeId: t.employeeId,
          capturedAt: { gte: dayStart, lte: dayEnd },
        },
        _count: { _all: true },
        _avg: { activityPercent: true },
        _sum: { keystrokes: true, mouseClicks: true },
      });
      const notes = snapAgg._count._all
        ? `agent: avg activity ${Math.round(snapAgg._avg.activityPercent ?? 0)}%, ${snapAgg._sum.keystrokes ?? 0} keys`
        : 'agent: time logs only';

      await this.prisma.attendance.upsert({
        where: {
          tenantId_employeeId_date: {
            tenantId: t.tenantId,
            employeeId: t.employeeId,
            date: dayStart,
          },
        },
        create: {
          tenantId: t.tenantId,
          employeeId: t.employeeId,
          date: dayStart,
          status: 'PRESENT',
          checkIn: firstIn,
          checkOut: lastOut,
          workHours,
          notes,
          source: 'AGENT',
          markedBy: null,
        },
        update: {
          // Only touch fields we own — never status if admin set it
          checkIn: firstIn,
          checkOut: lastOut,
          workHours,
          notes,
          source: 'AGENT',
          ...(existing ? {} : { status: 'PRESENT' }),
        },
      });

      result.written++;
    }

    this.logger.log(
      `consolidate ${params.tenantId ?? 'ALL'}: scanned=${result.scanned} written=${result.written} skipAuth=${result.skippedAuthoritative} skipNoData=${result.skippedNoData}`,
    );
    return result;
  }

  private startOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(0, 0, 0, 0);
    return x;
  }
  private endOfDayUTC(d: Date): Date {
    const x = new Date(d);
    x.setUTCHours(23, 59, 59, 999);
    return x;
  }
}
