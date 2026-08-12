// apps/api/src/modules/letters/services/reference-number.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReferenceNumberService } from './reference-number.service';
import { PrismaService } from '../../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../../test/prisma-mock';
import { TENANT_A } from '../../../../test/fixtures';

describe('ReferenceNumberService', () => {
  let svc: ReferenceNumberService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [ReferenceNumberService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    svc = mod.get(ReferenceNumberService);
  });

  it('formats as PREFIX/YY/MM/SEQ with zero-padded sequence', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ seq: 42, prefix: 'LEGELP/ZT' }]);
    const r = await svc.next(TENANT_A.id, 'OFFER_LETTER');
    // Third segment is the 2-digit month (shared monthly sequence), not the type code.
    const yy = String(new Date().getUTCFullYear()).slice(-2);
    const mm = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    expect(r).toBe(`LEGELP/ZT/${yy}/${mm}/00042`);
  });

  it('uses override when provided (skips DB increment)', async () => {
    const r = await svc.next(TENANT_A.id, 'CLIENT_AGREEMENT', { override: 'CUSTOM/REF/123' });
    expect(r).toBe('CUSTOM/REF/123');
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('shares one monthly sequence across letter types (month segment, not type code)', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ seq: 1, prefix: 'LEGELP/ZT' }]);
    const r1 = await svc.next(TENANT_A.id, 'APPOINTMENT_LETTER');
    const r2 = await svc.next(TENANT_A.id, 'EXPERIENCE_LETTER');
    const r3 = await svc.next(TENANT_A.id, 'CLIENT_AGREEMENT');
    const yy = String(new Date().getUTCFullYear()).slice(-2);
    const mm = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    // Reference number is type-agnostic now: same PREFIX/YY/MM/SEQ regardless of letter type.
    expect(r1).toBe(`LEGELP/ZT/${yy}/${mm}/00001`);
    expect(r2).toBe(`LEGELP/ZT/${yy}/${mm}/00001`);
    expect(r3).toBe(`LEGELP/ZT/${yy}/${mm}/00001`);
  });

  it('throws when DB returns no rows (sanity)', async () => {
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    await expect(svc.next(TENANT_A.id, 'OFFER_LETTER')).rejects.toThrow(/increment failed/);
  });
});
