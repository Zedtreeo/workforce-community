// apps/api/src/modules/letters/services/letter-generation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LetterGenerationService } from './letter-generation.service';
import { VariableResolverService } from './variable-resolver.service';
import { ReferenceNumberService } from './reference-number.service';
import { CarboneAdapter } from './carbone.adapter';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../../prisma';
import { createMockPrisma, MockPrismaService } from '../../../../test/prisma-mock';
import { TENANT_A } from '../../../../test/fixtures';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('LetterGenerationService', () => {
  let svc: LetterGenerationService;
  let prisma: MockPrismaService;
  let resolver: { resolve: jest.Mock };
  let refNo: { next: jest.Mock };
  let carbone: { enabled: boolean; render: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    resolver = { resolve: jest.fn() };
    refNo = { next: jest.fn() };
    carbone = { enabled: true, render: jest.fn() };
    audit = { log: jest.fn() };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        LetterGenerationService,
        { provide: PrismaService,           useValue: prisma },
        { provide: VariableResolverService, useValue: resolver },
        { provide: ReferenceNumberService,  useValue: refNo },
        { provide: CarboneAdapter,          useValue: carbone },
        { provide: AuditService,            useValue: audit },
      ],
    }).compile();
    svc = mod.get(LetterGenerationService);
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(Buffer.from('template'));
    (fs.mkdirSync   as any).mockImplementation(() => {});
    (fs.writeFileSync as any).mockImplementation(() => {});
  });

  describe('generate()', () => {
    const baseParams = {
      tenantId: TENANT_A.id, templateId: 't1', type: 'OFFER_LETTER' as const,
      employeeId: 'e1', userId: 'admin',
    };

    it('throws when template type mismatches request type', async () => {
      prisma.letterTemplate.findFirst.mockResolvedValue({
        id: 't1', tenantId: TENANT_A.id, type: 'EXPERIENCE_LETTER', isActive: true, filePath: '/x',
      });
      await expect(svc.generate(TENANT_A.id, baseParams)).rejects.toThrow(BadRequestException);
    });

    it('aborts when Carbone is not configured', async () => {
      carbone.enabled = false;
      prisma.letterTemplate.findFirst.mockResolvedValue({
        id: 't1', tenantId: TENANT_A.id, type: 'OFFER_LETTER', isActive: true, filePath: '/x',
      });
      resolver.resolve.mockResolvedValue({ data: { employee: { fullName: 'A' } }, editableFields: [] });
      refNo.next.mockResolvedValue('REF/1');
      await expect(svc.generate(TENANT_A.id, baseParams)).rejects.toThrow(BadRequestException);
    });

    it('applies overrides via dotted path before rendering', async () => {
      carbone.enabled = true;
      prisma.letterTemplate.findFirst.mockResolvedValue({
        id: 't1', tenantId: TENANT_A.id, type: 'OFFER_LETTER', isActive: true, filePath: '/x',
      });
      resolver.resolve.mockResolvedValue({
        data: { employee: { fullName: 'Original', address: 'orig' }, salary: { basicMonthly: 1000 } },
        editableFields: [],
      });
      refNo.next.mockResolvedValue('LEGELP/ZT/26/OFF/00001');
      carbone.render.mockResolvedValue({ buffer: Buffer.from('docx'), reportName: 'docx' });
      prisma.generatedLetter.create.mockResolvedValue({ id: 'gl1' });

      await svc.generate(TENANT_A.id, {
        ...baseParams,
        overrides: { 'employee.fullName': 'Override', 'salary.basicMonthly': 2000 },
      });

      const rendered = carbone.render.mock.calls[0][1];
      expect(rendered.employee.fullName).toBe('Override');   // override applied
      expect(rendered.employee.address).toBe('orig');        // unaltered keys kept
      expect(rendered.salary.basicMonthly).toBe(2000);
      expect(rendered.referenceNo).toBe('LEGELP/ZT/26/OFF/00001');
    });

    it('writes GeneratedLetter row and AuditLog with action=GENERATE', async () => {
      prisma.letterTemplate.findFirst.mockResolvedValue({
        id: 't1', tenantId: TENANT_A.id, type: 'OFFER_LETTER', isActive: true, filePath: '/x',
      });
      resolver.resolve.mockResolvedValue({ data: { employee: { fullName: 'A' } }, editableFields: [] });
      refNo.next.mockResolvedValue('R1');
      carbone.render.mockResolvedValue({ buffer: Buffer.from('docx'), reportName: 'docx' });
      prisma.generatedLetter.create.mockResolvedValue({ id: 'gl1' });

      await svc.generate(TENANT_A.id, baseParams);

      expect(prisma.generatedLetter.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ referenceNo: 'R1', status: 'DRAFT', type: 'OFFER_LETTER' }),
      }));
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'GENERATE', entity: 'GeneratedLetter',
      }));
    });

    it('does NOT fail when PDF render throws — DOCX still succeeds', async () => {
      prisma.letterTemplate.findFirst.mockResolvedValue({
        id: 't1', tenantId: TENANT_A.id, type: 'OFFER_LETTER', isActive: true, filePath: '/x',
      });
      resolver.resolve.mockResolvedValue({ data: { employee: { fullName: 'A' } }, editableFields: [] });
      refNo.next.mockResolvedValue('R1');
      // first call (DOCX) succeeds, second call (PDF) throws
      carbone.render
        .mockResolvedValueOnce({ buffer: Buffer.from('docx'), reportName: 'docx' })
        .mockRejectedValueOnce(new Error('carbone timeout'));
      prisma.generatedLetter.create.mockResolvedValue({ id: 'gl1', pdfPath: null });

      const row = await svc.generate(TENANT_A.id, { ...baseParams, generatePdf: true });
      // Row created with pdfPath=null  → DOCX-only fallback
      expect(prisma.generatedLetter.create.mock.calls[0][0].data.pdfPath).toBeNull();
    });
  });

  describe('download()', () => {
    it('throws when file path missing on disk', async () => {
      prisma.generatedLetter.findFirst.mockResolvedValue({ id: 'gl', tenantId: TENANT_A.id, filePath: '/missing.docx', pdfPath: null });
      (fs.existsSync as any).mockReturnValue(false);
      await expect(svc.download(TENANT_A.id, 'gl', 'docx')).rejects.toThrow(NotFoundException);
    });

    it('returns buffer + correct mime for PDF', async () => {
      prisma.generatedLetter.findFirst.mockResolvedValue({ id: 'gl', tenantId: TENANT_A.id, filePath: '/x.docx', pdfPath: '/x.pdf' });
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(Buffer.from('pdfdata'));
      const r = await svc.download(TENANT_A.id, 'gl', 'pdf');
      expect(r.mimeType).toBe('application/pdf');
      expect(r.buffer.toString()).toBe('pdfdata');
    });
  });
});
