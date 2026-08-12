import {
  Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PortalApplyLeaveDto, AttendanceCorrectionDto } from './portal.dto';
import { AppraisalsService } from '../appraisals/appraisals.service';
import { SelfReviewDto } from '../appraisals/dto/appraisals.dto';

@Controller('portal')
@ApiTags('Employee Portal')
@UseGuards(AuthGuard, TenantGuard)
@ApiBearerAuth('bearer')
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly appraisals: AppraisalsService,
  ) {}

  @Get('appraisal')
  @ApiOperation({ summary: 'My current open appraisal cycle (self-review), if any' })
  getMyAppraisal(@Req() req: any) {
    return this.appraisals.getMyAppraisal(req.tenantId, req.user.email);
  }

  @Post('appraisal/:id/self-review')
  @ApiOperation({ summary: 'Submit my appraisal self-review' })
  submitSelfReview(@Req() req: any, @Param('id') id: string, @Body() dto: SelfReviewDto) {
    return this.appraisals.submitSelfReview(req.tenantId, req.user.email, id, dto);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'My dashboard — today snapshot' })
  @ApiResponse({ status: 200, description: 'Returns employee dashboard snapshot for today' })
  getMyDashboard(@Req() req: any) {
    return this.portalService.getMyDashboard(req.tenantId, req.user.email);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get my employee profile with pending changes' })
  @ApiResponse({ status: 200, description: 'Employee profile and pending change requests' })
  getMyProfile(@Req() req: any) {
    return this.portalService.getMyProfile(req.tenantId, req.user.email);
  }

  @Post('profile-change')
  @ApiOperation({ summary: 'Submit profile change request for admin approval' })
  @ApiResponse({ status: 201, description: 'Change request submitted' })
  @ApiResponse({ status: 400, description: 'No changes or invalid fields' })
  submitProfileChange(@Req() req: any, @Body() body: any) {
    return this.portalService.submitProfileChange(req.tenantId, req.user.email, req.user.id, body);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'My attendance history' })
  @ApiResponse({ status: 200, description: 'Returns employee attendance history' })
  getMyAttendance(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.portalService.getMyAttendance(req.tenantId, req.user.email, {
      month: month ? +month : undefined,
      year: year ? +year : undefined,
    });
  }

  @Get('leaves')
  @ApiOperation({ summary: 'My leave requests & balances' })
  @ApiResponse({ status: 200, description: 'Returns employee leave requests and balances' })
  getMyLeaves(
    @Req() req: any,
    @Query('year') year?: string,
  ) {
    return this.portalService.getMyLeaves(req.tenantId, req.user.email, {
      year: year ? +year : undefined,
    });
  }

  @Get('monitoring')
  @ApiOperation({ summary: 'My time logs & activity for a date' })
  @ApiResponse({ status: 200, description: 'Returns employee time logs and activity for a date' })
  getMyMonitoring(
    @Req() req: any,
    @Query('date') date?: string,
  ) {
    return this.portalService.getMyMonitoring(req.tenantId, req.user.email, {
      date,
    });
  }

  @Post('leaves/apply')
  @ApiOperation({ summary: 'Apply for leave (self-service)' })
  @ApiResponse({ status: 201, description: 'Leave application submitted successfully' })
  applyLeave(@Req() req: any, @Body() body: PortalApplyLeaveDto) {
    return this.portalService.applyLeave(req.tenantId, req.user.email, body);
  }

  @Get('leave-types')
  @ApiOperation({ summary: 'Get available leave types for tenant' })
  @ApiResponse({ status: 200, description: 'Returns available leave types for the tenant' })
  getLeaveTypes(@Req() req: any) {
    return this.portalService.getLeaveTypes(req.tenantId);
  }

  @Get('holidays')
  @ApiOperation({ summary: 'Tenant holidays for the year' })
  @ApiResponse({ status: 200, description: 'Returns holidays for the year' })
  getHolidays(@Req() req: any, @Query('year') year?: string) {
    return this.portalService.getMyHolidays(req.tenantId, year ? +year : undefined);
  }

  @Get('assignments')
  @ApiOperation({ summary: 'My client assignments' })
  @ApiResponse({ status: 200, description: 'Returns employee assignments' })
  getMyAssignments(@Req() req: any) {
    return this.portalService.getMyAssignments(req.tenantId, req.user.email);
  }

  @Get('payslips')
  @ApiOperation({ summary: 'My payslips' })
  @ApiResponse({ status: 200, description: 'Returns employee payslips' })
  getMyPayslips(@Req() req: any) {
    return this.portalService.getMyPayslips(req.tenantId, req.user.email);
  }

  @Post('attendance/correction')
  @ApiOperation({ summary: 'Request attendance correction' })
  @ApiResponse({ status: 201, description: 'Attendance correction request submitted' })
  requestCorrection(@Req() req: any, @Body() body: AttendanceCorrectionDto) {
    return this.portalService.requestAttendanceCorrection(req.tenantId, req.user.email, body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my employee profile (for portal pages)' })
  @ApiResponse({ status: 200, description: 'Returns employee profile with ID' })
  getMe(@Req() req: any) {
    return this.portalService.getMe(req.tenantId, req.user.email);
  }

  @Get('my-pay-structure')
  @ApiOperation({ summary: 'Get my active pay structure assignment' })
  @ApiResponse({ status: 200, description: 'Returns active pay structure assignment with components' })
  getMyPayStructure(@Req() req: any) {
    return this.portalService.getMyPayStructure(req.tenantId, req.user.email);
  }

  @Get('clock-status')
  @ApiOperation({ summary: 'My current clock-in status + today\'s hours' })
  @ApiResponse({ status: 200, description: 'Returns whether I am currently clocked in and today totals' })
  getMyClockStatus(@Req() req: any) {
    return this.portalService.getMyClockStatus(req.tenantId, req.user.email);
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock me in from the web portal' })
  @ApiResponse({ status: 201, description: 'Clocked in successfully' })
  @ApiResponse({ status: 409, description: 'Already clocked in' })
  clockMeIn(@Req() req: any, @Body() body: { notes?: string }) {
    return this.portalService.clockMeIn(req.tenantId, req.user.email, body?.notes);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock me out from the web portal' })
  @ApiResponse({ status: 201, description: 'Clocked out successfully' })
  @ApiResponse({ status: 409, description: 'Not currently clocked in' })
  clockMeOut(@Req() req: any) {
    return this.portalService.clockMeOut(req.tenantId, req.user.email);
  }

  @Get('recent-sessions')
  @ApiOperation({ summary: 'My recent clock-in/out sessions (last 10 by default)' })
  @ApiResponse({ status: 200, description: 'Returns recent time-logs with full durations' })
  getMyRecentSessions(@Req() req: any, @Query('limit') limit?: string) {
    return this.portalService.getMyRecentSessions(req.tenantId, req.user.email, limit ? +limit : 10);
  }

  @Get('company')
  @ApiOperation({ summary: 'Company information (name, website, phone, address)' })
  getCompany(@Req() req: any) {
    return this.portalService.getCompany(req.tenantId);
  }

}
