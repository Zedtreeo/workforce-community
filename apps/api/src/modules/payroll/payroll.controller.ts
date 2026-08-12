import {
  Controller, Get, Post, Body, Param, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { CreateSalaryStructureDto } from './dto/create-salary-structure.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('payroll')
@ApiTags('Payroll')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ── Salary Structures ──

  @Get('salary-structures')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List salary structures' })
  @ApiResponse({ status: 200, description: 'List of salary structures returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getSalaryStructures(@Req() req: any, @Query('employeeId') employeeId?: string) {
    return this.payrollService.getSalaryStructures(req.tenantId, { employeeId });
  }

  @Post('salary-structures')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create/update salary structure for employee' })
  @ApiResponse({ status: 201, description: 'Salary structure created or updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  createSalaryStructure(@Req() req: any, @Body() dto: CreateSalaryStructureDto) {
    return this.payrollService.createSalaryStructure(req.tenantId, dto);
  }

  // ── Payroll Runs ──

  @Get('runs')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List payroll runs' })
  @ApiResponse({ status: 200, description: 'List of payroll runs returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getPayrollRuns(@Req() req: any) {
    return this.payrollService.getPayrollRuns(req.tenantId);
  }

  @Post('run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Run monthly payroll' })
  @ApiResponse({ status: 201, description: 'Monthly payroll run executed' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  runPayroll(@Req() req: any, @Body() dto: RunPayrollDto) {
    return this.payrollService.runPayroll(req.tenantId, dto, req.user.id);
  }

  @Post('run-v2')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Run payroll using formula engine (pay structure templates)' })
  @ApiResponse({ status: 201, description: 'Formula-based payroll run executed with itemized lines' })
  @ApiResponse({ status: 400, description: 'No active assignments or validation error' })
  @ApiResponse({ status: 409, description: 'Payroll already exists for this month' })
  runPayrollV2(@Req() req: any, @Body() dto: RunPayrollDto) {
    return this.payrollService.runPayrollV2(req.tenantId, dto, req.user.id);
  }

  // ── Payslips ──

  @Get('payslips')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List payslips' })
  @ApiResponse({ status: 200, description: 'List of payslips returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getPayslips(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.payrollService.getPayslips(req.tenantId, {
      month: month ? +month : undefined,
      year: year ? +year : undefined,
      employeeId,
    });
  }

  // ── Portal: My Payslips (must be above :id routes) ──

  @Get('my-payslips')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'My payslips (employee self-service)' })
  @ApiResponse({ status: 200, description: 'Current user payslips returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getMyPayslips(@Req() req: any, @Query('year') year?: string) {
    return this.payrollService.getMyPayslips(req.tenantId, req.user.email, {
      year: year ? +year : undefined,
    });
  }

  @Get('payslips/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payslip detail' })
  @ApiResponse({ status: 200, description: 'Payslip detail returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  getPayslip(@Req() req: any, @Param('id') id: string) {
    return this.payrollService.getPayslip(req.tenantId, id);
  }

  @Get('payslips/:id/pdf')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Download payslip PDF' })
  @ApiResponse({ status: 200, description: 'Payslip PDF generated and returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getPayslipPdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.payrollService.getPayslipPdf(req.tenantId, id, {
      email: req.user?.email,
      role: req.user?.role,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payslip-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
