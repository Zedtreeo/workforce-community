// apps/api/src/modules/letters/services/letter-generation.service.ts
//
// Orchestrates the full generate flow:
//   1. Resolve variable context (VariableResolverService)
//   2. Merge admin overrides
//   3. Mint reference number (ReferenceNumberService)
//   4. Render the .docx template via Carbone (or docxtemplater fallback)
//   5. Optionally render PDF copy via Carbone
//   6. Persist to /app/uploads/{tenantId}/letters/{type}/
//   7. Write GeneratedLetter row + AuditLog
//
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AuditService } from '../../audit/audit.service';
import { VariableResolverService } from './variable-resolver.service';
import { ReferenceNumberService } from './reference-number.service';
import { CarboneAdapter } from './carbone.adapter';
import { LetterType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export interface GenerateParams {
  templateId: string;
  type: LetterType;
  employeeId?: string;
  clientId?: string;
  assignmentId?: string;
  overrides?: Record<string, any>;        // dotted-path overrides from admin
  generatePdf?: boolean;
  userId: string;
}

@Injectable()
export class LetterGenerationService {
  private readonly logger = new Logger(LetterGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly resolver: VariableResolverService,
    private readonly refNumber: ReferenceNumberService,
    private readonly carbone: CarboneAdapter,
  ) {}

  async preview(tenantId: string, params: Omit<GenerateParams, 'userId' | 'templateId' | 'generatePdf'> & { templateId: string }) {
    const template = await this.loadTemplate(tenantId, params.templateId);
    const { data, editableFields } = await this.resolver.resolve(tenantId, {
      type: template.type, employeeId: params.employeeId, clientId: params.clientId, assignmentId: params.assignmentId,
    });
    return { template: { id: template.id, name: template.name, type: template.type }, data, editableFields };
  }

  async generate(tenantId: string, params: GenerateParams) {
    const template = await this.loadTemplate(tenantId, params.templateId);
    if (template.type !== params.type) {
      throw new BadRequestException(`Template type mismatch: template is ${template.type}, request asked ${params.type}`);
    }

    // 1. Resolve + merge overrides
    const { data } = await this.resolver.resolve(tenantId, {
      type: template.type, employeeId: params.employeeId, clientId: params.clientId, assignmentId: params.assignmentId,
    });
    const merged = this.applyOverrides(data, params.overrides ?? {});

    // 2. Reference number
    const referenceNo = await this.refNumber.next(tenantId, template.type, { override: merged.referenceNo });
    merged.referenceNo = referenceNo;

    // 3. Load template file from disk
    const templateBuffer = fs.readFileSync(template.filePath);
    if (!this.carbone.enabled) {
      throw new BadRequestException(
        'Letter generation requires CARBONE_API_KEY to be configured on the API server.',
      );
    }

    // 4. Render DOCX
    const docxOut = await this.carbone.render(templateBuffer, merged, 'docx');
    const fileName = this.buildFileName(template.type, merged, referenceNo, 'docx');
    const docxPath = this.saveToDisk(tenantId, template.type, fileName, docxOut.buffer);

    // 5. Optional PDF
    let pdfPath: string | null = null;
    if (params.generatePdf !== false) {  // default ON
      try {
        const pdfOut = await this.carbone.render(templateBuffer, merged, 'pdf');
        const pdfName = this.buildFileName(template.type, merged, referenceNo, 'pdf');
        pdfPath = this.saveToDisk(tenantId, template.type, pdfName, pdfOut.buffer);
      } catch (e: any) {
        this.logger.warn(`PDF render failed (continuing with DOCX only): ${e.message}`);
      }
    }

    // 6. Persist row
    const row = await this.prisma.generatedLetter.create({
      data: {
        tenantId,
        templateId: template.id,
        type: template.type,
        employeeId: params.employeeId ?? null,
        clientId: params.clientId ?? null,
        assignmentId: params.assignmentId ?? null,
        referenceNo,
        fileName,
        filePath: docxPath,
        pdfPath,
        variables: merged,
        status: 'DRAFT',
        generatedBy: params.userId,
      },
    });

    // 7. Audit
    await this.audit.log({
      tenantId,
      userId: params.userId,
      action: 'GENERATE',
      entity: 'GeneratedLetter',
      entityId: row.id,
      changes: { type: template.type, referenceNo, employeeId: params.employeeId, clientId: params.clientId },
    });

    return row;
  }

  /**
   * Render a draft PDF from the resolved data + admin overrides WITHOUT minting a
   * reference number or persisting a GeneratedLetter row. Powers "view before generate"
   * so an admin can eyeball the actual document before committing to a numbered copy.
   */
  async previewRender(
    tenantId: string,
    params: Omit<GenerateParams, 'userId' | 'generatePdf'>,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const template = await this.loadTemplate(tenantId, params.templateId);
    if (template.type !== params.type) {
      throw new BadRequestException(`Template type mismatch: template is ${template.type}, request asked ${params.type}`);
    }
    const { data } = await this.resolver.resolve(tenantId, {
      type: template.type, employeeId: params.employeeId, clientId: params.clientId, assignmentId: params.assignmentId,
    });
    const merged = this.applyOverrides(data, params.overrides ?? {});
    if (!merged.referenceNo) merged.referenceNo = await this.refNumber.peek(tenantId);

    if (!this.carbone.enabled) {
      throw new BadRequestException('Letter preview requires CARBONE_API_KEY to be configured on the API server.');
    }
    const templateBuffer = fs.readFileSync(template.filePath);
    const pdfOut = await this.carbone.render(templateBuffer, merged, 'pdf');
    return {
      buffer: pdfOut.buffer,
      fileName: `preview-${template.type.toLowerCase()}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  async download(tenantId: string, id: string, format: 'docx' | 'pdf' | 'signed') {
    const row = await this.prisma.generatedLetter.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Generated letter not found');
    const filePath =
      format === 'signed' ? row.signedFilePath : format === 'pdf' ? row.pdfPath : row.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException(
        format === 'signed'
          ? 'No signed copy has been uploaded for this letter yet.'
          : `${format.toUpperCase()} file not available for this letter`,
      );
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : 'application/octet-stream';
    return {
      buffer: fs.readFileSync(filePath),
      fileName: path.basename(filePath),
      mimeType,
    };
  }

  /**
   * Auto-generate a director-signed CLIENT_AGREEMENT draft for a client.
   * Idempotent: if a CLIENT_AGREEMENT already exists for this client, does nothing.
   * Designed to be fire-and-forget on first active assignment creation.
   */
  async autoGenerateClientAgreement(tenantId: string, clientId: string, assignmentId: string | undefined, userId: string) {
    const existing = await this.prisma.generatedLetter.findFirst({
      where: { tenantId, clientId, type: 'CLIENT_AGREEMENT' },
    });
    if (existing) return existing;
    const template = await this.prisma.letterTemplate.findFirst({
      where: { tenantId, type: 'CLIENT_AGREEMENT', isActive: true },
      orderBy: { isDefault: 'desc' },
    });
    if (!template) {
      this.logger.warn(`No active CLIENT_AGREEMENT template for tenant ${tenantId}; skipping auto-generate`);
      return null;
    }
    return this.generate(tenantId, {
      templateId: template.id,
      type: 'CLIENT_AGREEMENT',
      clientId,
      assignmentId,
      userId,
      generatePdf: true,
    });
  }

  /**
   * Auto-generate (or reuse) the offer letter for an onboarding employee, using
   * the tenant's default OFFER_LETTER template. Returns the generated letter row
   * (with pdfPath) or null if no template is configured. Used to attach the
   * offer PDF to the onboarding invite email.
   */
  async autoGenerateOffer(tenantId: string, employeeId: string, userId: string) {
    // Always regenerate so the letter reflects the CURRENT employee/offer data
    // (email, salary, designation may have been corrected since the last send).
    const template = await this.prisma.letterTemplate.findFirst({
      where: { tenantId, type: 'OFFER_LETTER', isActive: true },
      orderBy: { isDefault: 'desc' },
    });
    if (!template) {
      this.logger.warn(`No active OFFER_LETTER template for tenant ${tenantId}; skipping offer attachment`);
      return null;
    }
    return this.generate(tenantId, {
      templateId: template.id,
      type: 'OFFER_LETTER',
      employeeId,
      userId: userId || 'system',
      generatePdf: true,
    });
  }

  /** Store a client-counter-signed copy and mark the agreement ACCEPTED. */
  async uploadSignedCopy(tenantId: string, id: string, buffer: Buffer, originalName: string, userId: string) {
    const row = await this.prisma.generatedLetter.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Generated letter not found');
    const ext = (originalName.split('.').pop() || 'pdf').toLowerCase();
    const safeExt = ['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(ext) ? ext : 'pdf';
    const fileName = `${row.referenceNo || row.id}-signed.${safeExt}`.replace(/[\/]/g, '-');
    const signedPath = this.saveToDisk(tenantId, row.type, fileName, buffer);
    const updated = await this.prisma.generatedLetter.update({
      where: { id },
      data: { signedFilePath: signedPath, status: 'ACCEPTED', acceptedAt: new Date() },
    });
    await this.audit.log({
      tenantId, userId, action: 'UPLOAD_SIGNED', entity: 'GeneratedLetter', entityId: id,
      changes: { signedFilePath: signedPath, status: 'ACCEPTED' },
    });
    return updated;
  }

  async markStatus(tenantId: string, id: string, status: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'VOIDED', userId: string, sentTo?: string) {
    const row = await this.prisma.generatedLetter.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Generated letter not found');
    const updated = await this.prisma.generatedLetter.update({
      where: { id },
      data: {
        status,
        ...(status === 'SENT' && { sentAt: new Date(), sentTo: sentTo ?? null }),
        ...(status === 'ACCEPTED' && { acceptedAt: new Date() }),
      },
    });
    await this.audit.log({
      tenantId, userId,
      action: 'STATUS_CHANGE',
      entity: 'GeneratedLetter',
      entityId: id,
      changes: { before: row.status, after: status, sentTo },
    });
    return updated;
  }

  /**
   * Delete a generated letter and its on-disk files (DOCX/PDF/signed).
   * Lets an admin discard a draft/sent agreement and regenerate a fresh one
   * when the client requests changes. Counter-signed (ACCEPTED) agreements are
   * protected — Void them instead so the signed record is never destroyed.
   */
  async remove(tenantId: string, id: string, userId: string) {
    const row = await this.prisma.generatedLetter.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Generated letter not found');
    if (row.status === 'ACCEPTED') {
      throw new BadRequestException(
        'This agreement has a counter-signed copy and cannot be deleted. Mark it Voided instead.',
      );
    }

    for (const p of [row.filePath, row.pdfPath, row.signedFilePath]) {
      if (p && fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e: any) { this.logger.warn(`Failed to remove file ${p}: ${e.message}`); }
      }
    }

    await this.prisma.generatedLetter.delete({ where: { id } });
    await this.audit.log({
      tenantId, userId, action: 'DELETE', entity: 'GeneratedLetter', entityId: id,
      changes: { referenceNo: row.referenceNo, type: row.type, status: row.status },
    });
    return { ok: true, id };
  }

  async history(tenantId: string, params: { employeeId?: string; clientId?: string; type?: LetterType; limit?: number }) {
    const rows = await this.prisma.generatedLetter.findMany({
      where: {
        tenantId,
        ...(params.employeeId && { employeeId: params.employeeId }),
        ...(params.clientId && { clientId: params.clientId }),
        ...(params.type && { type: params.type }),
      },
      orderBy: { generatedAt: 'desc' },
      take: Math.min(params.limit ?? 50, 200),
      select: {
        id: true, type: true, referenceNo: true, fileName: true,
        pdfPath: true, signedFilePath: true, status: true, generatedAt: true, sentAt: true, sentTo: true,
        template: { select: { name: true } },
      },
    });
    // Expose only whether a signed copy exists — never the server file path.
    return rows.map(({ signedFilePath, ...r }) => ({ ...r, hasSignedCopy: !!signedFilePath }));
  }

  // ──────────────── helpers ────────────────
  private async loadTemplate(tenantId: string, id: string) {
    const t = await this.prisma.letterTemplate.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!t) throw new NotFoundException('Letter template not found or inactive');
    return t;
  }

  private applyOverrides(data: any, overrides: Record<string, any>): Record<string, any> {
    const cloned = JSON.parse(JSON.stringify(data));
    for (const [path, value] of Object.entries(overrides)) {
      if (value === undefined || value === null || value === '') continue;
      this.setByPath(cloned, path, value);
    }
    return cloned;
  }

  private setByPath(target: any, dotted: string, value: any) {
    const parts = dotted.split('.');
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  private buildFileName(type: LetterType, data: any, refNo: string, ext: string): string {
    const slugRefNo = refNo.replace(/[^a-zA-Z0-9]/g, '-');
    const typeShort = type.replace('_LETTER', '').replace('CLIENT_', '').toLowerCase();
    const who = data.employee?.fullName?.replace(/\s+/g, '_') ?? data.client?.companyName?.replace(/\s+/g, '_') ?? 'letter';
    return `${typeShort}-${who}-${slugRefNo}.${ext}`;
  }

  private saveToDisk(tenantId: string, type: LetterType, fileName: string, buffer: Buffer): string {
    const dir = path.join(process.cwd(), 'uploads', tenantId, 'letters', type);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, buffer);
    return fullPath;
  }
}
