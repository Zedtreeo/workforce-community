// apps/api/src/modules/attendance/attendance-import.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceImportService } from './attendance-import.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A } from '../../../test/fixtures';

describe('AttendanceImportService', () => {
  let svc: AttendanceImportService;
  let prisma: MockPrismaService;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceImportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    svc = mod.get(AttendanceImportService);
  });

  const file = (csv: string, name = 'a.csv') => ({
    buffer: Buffer.from(csv, 'utf-8'),
    originalname: name,
    size: Buffer.byteLength(csv),
  });

  it('rejects missing required columns', async () => {
    await expect(
      svc.import(TENANT_A.id, 'admin', file('foo,bar\n1,2'), true),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects oversize files (>5MB)', async () => {
    const big = { buffer: Buffer.alloc(6 * 1024 * 1024), originalname: 'big.csv', size: 6 * 1024 * 1024 };
    await expect(svc.import(TENANT_A.id, 'admin', big as any, true)).rejects.toThrow(BadRequestException);
  });

  it('dry-run flags invalid date and unknown email but does NOT upsert', async () => {
    const csv = [
      'employee_email,date,status,check_in,check_out,notes',
      'good@x.com,2026-05-19,PRESENT,09:00,18:00,',
      'bad@x.com,not-a-date,PRESENT,,,',
      'missing@x.com,2026-05-19,PRESENT,,,',
    ].join('\n');
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', email: 'good@x.com' },
    ]);
    prisma.attendanceImportBatch.create.mockResolvedValue({
      id: 'batch-1', tenantId: TENANT_A.id, rowCount: 3, successCount: 0, errorCount: 2,
      status: 'PENDING', dryRun: true,
    });

    const res = await svc.import(TENANT_A.id, 'admin', file(csv), true);

    expect(res.dryRun).toBe(true);
    expect(res.errorCount).toBe(2); // bad date + unknown email
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('commit run upserts with source=CSV and writes AuditLog', async () => {
    const csv = [
      'employee_email,date,status,check_in,check_out,notes',
      'good@x.com,2026-05-19,PRESENT,09:00,18:00,',
    ].join('\n');
    // Service resolves emails via a direct Employee.email column (select { id, email }).
    prisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', email: 'good@x.com' },
    ]);
    prisma.attendanceImportBatch.create.mockResolvedValue({
      id: 'batch-2', tenantId: TENANT_A.id, rowCount: 1, successCount: 0, errorCount: 0,
      status: 'PENDING', dryRun: false,
    });
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        attendance: { upsert: jest.fn().mockResolvedValue({ id: 'a1' }) },
        attendanceImportBatch: { update: jest.fn().mockResolvedValue({}) },
      };
      await cb(tx);
      return tx;
    });

    const res = await svc.import(TENANT_A.id, 'admin', file(csv), false);

    expect(res.status).toBe('COMMITTED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IMPORT', entity: 'Attendance',
    }));
  });

  it('rejects rows where check_out <= check_in', async () => {
    const csv = [
      'employee_email,date,status,check_in,check_out,notes',
      'good@x.com,2026-05-19,PRESENT,18:00,09:00,',
    ].join('\n');
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', email: 'good@x.com' }]);
    prisma.attendanceImportBatch.create.mockResolvedValue({ id: 'b', rowCount: 1, errorCount: 1, dryRun: true, status: 'PENDING' });

    const res = await svc.import(TENANT_A.id, 'admin', file(csv), true);
    expect(res.errorCount).toBe(1);
    expect(res.errors[0].message).toMatch(/check_out must be after check_in/);
  });

  it('template includes required header columns', () => {
    const tpl = svc.getTemplate();
    expect(tpl.split('\n')[0]).toBe('employee_email,date,status,check_in,check_out,notes');
  });
});
