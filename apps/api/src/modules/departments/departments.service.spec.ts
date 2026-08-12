import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A, TENANT_B, DEPARTMENT } from '../../../test/fixtures';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  // ─── CREATE ────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = { name: 'Marketing', code: 'MKT', description: 'Marketing department' };

    it('should create a department when code is unique within tenant', async () => {
      prisma.department.findUnique.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({
        id: 'dept-new', tenantId: TENANT_A.id, ...dto, _count: { employees: 0 },
      });

      const result = await service.create(TENANT_A.id, dto);

      expect(prisma.department.findUnique).toHaveBeenCalledWith({
        where: { tenantId_code: { tenantId: TENANT_A.id, code: 'MKT' } },
      });
      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: TENANT_A.id, name: 'Marketing' }),
        }),
      );
      expect(result).toHaveProperty('id', 'dept-new');
    });

    it('should throw ConflictException for duplicate code within tenant', async () => {
      prisma.department.findUnique.mockResolvedValue(DEPARTMENT);

      await expect(service.create(TENANT_A.id, { ...dto, code: DEPARTMENT.name }))
        .rejects.toThrow(ConflictException);
    });

    it('should allow same code in different tenant', async () => {
      prisma.department.findUnique.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({
        id: 'dept-b', tenantId: TENANT_B.id, ...dto, _count: { employees: 0 },
      });

      const result = await service.create(TENANT_B.id, dto);
      expect(result.tenantId).toBe(TENANT_B.id);
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated departments filtered by tenant', async () => {
      prisma.department.findMany.mockResolvedValue([DEPARTMENT]);
      prisma.department.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A.id, {});

      expect(result.data).toHaveLength(1);
      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A.id, deletedAt: null }),
        }),
      );
    });

    it('should search by name and code', async () => {
      prisma.department.findMany.mockResolvedValue([]);
      prisma.department.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { search: 'eng' });

      expect(prisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'eng', mode: 'insensitive' } },
              { code: { contains: 'eng', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  // ─── FIND ONE ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return department with employee preview', async () => {
      prisma.department.findFirst.mockResolvedValue({
        ...DEPARTMENT, _count: { employees: 3 }, employees: [],
      });

      const result = await service.findOne(TENANT_A.id, DEPARTMENT.id);
      expect(result).toHaveProperty('_count');
    });

    it('should throw NotFoundException for wrong tenant', async () => {
      prisma.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B.id, DEPARTMENT.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update department name', async () => {
      prisma.department.findFirst.mockResolvedValue(DEPARTMENT);
      prisma.department.update.mockResolvedValue({ ...DEPARTMENT, name: 'Engineering v2' });

      const result = await service.update(TENANT_A.id, DEPARTMENT.id, { name: 'Engineering v2' });
      expect(result.name).toBe('Engineering v2');
    });

    it('should reject duplicate code on update', async () => {
      prisma.department.findFirst
        .mockResolvedValueOnce(DEPARTMENT)             // findOne check
        .mockResolvedValueOnce({ id: 'other-dept' });  // duplicate code check

      await expect(service.update(TENANT_A.id, DEPARTMENT.id, { code: 'DUP' }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── SOFT DELETE ───────────────────────────────────────────────────
  describe('remove', () => {
    it('should soft-delete department', async () => {
      prisma.department.findFirst.mockResolvedValue(DEPARTMENT);
      prisma.department.update.mockResolvedValue({ ...DEPARTMENT, deletedAt: new Date() });

      await service.remove(TENANT_A.id, DEPARTMENT.id);

      expect(prisma.department.update).toHaveBeenCalledWith({
        where: { id: DEPARTMENT.id },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  // ─── TENANT ISOLATION ──────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('Tenant B cannot read Tenant A department', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_B.id, DEPARTMENT.id))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot update Tenant A department', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(service.update(TENANT_B.id, DEPARTMENT.id, { name: 'hacked' }))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot delete Tenant A department', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      await expect(service.remove(TENANT_B.id, DEPARTMENT.id))
        .rejects.toThrow(NotFoundException);
    });
  });
});
