import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../test/prisma-mock';
import { TENANT_A, TENANT_B, CLIENT, INVOICE, ADMIN_USER } from '../../../test/fixtures';
import { Prisma } from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  // ─── GENERATE INVOICE ──────────────────────────────────────────────
  describe('generate', () => {
    const dto = {
      clientId: CLIENT.id,
      year: 2025,
      month: 3,
      taxPercent: 10,
      dueDays: 15,
    };

    it('should generate a DRAFT invoice with line items from assignments', async () => {
      prisma.client.findFirst.mockResolvedValue(CLIENT);
      prisma.invoice.findFirst
        .mockResolvedValueOnce(null)  // duplicate check
        .mockResolvedValueOnce(null); // nextInvoiceNumber
      prisma.employeeAssignment.findMany.mockResolvedValue([
        {
          id: 'assign-1',
          billingCycle: 'MONTHLY',
          billingRate: new Prisma.Decimal(5000),
          role: 'Developer',
          employee: { firstName: 'Jane', lastName: 'Dev', employeeCode: 'E1' },
        },
      ]);
      prisma.invoice.create.mockResolvedValue({
        id: 'inv-new',
        invoiceNumber: 'INV-2025-0001',
        status: 'DRAFT',
        total: new Prisma.Decimal(5500),
      });

      const result = await service.generate(TENANT_A.id, dto, ADMIN_USER.id);

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A.id,
            clientId: CLIENT.id,
            status: 'DRAFT',
          }),
        }),
      );
      expect(result.invoiceNumber).toBe('INV-2025-0001');
    });

    it('should throw NotFoundException for invalid client', async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      await expect(service.generate(TENANT_A.id, dto))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate period', async () => {
      prisma.client.findFirst.mockResolvedValue(CLIENT);
      prisma.invoice.findFirst.mockResolvedValue({ invoiceNumber: 'INV-2025-0001' });

      await expect(service.generate(TENANT_A.id, dto))
        .rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when no assignments found', async () => {
      prisma.client.findFirst.mockResolvedValue(CLIENT);
      prisma.invoice.findFirst
        .mockResolvedValueOnce(null)  // duplicate check
        .mockResolvedValueOnce(null); // nextInvoiceNumber
      prisma.employeeAssignment.findMany.mockResolvedValue([]);

      await expect(service.generate(TENANT_A.id, dto))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated invoices filtered by tenant', async () => {
      prisma.invoice.findMany.mockResolvedValue([INVOICE]);
      prisma.invoice.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_A.id, {});

      expect(result.data).toHaveLength(1);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_A.id }),
        }),
      );
    });

    it('should filter by status and clientId', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0);

      await service.findAll(TENANT_A.id, { status: 'DRAFT', clientId: CLIENT.id });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT', clientId: CLIENT.id }),
        }),
      );
    });
  });

  // ─── FIND ONE ──────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return invoice with line items', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, lineItems: [], client: CLIENT,
      });

      const result = await service.findOne(TENANT_A.id, INVOICE.id);
      expect(result).toHaveProperty('client');
    });

    it('should throw NotFoundException for wrong tenant', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_B.id, INVOICE.id))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'DRAFT', lineItems: [], client: CLIENT, subtotal: new Prisma.Decimal(5000),
      });
      prisma.invoice.update.mockResolvedValue({ ...INVOICE, notes: 'updated' });

      const result = await service.update(TENANT_A.id, INVOICE.id, { notes: 'updated' });
      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should throw ConflictException when updating paid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'PAID', lineItems: [], client: CLIENT,
      });

      await expect(service.update(TENANT_A.id, INVOICE.id, { notes: 'x' }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── STATUS TRANSITIONS ───────────────────────────────────────────
  describe('markSent', () => {
    it('should transition DRAFT → SENT', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'DRAFT', lineItems: [], client: CLIENT,
      });
      prisma.invoice.update.mockResolvedValue({ ...INVOICE, status: 'SENT' });

      await service.markSent(TENANT_A.id, INVOICE.id);

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE.id },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });

    it('should reject marking non-DRAFT invoice as sent', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'SENT', lineItems: [], client: CLIENT,
      });

      await expect(service.markSent(TENANT_A.id, INVOICE.id))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('markPaid', () => {
    it('should mark SENT invoice as PAID', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'SENT', lineItems: [], client: CLIENT,
      });
      prisma.invoice.update.mockResolvedValue({ ...INVOICE, status: 'PAID' });

      await service.markPaid(TENANT_A.id, INVOICE.id, {
        paidAmount: '5500',
        paymentRef: 'WIRE-001',
      });

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PAID', paymentRef: 'WIRE-001' }),
        }),
      );
    });

    it('should reject paying already-paid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'PAID', lineItems: [], client: CLIENT,
      });

      await expect(service.markPaid(TENANT_A.id, INVOICE.id, { paidAmount: '5500' }))
        .rejects.toThrow(ConflictException);
    });

    it('should reject paying cancelled invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'CANCELLED', lineItems: [], client: CLIENT,
      });

      await expect(service.markPaid(TENANT_A.id, INVOICE.id, { paidAmount: '5500' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel a draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'DRAFT', lineItems: [], client: CLIENT,
      });
      prisma.invoice.update.mockResolvedValue({ ...INVOICE, status: 'CANCELLED' });

      await service.cancel(TENANT_A.id, INVOICE.id);
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should throw ConflictException when cancelling paid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...INVOICE, status: 'PAID', lineItems: [], client: CLIENT,
      });

      await expect(service.cancel(TENANT_A.id, INVOICE.id))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── STATS ─────────────────────────────────────────────────────────
  describe('getStats', () => {
    it('should return aggregated invoice stats for tenant', async () => {
      prisma.invoice.aggregate
        .mockResolvedValueOnce({ _sum: { total: new Prisma.Decimal(10000) }, _count: 2 }) // draft
        .mockResolvedValueOnce({ _sum: { total: new Prisma.Decimal(20000) }, _count: 3 }) // outstanding (SENT+OVERDUE+PARTIALLY_PAID)
        .mockResolvedValueOnce({ _sum: { paidAmount: new Prisma.Decimal(15000), total: new Prisma.Decimal(15000) }, _count: 2 }) // paid
        .mockResolvedValueOnce({ _sum: { paidAmount: new Prisma.Decimal(0) }, _count: 0 }) // partially paid
        .mockResolvedValueOnce({ _sum: { total: new Prisma.Decimal(5000) }, _count: 1 }); // overdue

      const stats = await service.getStats(TENANT_A.id);

      expect(stats.draft.count).toBe(2);
      expect(stats.sent.count).toBe(3);
      expect(stats.paid.count).toBe(2);
      expect(stats.overdue.count).toBe(1);

      // All aggregate calls must filter by tenantId
      for (const call of prisma.invoice.aggregate.mock.calls) {
        expect(call[0].where).toHaveProperty('tenantId', TENANT_A.id);
      }
    });
  });

  // ─── TENANT ISOLATION ──────────────────────────────────────────────
  describe('tenant isolation', () => {
    it('Tenant B cannot read Tenant A invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_B.id, INVOICE.id))
        .rejects.toThrow(NotFoundException);
    });

    it('Tenant B cannot update Tenant A invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.update(TENANT_B.id, INVOICE.id, { notes: 'hacked' }))
        .rejects.toThrow(NotFoundException);
    });
  });
});
