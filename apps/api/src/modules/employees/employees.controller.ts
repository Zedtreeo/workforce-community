import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { scopeAllowsModule } from '../../common/config/module-scopes';
import { EmployeeStatus, UserRole } from '@prisma/client';

// Employee records hold salary / bankAccount / panNumber. Floor the controller
// at MANAGER+ so a MEMBER can't read colleagues' pay/PII via GET /employees[/:id]
// (the employee's OWN profile comes from the self-scoped /portal routes).
// Stricter per-method @Roles(ADMIN) for mutations still override this.
@Controller('employees')
@ApiTags('Employees')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
@ApiBearerAuth('bearer')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * Compensation / banking / statutory identifiers are pay data. Roles whose
   * module scopes don't grant `payroll` (e.g. an attendance/roster-only
   * profile) can still see the employee directory but must not see anything
   * related to salary or monthly payment — strip those fields from the payload.
   */
  private canSeePayroll(req: any): boolean {
    return scopeAllowsModule(req.moduleScopes ?? null, 'payroll');
  }

  private static readonly PAY_FIELDS = [
    'salary', 'bankAccount', 'bankIfsc', 'bankName', 'bankBranch',
    'panNumber', 'pfNumber', 'esiNumber',
    // Pay-structure assignments carry ctcMonthly (monthly CTC) — comp data.
    'payStructureAssignments', 'consultantTdsRate', 'taxRegime',
  ];

  private stripPay<T>(emp: T, canSee: boolean): T {
    if (canSee || !emp || typeof emp !== 'object') return emp;
    const rest: any = { ...(emp as any) };
    for (const f of EmployeesController.PAY_FIELDS) delete rest[f];
    return rest as T;
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create employee' })
  @ApiResponse({ status: 201, description: 'Newly created employee record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(@Req() req: any, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.tenantId, dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List employees (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Employee list with pagination metadata' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('departmentId') departmentId?: string,
  ) {
    const res = await this.employeesService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      departmentId,
    });
    if (!this.canSeePayroll(req)) {
      res.data = res.data.map((e: any) => this.stripPay(e, false));
    }
    return res;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get employee statistics for tenant' })
  @ApiResponse({ status: 200, description: 'Employee count and status breakdown statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@Req() req: any) {
    return this.employeesService.getStats(req.tenantId);
  }

  @Get('designations')
  @ApiOperation({ summary: 'Distinct designations used in this tenant (for create-or-select)' })
  @ApiResponse({ status: 200, description: 'Array of designation strings' })
  getDesignations(@Req() req: any) {
    return this.employeesService.getDesignations(req.tenantId);
  }

  @Get(':id/portal-access')
  @ApiOperation({ summary: 'Check if employee has portal access' })
  @ApiResponse({ status: 200, description: 'Boolean indicating whether employee has portal access' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async checkPortalAccess(@Req() req: any, @Param('id') id: string) {
    const hasAccess = await this.employeesService.hasPortalAccess(req.tenantId, id);
    return { hasAccess };
  }

  @Post(':id/grant-portal-access')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Enable portal access (passwordless OTP login) for an employee' })
  @ApiResponse({ status: 201, description: 'Portal access enabled — employee signs in with an email OTP' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  grantPortalAccess(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.grantPortalAccess(req.tenantId, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee details with department and assignment info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const emp = await this.employeesService.findOne(req.tenantId, id);
    return this.stripPay(emp, this.canSeePayroll(req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update employee' })
  @ApiResponse({ status: 200, description: 'Updated employee record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(req.tenantId, id, dto, req.user?.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete employee' })
  @ApiResponse({ status: 200, description: 'Employee soft-deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.remove(req.tenantId, id, req.user?.id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore soft-deleted employee' })
  @ApiResponse({ status: 201, description: 'Employee restored from soft-delete' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  restore(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.restore(req.tenantId, id);
  }

  @Delete(':id/portal-access')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disable (revoke) employee portal access' })
  @ApiResponse({ status: 200, description: 'Portal access disabled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  revokePortalAccess(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.revokePortalAccess(req.tenantId, id);
  }
  @Post(':id/approve')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Approve a SUBMITTED employee — flips status to ACTIVE and enables login' })
  approve(@Req() req: any, @Param('id') id: string) {
    return this.employeesService.approve(req.tenantId, id, req.user?.id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OWNER)
  @ApiOperation({ summary: 'Reject a SUBMITTED employee with reason' })
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.employeesService.reject(req.tenantId, id, body?.reason, req.user?.id);
  }

}
