// Auto clock-out rule: a web clock-in session may run at most MAX_SHIFT_HOURS.
// A cron sweep closes any session left open past the limit at exactly
// clockIn + MAX_SHIFT_HOURS. An employee who is still working simply clocks in
// again, starting a fresh session.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TimeLog } from '@prisma/client';
import { PrismaService } from '../../prisma';

export const MAX_SHIFT_HOURS = 10;
export const MAX_SHIFT_MS = MAX_SHIFT_HOURS * 60 * 60 * 1000;

@Injectable()
export class AutoClockoutService {
  private readonly logger = new Logger(AutoClockoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async sweepStaleSessions() {
    const cutoff = new Date(Date.now() - MAX_SHIFT_MS);
    const stale = await this.prisma.timeLog.findMany({
      where: { clockOut: null, clockIn: { lt: cutoff } },
    });
    for (const tl of stale) {
      try {
        await this.autoClose(tl);
      } catch (e) {
        this.logger.error(`Auto clock-out failed for timeLog ${tl.id}: ${e}`);
      }
    }
    if (stale.length) {
      this.logger.log(`Auto-clocked-out ${stale.length} session(s) exceeding ${MAX_SHIFT_HOURS}h`);
    }
  }

  /** Close an open session at exactly clockIn + MAX_SHIFT_HOURS and sync attendance rows. */
  async autoClose(tl: TimeLog) {
    const clockOut = new Date(tl.clockIn.getTime() + MAX_SHIFT_MS);
    const duration = Math.floor(MAX_SHIFT_MS / 1000);

    await this.prisma.timeLog.update({
      where: { id: tl.id },
      data: {
        clockOut,
        duration,
        notes: `${tl.notes ? `${tl.notes} • ` : ''}Auto clock-out after ${MAX_SHIFT_HOURS}h`,
      },
    });

    // Mirror the attendance bookkeeping done by the manual clock-out flow
    const inDate = new Date(tl.clockIn.toISOString().split('T')[0]);
    const outDate = new Date(clockOut.toISOString().split('T')[0]);

    try {
      const existing = await this.prisma.attendance.findUnique({
        where: {
          tenantId_employeeId_date: {
            tenantId: tl.tenantId, employeeId: tl.employeeId, date: inDate,
          },
        },
      });
      if (existing) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: { checkOut: clockOut, workHours: MAX_SHIFT_HOURS as any },
        });
      }

      if (outDate.getTime() !== inDate.getTime()) {
        await this.prisma.attendance.upsert({
          where: {
            tenantId_employeeId_date: {
              tenantId: tl.tenantId, employeeId: tl.employeeId, date: outDate,
            },
          },
          create: {
            tenantId: tl.tenantId,
            employeeId: tl.employeeId,
            date: outDate,
            status: 'PRESENT',
            checkOut: clockOut,
            notes: 'Auto clock-out (overnight session)',
            source: 'SYSTEM',
          },
          update: { status: 'PRESENT', checkOut: clockOut },
        });
      }
    } catch (e) {
      this.logger.warn(`Attendance sync failed after auto clock-out of timeLog ${tl.id}: ${e}`);
    }
  }
}
