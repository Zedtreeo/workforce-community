import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Shifts')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  // ── Shift Types ───────────────────────────────────

  @Get()
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'List all shift types' })
  async listShiftTypes(@Req() req: any) {
    return this.shiftsService.getShiftTypes(req.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Get shift type detail with assigned employees' })
  async getShiftType(@Req() req: any, @Param('id') id: string) {
    return this.shiftsService.getShiftType(req.tenantId, id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new shift type' })
  async createShiftType(@Req() req: any, @Body() body: any) {
    return this.shiftsService.createShiftType(req.tenantId, body);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update shift type' })
  async updateShiftType(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.shiftsService.updateShiftType(req.tenantId, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete shift type (only if no active assignments)' })
  async deleteShiftType(@Req() req: any, @Param('id') id: string) {
    return this.shiftsService.deleteShiftType(req.tenantId, id);
  }

  // ── Employee Shift Assignments ────────────────────

  @Post('assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign shift to employee' })
  async assignShift(@Req() req: any, @Body() body: any) {
    return this.shiftsService.assignShift(req.tenantId, body);
  }

  @Post('assign/bulk')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk assign shift to multiple employees' })
  async bulkAssignShift(@Req() req: any, @Body() body: any) {
    return this.shiftsService.bulkAssignShift(req.tenantId, body);
  }

  @Get('employee/:employeeId')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Get current shift for employee' })
  async getEmployeeShift(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.shiftsService.getEmployeeShift(req.tenantId, employeeId);
  }

  @Get('employee/:employeeId/history')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Get shift history for employee' })
  async getEmployeeShiftHistory(@Req() req: any, @Param('employeeId') employeeId: string) {
    return this.shiftsService.getEmployeeShiftHistory(req.tenantId, employeeId);
  }
}
