import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A, TENANT_B, EMPLOYEE, ATTENDANCE } from '../../../test/fixtures';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  // ─── MARK ATTENDANCE ───────────────────────────────────────────────
  describe('mark', () => {
    const dto = {
      employeeId: EMPLOYEE.id,
      date: '2025-03-10',
      status: 'PRESENT' as const,
      checkIn: '2025-03-10T09:00:00Z',
      checkOut: '2025-03-10T18:00:00Z',
    };

    it('should upsert attendance for valid employee in tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE.id });
      prisma.attendance.upsert.mockResolvedValue({
        id: 'att-new', ...dto, tenantId: TENANT_A.id,
        employee: { id: EMPLOYEE.id, firstName: 'Jane', lastName: 'Developer', employeeCode: 'EMP001' },
      });

      const result = await service.mark(TENANT_A.id, dto, 'admin-user');

      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: dto.employeeId, tenantId: TENANT_A.id, deletedAt: null },
        select: { id: true },
      });
      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId_employeeId_date: expect.objectContaining({
              tenantId: TENANT_A.id,
              employeeId: dto.employeeId,
            }),
          },
        }),
      );
      expect(result).toHaveProperty('id', 'att-new');
    });

    it('should throw NotFoundException for employee from different tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.mark(TENANT_B.id, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('should compute work hours from check-in/check-out', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: EMPLOYEE.id });
      prisma.attendance.upsert.mockResolvedValue({ id: 'att-hours' });

      await service.mark(TENANT_A.id, dto);

      const createData = prisma.attendance.upsert.mock.calls[0][0].create;
      expect(createData.workHours).toBeTruthy(); // 9 hours
    });
  });

  // ─── BULK MARK ─────────────────────────────────────────────────────
  describe('bulkMark', () => {
    it('should only mark attendance for employees that belong to the tenant', async () => {
      const dto = {
        date: '2025-03-10',
        entries: [
          { employeeId: 'emp-valid', status: 'PRESENT' as const },
          { employeeId: 'emp-invalid', status: 'PRESENT' as const },
        ],
      };
      prisma.employee.findMany.mockResolvedValue([{ id: 'emp-valid' }]);
      prisma.$transaction.mockResolvedValue([{ id: 'att-1' }]);

      const result = await service.bulkMark(TENANT_A.id, dto);

      expect(result.skipped).toBe(1);
    });
  });

  // ─── DAILY SHEET ───────────────────────────────────────────────────
  describe('getDailySheet', () => {
    it('should return all employees with their attendance status', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', employeeCode: 'E1', firstName: 'A', lastName: 'B', designation: 'Dev' },
        { id: 'emp-2', employeeCode: 'E2', firstName: 'C', lastName: 'D', designation: 'QA' },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { employeeId: 'emp-1', status: 'PRESENT' },
      ]);

      const result = await service.getDailySheet(TENANT_A.id, '2025-03-10');

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].attendance).toBeTruthy();
      expect(result.rows[1].attendance).toBeNull();
      expect(result.summary.present).toBe(1);
      expect(result.summary.unmarked).toBe(1);
    });
  });

  // ─── EMPLOYEE HISTORY ──────────────────────────────────────────────
  describe('getEmployeeHistory', () => {
    it('should return attendance records within date range', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: EMPLOYEE.id, firstName: 'Jane', lastName: 'Developer', employeeCode: 'EMP001',
      });
      prisma.attendance.findMany.mockResolvedValue([
        { status: 'PRESENT', date: new Date('2025-03-10') },
        { status: 'ABSENT', date: new Date('2025-03-11') },
      ]);

      const result = await service.getEmployeeHistory(TENANT_A.id, EMPLOYEE.id, {
        from: '2025-03-01', to: '2025-03-31',
      });

      expect(result.records).toHaveLength(2);
      expect(result.summary.present).toBe(1);
      expect(result.summary.absent).toBe(1);
    });

    it('should throw NotFoundException for employee not in tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(
        service.getEmployeeHistory(TENANT_B.id, EMPLOYEE.id, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── REMOVE ────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should delete attendance record in same tenant', async () => {
      prisma.attendance.findFirst.mockResolvedValue(ATTENDANCE);
      prisma.attendance.delete.mockResolvedValue(ATTENDANCE);

      await service.remove(TENANT_A.id, ATTENDANCE.id);

      expect(prisma.attendance.delete).toHaveBeenCalledWith({ where: { id: ATTENDANCE.id } });
    });

    it('should throw NotFoundException for record from different tenant', async () => {
      prisma.attendance.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_B.id, ATTENDANCE.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── TENANT ISOLATION ──────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('cannot mark attendance for employee in different tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.mark(TENANT_B.id, {
        employeeId: EMPLOYEE.id,
        date: '2025-03-10',
        status: 'PRESENT',
      })).rejects.toThrow(NotFoundException);
    });
  });
});
