import {
  Controller, Get, Post, Patch,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { InitBalancesDto } from './dto/init-balances.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('leaves')
@ApiTags('Leaves')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // ── Leave Types ──

  @Post('types')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a leave type' })
  @ApiResponse({ status: 201, description: 'Newly created leave type' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  createLeaveType(@Req() req: any, @Body() dto: CreateLeaveTypeDto) {
    return this.leavesService.createLeaveType(req.tenantId, dto);
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiResponse({ status: 200, description: 'Updated leave type record' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateLeaveType(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leavesService.updateLeaveType(req.tenantId, id, dto);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all leave types for tenant' })
  @ApiResponse({ status: 200, description: 'List of all configured leave types' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLeaveTypes(@Req() req: any) {
    return this.leavesService.getLeaveTypes(req.tenantId);
  }

  // ── Balances ──

  @Post('accrue')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Run client-tenure leave accrual now (1/mo full-time, 0.5/mo part-time)' })
  accrue(@Req() req: any) {
    return this.leavesService.accrueClientTenureLeaves(req.tenantId);
  }


  @Post('balances/init')
  @ApiOperation({ summary: 'Initialize leave balances for employees' })
  @ApiResponse({ status: 201, description: 'Leave balances initialized for specified employees' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  initBalances(@Req() req: any, @Body() dto: InitBalancesDto) {
    return this.leavesService.initBalances(req.tenantId, dto);
  }

  @Get('balances')
  @ApiOperation({ summary: 'Get leave balances (filterable by employee/year)' })
  @ApiResponse({ status: 200, description: 'Leave balances per employee and leave type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getBalances(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('year') year?: string,
  ) {
    return this.leavesService.getBalances(req.tenantId, {
      employeeId,
      year: year ? parseInt(year, 10) : undefined,
    });
  }

  @Patch('balances/:id/adjust')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: set the adjustment value on a leave balance' })
  @ApiResponse({ status: 200, description: 'Updated leave balance' })
  adjustBalance(@Req() req: any, @Param('id') id: string, @Body() body: { adjustment: number; note?: string }) {
    return this.leavesService.adjustBalance(req.tenantId, id, Number(body?.adjustment ?? 0));
  }

  // ── Leave Requests ──

  @Post('apply')
  @ApiOperation({ summary: 'Apply for leave' })
  @ApiResponse({ status: 201, description: 'Leave request submitted for approval' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  applyLeave(@Req() req: any, @Body() dto: ApplyLeaveDto) {
    return this.leavesService.applyLeave(req.tenantId, dto);
  }

  @Post(':id/review')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  @ApiResponse({ status: 201, description: 'Leave request reviewed with approval or rejection' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  reviewLeave(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewLeaveDto) {
    return this.leavesService.reviewLeave(req.tenantId, id, req.userId, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a leave request' })
  @ApiResponse({ status: 201, description: 'Leave request cancelled and balance restored' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not found' })
  cancelLeave(@Req() req: any, @Param('id') id: string) {
    return this.leavesService.cancelLeave(req.tenantId, id);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get leave requests (filterable)' })
  @ApiResponse({ status: 200, description: 'Paginated leave requests with employee and type details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLeaveRequests(
    @Req() req: any,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leavesService.getLeaveRequests(req.tenantId, {
      employeeId,
      status,
      year: year ? parseInt(year, 10) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get leave statistics for the tenant' })
  @ApiResponse({ status: 200, description: 'Leave usage statistics and trends for the tenant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLeaveStats(@Req() req: any) {
    return this.leavesService.getLeaveStats(req.tenantId);
  }
}
