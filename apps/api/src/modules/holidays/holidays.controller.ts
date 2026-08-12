import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('holidays')
@ApiTags('Holidays & Shifts')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  // ── Holidays ──

  @Get()
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'List holidays for year' })
  @ApiResponse({ status: 200, description: 'List of holidays for the specified year' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getHolidays(@Req() req: any, @Query('year') year?: string) {
    return this.holidaysService.getHolidays(req.tenantId, { year: year ? +year : undefined });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add a holiday' })
  @ApiResponse({ status: 201, description: 'Newly created holiday entry' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  createHoliday(@Req() req: any, @Body() dto: CreateHolidayDto) {
    return this.holidaysService.createHoliday(req.tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a holiday' })
  @ApiResponse({ status: 200, description: 'Holiday deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deleteHoliday(@Req() req: any, @Param('id') id: string) {
    return this.holidaysService.deleteHoliday(req.tenantId, id);
  }

  // ── Shift Types ──

  @Get('shifts')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List shift types' })
  @ApiResponse({ status: 200, description: 'List of all configured shift types' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getShiftTypes(@Req() req: any) {
    return this.holidaysService.getShiftTypes(req.tenantId);
  }

  @Post('shifts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create shift type' })
  @ApiResponse({ status: 201, description: 'Newly created shift type' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  createShiftType(@Req() req: any, @Body() dto: CreateShiftDto) {
    return this.holidaysService.createShiftType(req.tenantId, dto);
  }

  // ── Employee Shift Assignments ──

  @Get('shifts/assignments')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'List employee shift assignments' })
  @ApiResponse({ status: 200, description: 'Employee shift assignment list with shift details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getAssignments(@Req() req: any, @Query('employeeId') employeeId?: string) {
    return this.holidaysService.getEmployeeShifts(req.tenantId, { employeeId });
  }

  @Post('shifts/assign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign shift to employee' })
  @ApiResponse({ status: 201, description: 'Shift assigned to employee successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  assignShift(@Req() req: any, @Body() dto: AssignShiftDto) {
    return this.holidaysService.assignShift(req.tenantId, dto);
  }
}
