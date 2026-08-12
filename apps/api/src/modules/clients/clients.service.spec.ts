import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A, TENANT_B, CLIENT } from '../../../test/fixtures';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  // ─── CREATE ────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      name: 'NewCorp',
      contactPerson: 'Alice',
      email: 'alice@newcorp.com',
      phone: '+1000000000',
      address: '456 New St',
      country: 'us',
      currency: 'usd',
      billingRate: 75,
    };

    it('should create a client with uppercased country and currency', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue({
        id: 'client-new', tenantId: TENANT_A.id, ...dto, country: 'US', currency: 'USD',
      });

      const result = await service.create(TENANT_A.id, dto);

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT_A.id,
          country: 'US',
          currency: 'USD',
        }),
      });
      expect(result.country).toBe('US');
    });

    it('should throw ConflictException for duplicate email within tenant', async () => {
      prisma.client.findFirst.mockResolvedValue(CLIENT);

      await expect(service.create(TENANT_A.id, { ...dto, email: CLIENT.email }))
        .rejects.toThrow(ConflictException);
    });

    it('should allow same email in different tenant', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      prisma.client.create.mockResolvedValue({ id: 'client-b', tenantId: TENANT_B.id, ...dto });

      const result = await service.create(TENANT_B.id, dto);
      expect(result.tenantId).toBe(TENANT_B.id);
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated clients filtered by tenant', async () => {
      prisma.client.findMany.mockResolvedValue([CLIENT]);
      prisma.client.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A.id, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A.id, deletedAt: null }),
        }),
      );
    });

    it('should filter by search across name, email, country', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { search: 'tech' });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { name: { contains: 'tech', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.client.findMany.mockResolvedValue([]);
      prisma.client.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { isActive: true });

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  // ─── FIND ONE ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return client with active assignments', async () => {
      prisma.client.findFirst.mockResolvedValue({
        ...CLIENT, assignments: [], _count: { assignments: 0 },
      });

      const result = await service.findOne(TENANT_A.id, CLIENT.id);
      expect(result).toHaveProperty('_count');
    });

    it('should throw NotFoundException for wrong tenant', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B.id, CLIENT.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update client and uppercase country/currency', async () => {
      prisma.client.findFirst.mockResolvedValueOnce({
        ...CLIENT, assignments: [], _count: { assignments: 0 },
      });
      prisma.client.update.mockResolvedValue({ ...CLIENT, country: 'GB', currency: 'GBP' });

      const result = await service.update(TENANT_A.id, CLIENT.id, { country: 'gb', currency: 'gbp' });

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: CLIENT.id },
        data: expect.objectContaining({ country: 'GB', currency: 'GBP' }),
      });
    });

    it('should reject duplicate email on update', async () => {
      prisma.client.findFirst
        .mockResolvedValueOnce({ ...CLIENT, assignments: [], _count: { assignments: 0 } }) // findOne
        .mockResolvedValueOnce({ id: 'other-client' }); // duplicate check

      await expect(service.update(TENANT_A.id, CLIENT.id, { email: 'duplicate@test.com' }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── SOFT DELETE ───────────────────────────────────────────────────
  describe('remove', () => {
    it('should soft-delete client with no active assignments', async () => {
      prisma.client.findFirst.mockResolvedValue({
        ...CLIENT, assignments: [], _count: { assignments: 0 },
      });
      prisma.employeeAssignment.count.mockResolvedValue(0);
      prisma.client.update.mockResolvedValue({ ...CLIENT, deletedAt: new Date() });

      await service.remove(TENANT_A.id, CLIENT.id);

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id: CLIENT.id },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ConflictException when client has active assignments', async () => {
      prisma.client.findFirst.mockResolvedValue({
        ...CLIENT, assignments: [], _count: { assignments: 0 },
      });
      prisma.employeeAssignment.count.mockResolvedValue(3);

      await expect(service.remove(TENANT_A.id, CLIENT.id))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── TENANT ISOLATION ──────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('Tenant B cannot read Tenant A client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_B.id, CLIENT.id))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot update Tenant A client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(service.update(TENANT_B.id, CLIENT.id, { name: 'hacked' }))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot delete Tenant A client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);
      await expect(service.remove(TENANT_B.id, CLIENT.id))
        .rejects.toThrow(NotFoundException);
    });
  });
});
