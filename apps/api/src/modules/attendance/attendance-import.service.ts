// apps/api/src/modules/attendance/attendance-import.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { AuditService } from '../audit/audit.service';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { parse as parseCsv } from 'papaparse';
import { z } from 'zod';
import type { ImportRowError, ImportBatchResponse } from './dto/import-attendance.dto';

/** Canonical Zedtreeo attendance CSV row schema */
const RowSchema = z.object({
  employee_email: z.string().email('Invalid email'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum([
    'PRESENT',
    'ABSENT',
    'HALF_DAY',
    'LEAVE',
    'HOLIDAY',
    'WEEKEND',
    'WFH',
  ]),
  check_in: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'check_in must be HH:MM or HH:MM:SS')
    .optional()
    .or(z.literal('')),
  check_out: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'check_out must be HH:MM or HH:MM:SS')
    .optional()
    .or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type ParsedRow = z.infer<typeof RowSchema>;

@Injectable()
export class AttendanceImportService {
  private readonly logger = new Logger(AttendanceImportService.name);
  private static readonly MAX_BYTES = 5 * 1024 * 1024;     // 5 MB
  private static readonly MAX_ROWS = 10_000;
  private static readonly REQUIRED_COLS = [
    'employee_email',
    'date',
    'status',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Top-level entry called by the controller. */
  async import(
    tenantId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; size: number },
    dryRun: boolean,
  ): Promise<ImportBatchResponse> {
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');
    if (file.size > AttendanceImportService.MAX_BYTES) {
      throw new BadRequestException(
        `File too large (max ${AttendanceImportService.MAX_BYTES / 1024 / 1024} MB)`,
      );
    }

    // 1. Parse CSV
    const csv = file.buffer.toString('utf-8');
    const { data, errors: parseErrors, meta } = parseCsv(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (parseErrors.length) {
      throw new BadRequestException(
        `CSV parse errors: ${parseErrors.slice(0, 3).map((e) => e.message).join('; ')}`,
      );
    }
    const fields = (meta.fields || []).map((f) => f.toLowerCase());
    const missing = AttendanceImportService.REQUIRED_COLS.filter(
      (c) => !fields.includes(c),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Missing required columns: ${missing.join(', ')}`,
      );
    }
    if (data.length > AttendanceImportService.MAX_ROWS) {
      throw new BadRequestException(
        `Too many rows (${data.length}); max ${AttendanceImportService.MAX_ROWS}`,
      );
    }

    // 2. Per-row Zod validation
    const errors: ImportRowError[] = [];
    const valid: Array<{ row: number; parsed: ParsedRow }> = [];
    data.forEach((raw: any, idx: number) => {
      const rowNum = idx + 2; // +1 for 1-index, +1 for header
      const result = RowSchema.safeParse(raw);
      if (!result.success) {
        errors.push({
          row: rowNum,
          employee_email: raw?.employee_email,
          date: raw?.date,
          message: result.error.issues.map((i: z.ZodIssue) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
        return;
      }
      // Cross-field rule: if both check_in + check_out present, check_out > check_in
      const ci = result.data.check_in;
      const co = result.data.check_out;
      if (ci && co && co <= ci) {
        errors.push({
          row: rowNum,
          employee_email: result.data.employee_email,
          date: result.data.date,
          message: 'check_out must be after check_in',
        });
        return;
      }
      valid.push({ row: rowNum, parsed: result.data });
    });

    // 3. Resolve employee emails -> employeeIds within tenant
    // Employee.email is a direct column on the model
    const emails = Array.from(new Set(valid.map((v) => v.parsed.employee_email)));
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        email: { in: emails },
      },
      select: { id: true, email: true },
    });
    const emailToId = new Map(employees.map((e) => [e.email, e.id]));
    const resolvable: Array<{ row: number; employeeId: string; parsed: ParsedRow }> = [];
    valid.forEach((v) => {
      const empId = emailToId.get(v.parsed.employee_email);
      if (!empId) {
        errors.push({
          row: v.row,
          employee_email: v.parsed.employee_email,
          date: v.parsed.date,
          message: 'No active employee with this email in tenant',
        });
        return;
      }
      resolvable.push({ row: v.row, employeeId: empId, parsed: v.parsed });
    });

    // 4. Create batch record (PENDING on dry-run, COMMITTED on commit)
    const batch = await this.prisma.attendanceImportBatch.create({
      data: {
        tenantId,
        uploadedBy: userId,
        fileName: file.originalname,
        fileSize: file.size,
        rowCount: data.length,
        successCount: 0,
        errorCount: errors.length,
        errors: errors as unknown as Prisma.JsonArray,
        dryRun,
        status: errors.length === data.length && data.length > 0 ? 'FAILED' : 'PENDING',
      },
    });

    if (dryRun || resolvable.length === 0) {
      return this.toResponse(batch, errors);
    }

    // 5. Commit: upsert Attendance rows with source=CSV
    let successCount = 0;
    const writeErrors: ImportRowError[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of resolvable) {
        try {
          const date = new Date(item.parsed.date);
          date.setUTCHours(0, 0, 0, 0);

          const checkIn = item.parsed.check_in
            ? new Date(`${item.parsed.date}T${item.parsed.check_in}:00.000Z`)
            : null;
          const checkOut = item.parsed.check_out
            ? new Date(`${item.parsed.date}T${item.parsed.check_out}:00.000Z`)
            : null;
          const workHours =
            checkIn && checkOut
              ? new Prisma.Decimal(
                  ((checkOut.getTime() - checkIn.getTime()) / 3_600_000).toFixed(2),
                )
              : null;

          await tx.attendance.upsert({
            where: {
              tenantId_employeeId_date: {
                tenantId,
                employeeId: item.employeeId,
                date,
              },
            },
            create: {
              tenantId,
              employeeId: item.employeeId,
              date,
              status: item.parsed.status as AttendanceStatus,
              checkIn,
              checkOut,
              workHours,
              notes: item.parsed.notes || null,
              markedBy: userId,
              source: 'CSV',
            },
            update: {
              status: item.parsed.status as AttendanceStatus,
              checkIn,
              checkOut,
              workHours,
              notes: item.parsed.notes || null,
              markedBy: userId,
              source: 'CSV',
            },
          });
          successCount++;
        } catch (e: any) {
          writeErrors.push({
            row: item.row,
            employee_email: item.parsed.employee_email,
            date: item.parsed.date,
            message: `Write failed: ${e.message ?? 'unknown'}`,
          });
        }
      }

      await tx.attendanceImportBatch.update({
        where: { id: batch.id },
        data: {
          successCount,
          errorCount: errors.length + writeErrors.length,
          errors: [...errors, ...writeErrors] as unknown as Prisma.JsonArray,
          status: 'COMMITTED',
          committedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      tenantId,
      userId,
      action: 'IMPORT',
      entity: 'Attendance',
      entityId: batch.id,
      changes: {
        fileName: file.originalname,
        rowCount: data.length,
        successCount,
        errorCount: errors.length + writeErrors.length,
      },
    });

    return this.toResponse(
      { ...batch, status: 'COMMITTED', successCount, errorCount: errors.length + writeErrors.length },
      [...errors, ...writeErrors],
    );
  }

  /** Return the canonical CSV template as a string. */
  getTemplate(): string {
    return [
      'employee_email,date,status,check_in,check_out,notes',
      'jane.doe@example.com,2026-05-19,PRESENT,09:30,18:00,On-site',
      'john.smith@example.com,2026-05-19,WFH,10:00,19:15,Home office',
      'priya.k@example.com,2026-05-19,LEAVE,,,Casual leave approved',
    ].join('\n');
  }

  private toResponse(batch: any, errors: ImportRowError[]): ImportBatchResponse {
    return {
      batchId: batch.id,
      status: batch.status,
      dryRun: batch.dryRun,
      rowCount: batch.rowCount,
      successCount: batch.successCount,
      errorCount: batch.errorCount,
      errors: errors.slice(0, 200), // cap for response payload
    };
  }
}
