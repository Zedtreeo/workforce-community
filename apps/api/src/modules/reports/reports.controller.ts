import {
  Controller, Get, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  DateRangeQueryDto,
  AttendanceReportQueryDto,
  BillingReportQueryDto,
  LeaveSummaryQueryDto,
} from './dto';

// Reports expose CLIENT BILLING (revenue) + tenant-wide attendance/productivity.
// Gate at MANAGER+ so a MEMBER can't read billing or other employees' data.
// (The Billing profile — ADMIN base, scope reports/billing — still reaches it.)
@Controller('reports')
@ApiTags('Reports')
@ApiBearerAuth('bearer')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance report by date range' })
  @ApiResponse({ status: 200, description: 'Attendance report returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  attendanceReport(@Req() req: any, @Query() query: AttendanceReportQueryDto) {
    return this.reportsService.attendanceReport(req.tenantId, {
      startDate: query.startDate,
      endDate: query.endDate,
      employeeId: query.employeeId,
      departmentId: query.departmentId,
    });
  }

  @Get('work-hours')
  @ApiOperation({ summary: 'Work hours report from time logs' })
  @ApiResponse({ status: 200, description: 'Work hours report returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  workHoursReport(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.reportsService.workHoursReport(req.tenantId, {
      startDate: query.startDate,
      endDate: query.endDate,
      employeeId: query.employeeId,
    });
  }

  @Get('billing')
  @ApiOperation({ summary: 'Client billing summary' })
  @ApiResponse({ status: 200, description: 'Client billing summary returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  billingReport(@Req() req: any, @Query() query: BillingReportQueryDto) {
    return this.reportsService.billingReport(req.tenantId, {
      year: query.year ? parseInt(query.year, 10) : undefined,
      clientId: query.clientId,
    });
  }

  @Get('productivity')
  @ApiOperation({ summary: 'Employee productivity report from activity snapshots' })
  @ApiResponse({ status: 200, description: 'Employee productivity report returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  productivityReport(@Req() req: any, @Query() query: DateRangeQueryDto) {
    return this.reportsService.productivityReport(req.tenantId, {
      startDate: query.startDate,
      endDate: query.endDate,
      employeeId: query.employeeId,
    });
  }

  @Get('leaves')
  @ApiOperation({ summary: 'Leave summary report' })
  @ApiResponse({ status: 200, description: 'Leave summary report returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  leaveSummary(@Req() req: any, @Query() query: LeaveSummaryQueryDto) {
    return this.reportsService.leaveSummary(req.tenantId, {
      year: query.year ? parseInt(query.year, 10) : undefined,
      employeeId: query.employeeId,
    });
  }
}
