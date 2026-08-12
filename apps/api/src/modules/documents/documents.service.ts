import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateCategoryDto } from './dto/create-category.dto';
import * as fs from 'fs';
import * as path from 'path';

// SEC-006: Allowed document types for employee document uploads
const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];
const ALLOWED_DOC_EXTS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.txt',
];

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  private getUploadDir(tenantId: string) {
    const dir = path.join(process.cwd(), 'uploads', tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  // ── Categories ──

  async getCategories(tenantId: string) {
    return this.prisma.documentCategory.findMany({
      where: { tenantId, isActive: true },
      include: { _count: { select: { documents: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.documentCategory.create({
      data: { tenantId, name: dto.name, code: dto.code.toUpperCase(), isRequired: dto.isRequired ?? false },
    });
  }

  // ── Documents ──

  async getDocuments(tenantId: string, params: { employeeId?: string; categoryId?: string }) {
    return this.prisma.employeeDocument.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(params.employeeId && { employeeId: params.employeeId }),
        ...(params.categoryId && { categoryId: params.categoryId }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        category: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(
    tenantId: string,
    file: any,
    body: { employeeId: string; categoryId: string; notes?: string; expiryDate?: string },
    userId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: body.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const category = await this.prisma.documentCategory.findFirst({
      where: { id: body.categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found');

    // SEC-006: Validate file type
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DOC_MIMES.includes(file.mimetype) || !ALLOWED_DOC_EXTS.includes(ext)) {
      throw new BadRequestException(
        `File type not allowed. Accepted: ${ALLOWED_DOC_EXTS.join(', ')}`,
      );
    }

    // Save file locally
    const uploadDir = this.getUploadDir(tenantId);
    const fileName = `${body.employeeId}_${category.code}_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    return this.prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId: body.employeeId,
        categoryId: body.categoryId,
        fileName: file.originalname,
        fileUrl: `/uploads/${tenantId}/${fileName}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        notes: body.notes,
        uploadedBy: userId,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        category: { select: { name: true, code: true } },
      },
    });
  }

  async deleteDocument(tenantId: string, id: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');

    return this.prisma.employeeDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async downloadDocument(tenantId: string, id: string) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');

    // SEC-007: Prevent path traversal — resolve and verify path stays within uploads dir
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(process.cwd(), doc.fileUrl);
    if (!filePath.startsWith(uploadsRoot)) {
      throw new BadRequestException('Invalid file path');
    }
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');

    return { filePath, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  async getExpiringDocuments(tenantId: string, daysAhead: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.employeeDocument.findMany({
      where: {
        tenantId,
        deletedAt: null,
        expiryDate: { lte: futureDate, gte: new Date() },
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        category: { select: { name: true, code: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }
}
