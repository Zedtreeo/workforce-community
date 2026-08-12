// apps/api/src/modules/attendance/auto-clockout.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AutoClockoutService, MAX_SHIFT_MS } from './auto-clockout.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A } from '../../../test/fixtures';

describe('AutoClockoutService', () => {
  let svc: AutoClockoutService;
  let prisma: MockPrismaService;

  const clockIn = new Date('2026-07-03T17:11:13.052Z');
  const staleLog = {
    id: 'tl-1',
    tenantId: TENANT_A.id,
    employeeId: 'emp-1',
    date: new Date('2026-07-03T00:00:00.000Z'),
    clockIn,
    clockOut: null,
    duration: null,
    source: 'MANUAL',
    notes: 'Web clock-in',
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AutoClockoutService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    svc = mod.get(AutoClockoutService);
  });

  it('closes a stale session at exactly clockIn + 10h with 36000s duration', async () => {
    await svc.autoClose(staleLog as any);

    expect(prisma.timeLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tl-1' },
        data: expect.objectContaining({
          clockOut: new Date(clockIn.getTime() + MAX_SHIFT_MS),
          duration: 36000,
          notes: expect.stringContaining('Auto clock-out after 10h'),
        }),
      }),
    );
  });

  it('updates the clock-in date attendance row with checkOut and 10h workHours', async () => {
    prisma.attendance.findUnique.mockResolvedValue({ id: 'att-1' });

    await svc.autoClose(staleLog as any);

    expect(prisma.attendance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1' },
        data: expect.objectContaining({
          checkOut: new Date(clockIn.getTime() + MAX_SHIFT_MS),
          workHours: 10,
        }),
      }),
    );
  });

  it('marks the clock-out day PRESENT when the capped session crosses midnight', async () => {
    // 17:11 UTC + 10h = 03:11 next day → overnight
    await svc.autoClose(staleLog as any);

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_employeeId_date: {
            tenantId: TENANT_A.id,
            employeeId: 'emp-1',
            date: new Date('2026-07-04T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('does not touch the clock-out day when the capped session ends the same day', async () => {
    const morning = { ...staleLog, clockIn: new Date('2026-07-03T02:00:00.000Z') };

    await svc.autoClose(morning as any);

    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('sweep only closes sessions past the 10h cutoff', async () => {
    prisma.timeLog.findMany.mockResolvedValue([staleLog]);

    await svc.sweepStaleSessions();

    const where = prisma.timeLog.findMany.mock.calls[0][0].where;
    expect(where.clockOut).toBeNull();
    expect(where.clockIn.lt.getTime()).toBeLessThanOrEqual(Date.now() - MAX_SHIFT_MS);
    expect(prisma.timeLog.update).toHaveBeenCalledTimes(1);
  });

  it('sweep continues past a failing session', async () => {
    prisma.timeLog.findMany.mockResolvedValue([staleLog, { ...staleLog, id: 'tl-2' }]);
    prisma.timeLog.update
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});

    await expect(svc.sweepStaleSessions()).resolves.toBeUndefined();
    expect(prisma.timeLog.update).toHaveBeenCalledTimes(2);
  });
});
