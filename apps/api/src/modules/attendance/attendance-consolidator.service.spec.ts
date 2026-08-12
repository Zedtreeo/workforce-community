// apps/api/src/modules/attendance/attendance-consolidator.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceConsolidatorService } from './attendance-consolidator.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A } from '../../../test/fixtures';

describe('AttendanceConsolidatorService', () => {
  let svc: AttendanceConsolidatorService;
  let prisma: MockPrismaService;

  const day = new Date('2026-05-19T00:00:00.000Z');
  const triple = { tenantId: TENANT_A.id, employeeId: 'emp-1', date: day };

  beforeEach(async () => {
    prisma = createMockPrisma();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceConsolidatorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    svc = mod.get(AttendanceConsolidatorService);
    // Default empty aggregates
    prisma.activitySnapshot.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _avg: { activityPercent: 0 },
      _sum: { keystrokes: 0, mouseClicks: 0 },
    });
  });

  it('SKIPS rows where existing Attendance has source=CSV', async () => {
    prisma.timeLog.groupBy.mockResolvedValue([triple]);
    prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', source: 'CSV' });

    const res = await svc.consolidate({ from: day, to: day });

    expect(res.skippedAuthoritative).toBe(1);
    expect(res.written).toBe(0);
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('SKIPS rows where existing Attendance has source=MANUAL', async () => {
    prisma.timeLog.groupBy.mockResolvedValue([triple]);
    prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', source: 'MANUAL' });

    const res = await svc.consolidate({ from: day, to: day });
    expect(res.skippedAuthoritative).toBe(1);
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('writes AGENT row when no existing Attendance — uses earliest clockIn + latest clockOut', async () => {
    prisma.timeLog.groupBy.mockResolvedValue([triple]);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.timeLog.findMany.mockResolvedValue([
      { clockIn: new Date('2026-05-19T09:00:00Z'), clockOut: new Date('2026-05-19T13:00:00Z'), duration: 4 * 3600 },
      { clockIn: new Date('2026-05-19T14:00:00Z'), clockOut: new Date('2026-05-19T18:30:00Z'), duration: 4.5 * 3600 },
    ]);

    const res = await svc.consolidate({ from: day, to: day });

    expect(res.written).toBe(1);
    const call = prisma.attendance.upsert.mock.calls[0][0];
    expect(call.create.source).toBe('AGENT');
    expect(call.create.checkIn.toISOString()).toBe('2026-05-19T09:00:00.000Z');
    expect(call.create.checkOut.toISOString()).toBe('2026-05-19T18:30:00.000Z');
    // total work_hours = 8.5
    expect(call.create.workHours.toString()).toBe('8.5');
  });

  it('overwrites existing AGENT row but does NOT change status if row exists', async () => {
    prisma.timeLog.groupBy.mockResolvedValue([triple]);
    prisma.attendance.findUnique.mockResolvedValue({ id: 'a-prev', source: 'AGENT' });
    prisma.timeLog.findMany.mockResolvedValue([
      { clockIn: new Date('2026-05-19T10:00:00Z'), clockOut: new Date('2026-05-19T16:00:00Z'), duration: 6 * 3600 },
    ]);

    await svc.consolidate({ from: day, to: day });

    const update = prisma.attendance.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('status'); // never touches status on existing row
    expect(update.source).toBe('AGENT');
  });

  it('skipsNoData when triple exists but findMany returns []', async () => {
    prisma.timeLog.groupBy.mockResolvedValue([triple]);
    prisma.attendance.findUnique.mockResolvedValue(null);
    prisma.timeLog.findMany.mockResolvedValue([]);

    const res = await svc.consolidate({ from: day, to: day });
    expect(res.skippedNoData).toBe(1);
  });
});
