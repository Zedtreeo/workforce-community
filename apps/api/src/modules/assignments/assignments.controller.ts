import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AssignmentStatus, UserRole } from '@prisma/client';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { EndAssignmentDto } from './dto/end-assignment.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { scopeAllowsModule } from '../../common/config/module-scopes';

// Assignments carry the client billing rate / currency / cycle (payment data).
// Restrict the whole controller to MANAGER+ so MEMBER employees can never read
// it. Employees see only their client's NAME via the self-scoped /portal routes.
@Controller('assignments')
@ApiTags('Assignments')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
@ApiBearerAuth('bearer')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  /**
   * billingRate/billingCycle are what the client is billed — invoice/revenue
   * data. Roles whose module scopes don't grant `invoices` (e.g. an
   * attendance/roster-only profile) may see the employee↔client mapping but
   * not the money — strip it. Managers with full (null) scopes keep it.
   */
  private canSeeBilling(req: any): boolean {
    return scopeAllowsModule(req.moduleScopes ?? null, 'invoices');
  }

  private stripBilling<T>(a: T, canSee: boolean): T {
    if (canSee || !a || typeof a !== 'object') return a;
    const { billingRate, billingCycle, ...rest } = a as any;
    return rest as T;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new assignment (employee → client)' })
  @ApiResponse({ status: 201, description: 'Newly created employee-to-client assignment' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Req() req: any, @Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(req.tenantId, dto, req.user?.id);
  }

  @Get()
  @ApiOperation({ summary: 'List assignments (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Assignment list with pagination metadata' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employeeId') employeeId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: AssignmentStatus,
  ) {
    const res = await this.assignmentsService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      employeeId,
      clientId,
      status,
    });
    if (!this.canSeeBilling(req)) {
      res.data = res.data.map((a: any) => this.stripBilling(a, false));
    }
    return res;
  }

  @Get('active/:employeeId')
  @ApiOperation({ summary: 'Get current active assignment for an employee' })
  @ApiResponse({ status: 200, description: 'Active assignment details for the specified employee' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findActiveForEmployee(@Req() req: any, @Param('employeeId') employeeId: string) {
    const a = await this.assignmentsService.findActiveForEmployee(req.tenantId, employeeId);
    return this.stripBilling(a, this.canSeeBilling(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by ID' })
  @ApiResponse({ status: 200, description: 'Assignment details with employee and client info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findOne(@Req() req: any, @Param('id') id: string) {
    const a = await this.assignmentsService.findOne(req.tenantId, id);
    return this.stripBilling(a, this.canSeeBilling(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update assignment (rate, dates, notes — not employee/client)' })
  @ApiResponse({ status: 200, description: 'Updated assignment record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(req.tenantId, id, dto, req.user?.id);
  }

  @Post(':id/end')
  @HttpCode(200)
  @ApiOperation({ summary: 'End an active assignment' })
  @ApiResponse({ status: 200, description: 'Assignment ended with end date and reason recorded' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  end(@Req() req: any, @Param('id') id: string, @Body() dto: EndAssignmentDto) {
    return this.assignmentsService.end(req.tenantId, id, dto, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hard delete assignment (admin only)' })
  @ApiResponse({ status: 200, description: 'Assignment permanently deleted' })
  @ApiResponse({ status: 404, description: 'Not found' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.assignmentsService.remove(req.tenantId, id);
  }
}
