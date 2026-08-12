// apps/api/src/modules/attendance/attendance.service.rectify.spec.ts
// Tests for the rectify() method + mark() audit wiring added by Task #59.
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A, EMPLOYEE } from '../../../test/fixtures';

describe('AttendanceService — rectify + audit wiring', () => {
  let svc: AttendanceService;
  let prisma: MockPrismaService;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(AttendanceService);
  });

  describe('mark() — rectification requires reason', () => {
    const dto = { employeeId: EMPLOYEE.id, date: '2026-05-19', status: 'PRESENT' as const };

    it('rejects update of existing row without reason', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE.id });
      prisma.attendance.findUnique.mockResolvedValue({ id: 'existing-row' });

      await expect(svc.mark(TENANT_A.id, dto, 'admin'))
        .rejects.toThrow(BadRequestException);
      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    });

    it('writes UPDATE audit log when row exists and reason provided', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE.id });
      prisma.attendance.findUnique.mockResolvedValue({
        id: 'e1', status: 'ABSENT', checkIn: null, checkOut: null, notes: null, source: 'AGENT',
      });
      prisma.attendance.upsert.mockResolvedValue({
        id: 'e1', status: 'PRESENT', checkIn: null, checkOut: null, notes: null, source: 'MANUAL',
      });

      await svc.mark(TENANT_A.id, { ...dto, reason: 'corrected after review' }, 'admin');

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entity: 'Attendance',
        changes: expect.objectContaining({
          reason: 'corrected after review',
          before: expect.objectContaining({ status: 'ABSENT' }),
          after: expect.objectContaining({ status: 'PRESENT' }),
        }),
      }));
    });

    it('writes CREATE audit log when row does NOT exist', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE.id });
      prisma.attendance.findUnique.mockResolvedValue(null);
      prisma.attendance.upsert.mockResolvedValue({ id: 'new', status: 'PRESENT' });

      await svc.mark(TENANT_A.id, dto, 'admin');

      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE',
        entity: 'Attendance',
      }));
    });
  });

  describe('rectify()', () => {
    const target = { id: 'row-1' };

    it('throws NotFoundException for row in different tenant', async () => {
      prisma.attendance.findFirst.mockResolvedValue(null);
      await expect(
        svc.rectify(TENANT_A.id, 'row-x', {
          status: 'PRESENT', reason: 'test reason ok',
        } as any, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes UPDATE audit log with before/after/reason', async () => {
      prisma.attendance.findFirst.mockResolvedValue({
        ...target, status: 'PRESENT', checkIn: null, checkOut: null, notes: null, source: 'AGENT',
      });
      prisma.attendance.update.mockResolvedValue({
        ...target, status: 'ABSENT', checkIn: null, checkOut: null, notes: 'sick', source: 'MANUAL',
      });

      await svc.rectify(TENANT_A.id, target.id, {
        status: 'ABSENT',
        notes: 'sick',
        reason: 'Called out sick',
      } as any, 'admin-id');

      expect(prisma.attendance.update.mock.calls[0][0].data.source).toBe('MANUAL');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE', entity: 'Attendance', entityId: target.id,
        changes: expect.objectContaining({ reason: 'Called out sick' }),
      }));
    });

    it('rejects when checkOut <= checkIn', async () => {
      prisma.attendance.findFirst.mockResolvedValue({ ...target });
      await expect(
        svc.rectify(TENANT_A.id, target.id, {
          status: 'PRESENT',
          checkIn: '2026-05-19T18:00:00Z',
          checkOut: '2026-05-19T09:00:00Z',
          reason: 'oops backwards',
        } as any, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAuditHistory()', () => {
    it('returns AuditLog entries scoped to entity=Attendance', async () => {
      prisma.attendance.findFirst.mockResolvedValue({ id: 'row-1' });
      prisma.auditLog.findMany.mockResolvedValue([
        { id: 'a1', action: 'UPDATE', changes: {}, createdAt: new Date() },
      ]);
      const res = await svc.getAuditHistory(TENANT_A.id, 'row-1');
      expect(res).toHaveLength(1);
      expect(prisma.auditLog.findMany.mock.calls[0][0].where.entity).toBe('Attendance');
      expect(prisma.auditLog.findMany.mock.calls[0][0].where.entityId).toBe('row-1');
    });
  });
});
