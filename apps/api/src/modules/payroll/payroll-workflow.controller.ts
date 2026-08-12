import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, Res,
  UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PayrollWorkflowService } from './payroll-workflow.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import * as fs from 'fs';

@Controller('payroll/workflow')
@ApiTags('Payroll Workflow')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
export class PayrollWorkflowController {
  constructor(private readonly workflowService: PayrollWorkflowService) {}

  // ── Consolidation ─────────────────────────────────

  @Post('consolidate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Consolidate attendance for a month (merge agent + manual data)' })
  @ApiResponse({ status: 201, description: 'Attendance consolidated' })
  @ApiResponse({ status: 409, description: 'Already consolidated' })
  consolidate(@Req() req: any, @Body() body: { month: number; year: number }) {
    return this.workflowService.consolidateAttendance(
      req.tenantId, body.month, body.year, req.user.id,
    );
  }

  @Get('consolidation')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get consolidation status for a month' })
  getConsolidation(
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.workflowService.getConsolidation(req.tenantId, +month, +year);
  }

  // ── Attendance Report & Rectification ─────────────

  @Get('attendance-report')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get detailed attendance report for payroll' })
  getAttendanceReport(
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.workflowService.getAttendanceReport(req.tenantId, +month, +year);
  }

  @Post('rectify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark attendance as rectified (admin reviewed)' })
  rectify(@Req() req: any, @Body() body: { month: number; year: number }) {
    return this.workflowService.rectifyAttendance(
      req.tenantId, body.month, body.year, req.user.id,
    );
  }

  @Post('lock-attendance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Lock attendance — no further changes allowed' })
  lockAttendance(@Req() req: any, @Body() body: { month: number; year: number }) {
    return this.workflowService.lockAttendance(
      req.tenantId, body.month, body.year, req.user.id,
    );
  }

  // ── Upload CSV ────────────────────────────────────

  @Post('upload-attendance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload attendance CSV for bulk import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttendanceCsv(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { month: string; year: string },
  ) {
    if (!file) {
      // Accept JSON body as fallback
      const jsonBody = body as any;
      if (jsonBody.data && Array.isArray(jsonBody.data)) {
        return this.workflowService.uploadAttendanceCsv(
          req.tenantId, +body.month, +body.year, jsonBody.data, req.user.id,
        );
      }
      throw new Error('No file or data provided');
    }

    // Parse CSV
    const content = file.buffer.toString('utf-8');
    const lines = content.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) throw new Error('CSV must have header + data rows');

    const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
    const data = lines.slice(1).map((line: string) => {
      const cols = line.split(',').map((c: string) => c.trim());
      return {
        employeeCode: cols[headers.indexOf('employee_code')] || cols[headers.indexOf('employeecode')] || cols[0],
        date: cols[headers.indexOf('date')] || cols[1],
        status: cols[headers.indexOf('status')] || cols[2],
        checkIn: cols[headers.indexOf('check_in')] || cols[headers.indexOf('checkin')] || undefined,
        checkOut: cols[headers.indexOf('check_out')] || cols[headers.indexOf('checkout')] || undefined,
        notes: cols[headers.indexOf('notes')] || undefined,
      };
    });

    return this.workflowService.uploadAttendanceCsv(
      req.tenantId, +body.month, +body.year, data, req.user.id,
    );
  }

  @Get('monthly-attendance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List uploaded monthly attendance for a month' })
  getMonthlyAttendance(@Req() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.workflowService.getMonthlyAttendance(req.tenantId, +month, +year);
  }

  @Delete('monthly-attendance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clear ALL uploaded monthly attendance for a month' })
  clearMonthlyAttendance(@Req() req: any, @Query('month') month: string, @Query('year') year: string) {
    return this.workflowService.clearMonthlyAttendance(req.tenantId, +month, +year);
  }

  @Delete('monthly-attendance/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a single uploaded monthly-attendance row' })
  deleteMonthlyAttendanceRow(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.deleteMonthlyAttendanceRow(req.tenantId, id);
  }

  // ── Upload Monthly Attendance Summary (overrides agent/web for payroll) ──

  @Post('upload-monthly-attendance')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Upload monthly attendance summary (Working days/Timeoff/OT); overrides agent/web for payroll' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMonthlyAttendance(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body() body: { month: string; year: string; data?: any },
  ) {
    let rows: any[] = [];
    if (file) {
      rows = await this.workflowService.parseMonthlyAttendanceXlsx(file.buffer);
    } else if ((body as any).data) {
      rows = typeof (body as any).data === 'string' ? JSON.parse((body as any).data) : (body as any).data;
    } else {
      throw new Error('No file or data provided');
    }
    return this.workflowService.uploadMonthlyAttendance(req.tenantId, +body.month, +body.year, rows, req.user.id);
  }

  // ── Payroll Run Detail ────────────────────────────

  @Get('run/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payroll run detail with all payslips' })
  getRunDetail(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.getPayrollRunDetail(req.tenantId, id);
  }

  // ── Modify Payslip ───────────────────────────────

  @Post('payslip/:id/modify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modify individual payslip before freeze' })
  modifyPayslip(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: {
      basic?: number; hra?: number; da?: number;
      specialAllow?: number; otherAllow?: number;
      pfEmployee?: number; esiEmployee?: number;
      profTax?: number; tds?: number; otherDeductions?: number;
      adjustments?: Array<{ type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string; amount: number }>;
      notes?: string;
    },
  ) {
    return this.workflowService.modifyPayslip(req.tenantId, id, body);
  }

  @Post('run/:id/bulk-head')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a one-off head (earning/deduction/reimbursement) to every payslip in the run' })
  bulkAddHead(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string; amount: number },
  ) {
    return this.workflowService.bulkAddHead(req.tenantId, id, body);
  }

  @Post('run/:id/bulk-head/remove')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove a head (matched by type + label) from every payslip in the run' })
  bulkRemoveHead(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { type: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT'; label: string },
  ) {
    return this.workflowService.bulkRemoveHead(req.tenantId, id, body);
  }

  @Post('run/:id/recalculate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Recalculate a run from current pay structures/attendance, preserving manual heads' })
  recalculate(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.recalculatePayroll(req.tenantId, id, req.user.id);
  }

  @Get('run/:id/tax-file')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Download the TDS/tax payout file for a run (defaults to that run month)' })
  async taxFile(@Req() req: any, @Param('id') id: string, @Query('scope') scope: string, @Res() res: Response) {
    const s = (['MONTH', 'QUARTER', 'YEAR'].includes((scope || '').toUpperCase()) ? (scope as string).toUpperCase() : 'MONTH') as 'MONTH' | 'QUARTER' | 'YEAR';
    const { buffer, filename } = await this.workflowService.taxPayoutFile(req.tenantId, id, s);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('tax-file')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Download the TDS/tax payout file by period (scope = MONTH | QUARTER | YEAR)' })
  async taxFileByPeriod(
    @Req() req: any,
    @Query('scope') scope: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('fy') fy: string,
    @Query('quarter') quarter: string,
    @Res() res: Response,
  ) {
    const s = (['MONTH', 'QUARTER', 'YEAR'].includes((scope || '').toUpperCase()) ? (scope as string).toUpperCase() : 'MONTH') as 'MONTH' | 'QUARTER' | 'YEAR';
    const { buffer, filename } = await this.workflowService.taxPayoutByPeriod(req.tenantId, s, {
      month: month ? +month : undefined,
      year: year ? +year : undefined,
      fy: fy ? +fy : undefined,
      quarter: quarter ? +quarter : undefined,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('run/:id/payroll-export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Download the payroll summary XLSX (per-employee Salary/Earning/Deduction breakdown)' })
  async payrollExport(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.workflowService.payrollSummaryFile(req.tenantId, id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // ── Freeze & Bank File ────────────────────────────

  @Post('run/:id/freeze')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Freeze payroll — lock all payslips' })
  freeze(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.freezePayroll(req.tenantId, id, req.user.id);
  }

  @Post('run/:id/bank-file')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate bank transfer XLSX file' })
  generateBankFile(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.generateBankFile(req.tenantId, id, req.user.id);
  }

  @Get('run/:id/bank-file/download')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Download bank transfer XLSX' })
  async downloadBankFile(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const run = await this.workflowService.getPayrollRunDetail(req.tenantId, id);
    if (!(run as any).bankFileUrl) {
      res.status(404).json({ message: 'Bank file not generated yet' });
      return;
    }
    const filePath = (run as any).bankFileUrl.replace(/^\//, '');
    const absPath = require('path').join(process.cwd(), filePath);
    if (!fs.existsSync(absPath)) {
      res.status(404).json({ message: 'Bank file not found on disk' });
      return;
    }
    res.download(absPath);
  }

  // ── Finalize ──────────────────────────────────────

  @Post('run/:id/finalize')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Finalize payroll — generate payslips & notify employees' })
  finalize(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.finalizePayroll(req.tenantId, id, req.user.id);
  }

  // ── Delete Run ────────────────────────────────────

  @Post('run/:id/reopen')
  @ApiOperation({ summary: 'Reopen a frozen/bank-generated payroll back to editable DRAFT (blocked after finalize)' })
  reopen(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.reopenPayroll(req.tenantId, id, req.user.id);
  }

  @Delete('run/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a non-finalized payroll run' })
  deleteRun(@Req() req: any, @Param('id') id: string) {
    return this.workflowService.deletePayrollRun(req.tenantId, id);
  }
}
