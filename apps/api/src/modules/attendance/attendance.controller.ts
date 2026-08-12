/// <reference types="multer" />
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Res, UseGuards,
  UploadedFile, UseInterceptors, ParseBoolPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags, ApiOperation, ApiQuery, ApiBearerAuth, ApiResponse,
  ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { AttendanceService } from './attendance.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendanceConsolidatorService } from './attendance-consolidator.service';
import { AttendanceQueueProducer } from './queue/attendance.queue';
import { PrismaService } from '../../prisma';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark.dto';
import { RectifyAttendanceDto } from './dto/rectify-attendance.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

@Controller('attendance')
@ApiTags('Attendance')
@UseGuards(AuthGuard, TenantGuard)
@ApiBearerAuth('bearer')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly importService: AttendanceImportService,
    private readonly consolidator: AttendanceConsolidatorService,
    private readonly queue: AttendanceQueueProducer,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────── ORIGINAL ENDPOINTS ──────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Mark attendance for one employee on a date (upsert). Reason required on UPDATE.' })
  mark(@Req() req: any, @Body() dto: MarkAttendanceDto & { reason?: string }) {
    return this.attendanceService.mark(req.tenantId, dto, req.user?.id);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk mark attendance for multiple employees on a date' })
  bulk(@Req() req: any, @Body() dto: BulkMarkAttendanceDto) {
    return this.attendanceService.bulkMark(req.tenantId, dto, req.user?.id);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily attendance sheet — all active employees + their status for the date' })
  @ApiQuery({ name: 'date', required: true, example: '2026-04-16' })
  daily(@Req() req: any, @Query('date') date: string) {
    return this.attendanceService.getDailySheet(req.tenantId, date);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get attendance history for one employee' })
  @ApiQuery({ name: 'from', required: false }) @ApiQuery({ name: 'to', required: false })
  history(@Req() req: any, @Param('employeeId') employeeId: string,
          @Query('from') from?: string, @Query('to') to?: string) {
    return this.attendanceService.getEmployeeHistory(req.tenantId, employeeId, { from, to });
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get tenant-wide monthly attendance summary' })
  @ApiQuery({ name: 'year', required: true }) @ApiQuery({ name: 'month', required: true })
  monthly(@Req() req: any, @Query('year') year: string, @Query('month') month: string) {
    return this.attendanceService.getMonthlyStats(
      req.tenantId, parseInt(year, 10), parseInt(month, 10),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attendance record' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.remove(req.tenantId, id);
  }

  // ─────────── TASK #59 ADDITIONS ─────────────────────────────

  /** Download canonical Zedtreeo CSV template */
  @Get('import/template')
  @ApiOperation({ summary: 'Download Zedtreeo attendance CSV template' })
  template(@Res() res: Response) {
    const csv = this.importService.getTemplate();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-template.csv"');
    res.send(csv);
  }

  /** Upload CSV — dryRun=true validates only, no writes */
  @Post('import')
  @ApiOperation({ summary: 'Import attendance CSV. dryRun=true validates only.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun', new ParseBoolPipe({ optional: true })) dryRun?: boolean,
  ) {
    return this.importService.import(
      req.tenantId,
      req.user?.id ?? 'system',
      file,
      Boolean(dryRun),
    );
  }

  /** List recent CSV import batches for this tenant */
  @Get('import/batches')
  @ApiOperation({ summary: 'List recent CSV import batches' })
  @ApiQuery({ name: 'limit', required: false })
  batches(@Req() req: any, @Query('limit') limit?: string) {
    return this.prisma.attendanceImportBatch.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit ?? '20', 10), 100),
    });
  }

  /** Rectify by attendance row id (Rectify drawer in UI). Reason required. */
  @Patch(':id/rectify')
  @ApiOperation({ summary: 'Admin edit of a single attendance row. Reason required.' })
  rectify(@Req() req: any, @Param('id') id: string, @Body() dto: RectifyAttendanceDto) {
    return this.attendanceService.rectify(req.tenantId, id, dto, req.user?.id ?? 'system');
  }

  /** Change history for a single row (used by "View changes" button) */
  @Get(':id/audit')
  @ApiOperation({ summary: 'Change history for an attendance row' })
  auditHistory(@Req() req: any, @Param('id') id: string) {
    return this.attendanceService.getAuditHistory(req.tenantId, id);
  }

  /**
   * Admin-trigger consolidator (sync by default, async via BullMQ if async=true).
   * Skips Attendance rows where source ∈ {CSV, MANUAL}.
   */
  @Post('consolidate')
  @ApiOperation({ summary: 'Trigger agent-data consolidation. Skips CSV/MANUAL rows.' })
  @ApiQuery({ name: 'from', required: true, example: '2026-05-01' })
  @ApiQuery({ name: 'to',   required: true, example: '2026-05-19' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'async', required: false, description: 'true → enqueue to BullMQ' })
  async consolidate(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
    @Query('async') async_?: string,
  ) {
    if (async_ === 'true') {
      const job = await this.queue.enqueueOnDemand({
        tenantId: req.tenantId,
        employeeId,
        fromISO: from,
        toISO: to,
      });
      return { jobId: job.id, status: 'queued' };
    }
    return this.consolidator.consolidate({
      tenantId: req.tenantId,
      employeeId,
      from: new Date(from),
      to: new Date(to),
    });
  }
}
