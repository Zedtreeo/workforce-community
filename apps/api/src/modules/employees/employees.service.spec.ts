import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../../prisma';
import { EmailService } from '../email/email.service';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import {
  TENANT_A, TENANT_B, ADMIN_USER, EMPLOYEE,
  EMPLOYEE_TENANT_B, DEPARTMENT,
} from '../../../test/fixtures';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: MockPrismaService;
  let emailService: { sendEmployeePortalInvite: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    emailService = { sendEmployeePortalInvite: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  // ─── CREATE ────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      employeeCode: 'EMP002',
      firstName: 'New',
      lastName: 'Hire',
      email: 'newhire@acme.com',
      phone: '+1111111111',
      departmentId: DEPARTMENT.id,
      designation: 'Developer',
      status: 'ACTIVE' as const,
      joinDate: '2025-06-01',
      salary: '80000',
      currency: 'USD',
    };

    it('should create an employee when code is unique', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue({ id: 'emp-new', ...dto, tenantId: TENANT_A.id });

      const result = await service.create(TENANT_A.id, dto, ADMIN_USER.id);

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { tenantId_employeeCode: { tenantId: TENANT_A.id, employeeCode: dto.employeeCode } },
      });
      expect(prisma.employee.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'emp-new');
    });

    it('should throw ConflictException for duplicate employee code within same tenant', async () => {
      prisma.employee.findUnique.mockResolvedValue(EMPLOYEE);

      await expect(service.create(TENANT_A.id, { ...dto, employeeCode: 'EMP001' }))
        .rejects.toThrow(ConflictException);
    });

    it('should allow same employee code in different tenant', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      prisma.employee.create.mockResolvedValue({ id: 'emp-b', tenantId: TENANT_B.id, ...dto });

      const result = await service.create(TENANT_B.id, dto);

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { tenantId_employeeCode: { tenantId: TENANT_B.id, employeeCode: dto.employeeCode } },
      });
      expect(result).toHaveProperty('tenantId', TENANT_B.id);
    });

    it('should grant portal access when grantPortalAccess flag is set', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      const created = { id: 'emp-portal', ...dto, tenantId: TENANT_A.id, firstName: 'New', lastName: 'Hire', email: dto.email };
      prisma.employee.create.mockResolvedValue(created);
      prisma.employee.findFirst.mockResolvedValue(created);
      // No existing (revoked or active) user for this email — passwordless portal
      // access provisions a fresh MEMBER user row; no invite email is sent.
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-new', email: dto.email, name: 'New Hire', role: 'MEMBER', createdAt: new Date() });

      const result = await service.create(TENANT_A.id, { ...dto, grantPortalAccess: true }, ADMIN_USER.id);

      expect(result.portalAccessGranted).toBe(true);
      expect(prisma.user.create).toHaveBeenCalled();
      // Login is passwordless email-OTP now — no setup/invite email.
      expect(emailService.sendEmployeePortalInvite).not.toHaveBeenCalled();
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated employees for a tenant', async () => {
      prisma.employee.findMany.mockResolvedValue([EMPLOYEE]);
      prisma.employee.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A.id, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      // Verify tenant isolation — the where clause must include tenantId
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A.id, deletedAt: null }),
        }),
      );
    });

    it('should NOT return employees from another tenant', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      const result = await service.findAll(TENANT_B.id, {});

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_B.id }),
        }),
      );
      expect(result.data).toHaveLength(0);
    });

    it('should filter by search term across name, email, code', async () => {
      prisma.employee.findMany.mockResolvedValue([EMPLOYEE]);
      prisma.employee.count.mockResolvedValue(1);

      await service.findAll(TENANT_A.id, { search: 'Jane' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: { contains: 'Jane', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should filter by status and departmentId', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { status: 'ACTIVE', departmentId: DEPARTMENT.id });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            departmentId: DEPARTMENT.id,
          }),
        }),
      );
    });

    it('should cap limit at 100', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { limit: 500 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ─── FIND ONE ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return employee belonging to the tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);

      const result = await service.findOne(TENANT_A.id, EMPLOYEE.id);

      expect(result).toEqual(EMPLOYEE);
      expect(prisma.employee.findFirst).toHaveBeenCalledWith({
        where: { id: EMPLOYEE.id, tenantId: TENANT_A.id, deletedAt: null },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException for wrong tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B.id, EMPLOYEE.id))
        .rejects.toThrow(NotFoundException);
    });

    it('should not return soft-deleted employees', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_A.id, 'deleted-emp'))
        .rejects.toThrow(NotFoundException);

      expect(prisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update employee fields', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
      const updated = { ...EMPLOYEE, designation: 'Lead Developer' };
      prisma.employee.update.mockResolvedValue(updated);

      const result = await service.update(TENANT_A.id, EMPLOYEE.id, { designation: 'Lead Developer' }, ADMIN_USER.id);

      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE.id },
          data: expect.objectContaining({ designation: 'Lead Developer', updatedBy: ADMIN_USER.id }),
        }),
      );
      expect(result.designation).toBe('Lead Developer');
    });

    it('should throw NotFoundException when updating employee from different tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.update(TENANT_B.id, EMPLOYEE.id, { designation: 'x' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── SOFT DELETE ───────────────────────────────────────────────────
  describe('remove', () => {
    it('should soft-delete by setting deletedAt', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
      prisma.employee.update.mockResolvedValue({ ...EMPLOYEE, deletedAt: new Date() });

      await service.remove(TENANT_A.id, EMPLOYEE.id, ADMIN_USER.id);

      expect(prisma.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date), updatedBy: ADMIN_USER.id }),
        }),
      );
    });

    it('should not delete employee from another tenant', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_B.id, EMPLOYEE.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── RESTORE ───────────────────────────────────────────────────────
  describe('restore', () => {
    it('should restore a soft-deleted employee', async () => {
      const deletedEmp = { ...EMPLOYEE, deletedAt: new Date() };
      prisma.employee.findFirst.mockResolvedValue(deletedEmp);
      prisma.employee.update.mockResolvedValue({ ...EMPLOYEE, deletedAt: null });

      const result = await service.restore(TENANT_A.id, EMPLOYEE.id);

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: EMPLOYEE.id },
        data: { deletedAt: null },
      });
    });

    it('should throw NotFoundException for non-deleted employee', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.restore(TENANT_A.id, EMPLOYEE.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── PORTAL ACCESS ─────────────────────────────────────────────────
  describe('grantPortalAccess', () => {
    it('should create a passwordless MEMBER user and enable access (no invite email)', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
      // No revoked row and no active row → create a fresh user.
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-new', email: EMPLOYEE.email, name: 'Jane Developer', role: 'MEMBER', createdAt: new Date() });

      const result = await service.grantPortalAccess(TENANT_A.id, EMPLOYEE.id);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A.id,
            email: EMPLOYEE.email,
            role: 'MEMBER',
            emailVerified: true,
          }),
        }),
      );
      // Passwordless email-OTP login — no setup/invite email is sent.
      expect(emailService.sendEmployeePortalInvite).not.toHaveBeenCalled();
      expect(result.enabled).toBe(true);
      expect(result.user).toEqual(expect.objectContaining({ id: 'user-new' }));
      expect(result.message).toContain('enabled');
    });

    it('should return "already enabled" (not throw) when an active user already exists', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
      // First findFirst (revoked lookup) → null; second (active lookup) → existing user.
      prisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user', email: EMPLOYEE.email, name: 'Jane Developer', role: 'MEMBER', createdAt: new Date() });

      const result = await service.grantPortalAccess(TENANT_A.id, EMPLOYEE.id);

      expect(result.enabled).toBe(true);
      expect(result.user).toEqual(expect.objectContaining({ id: 'existing-user' }));
      expect(result.message).toContain('already enabled');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should re-enable a previously revoked (soft-deleted) user without recreating it', async () => {
      prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
      // Revoked lookup returns a soft-deleted row → reactivate via update.
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'revoked-user', deletedAt: new Date() });
      prisma.user.update.mockResolvedValue({ id: 'revoked-user', email: EMPLOYEE.email, name: 'Jane Developer', role: 'MEMBER', createdAt: new Date() });

      const result = await service.grantPortalAccess(TENANT_A.id, EMPLOYEE.id);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'revoked-user' },
          data: expect.objectContaining({ deletedAt: null }),
        }),
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.enabled).toBe(true);
      expect(result.message).toContain('re-enabled');
    });
  });

  // ─── STATS ─────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('should return employee counts by status for a tenant', async () => {
      prisma.employee.count
        .mockResolvedValueOnce(50)   // total
        .mockResolvedValueOnce(40)   // active
        .mockResolvedValueOnce(5)    // inactive
        .mockResolvedValueOnce(5);   // terminated

      const stats = await service.getStats(TENANT_A.id);

      expect(stats).toEqual({ total: 50, active: 40, inactive: 5, terminated: 5 });
      // All four count calls must filter by tenantId
      for (const call of prisma.employee.count.mock.calls) {
        expect(call[0].where).toHaveProperty('tenantId', TENANT_A.id);
      }
    });
  });

  // ─── TENANT ISOLATION (cross-cutting) ──────────────────────────────
  describe('tenant isolation', () => {
    it('Tenant B cannot access Tenant A employee via findOne', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B.id, EMPLOYEE.id))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot update Tenant A employee', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.update(TENANT_B.id, EMPLOYEE.id, { designation: 'hacked' }))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot delete Tenant A employee', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.remove(TENANT_B.id, EMPLOYEE.id))
        .rejects.toThrow(NotFoundException);
    });
  });
});
