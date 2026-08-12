import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientPortalService } from './client-portal.service';
import { SendOtpDto, VerifyOtpDto, SetPortalAccessDto } from './dto/client-portal.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ClientPortalGuard } from './client-portal.guard';

@Controller('client-portal')
@ApiTags('Client Portal')
export class ClientPortalController {
  constructor(private readonly service: ClientPortalService) {}

  // ── Public auth (email OTP) ──

  @Post('send-otp')
  @ApiOperation({ summary: 'Send a login OTP to the client portal email' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.service.sendOtp(dto.email);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and receive a client-portal session token' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.service.verifyOtp(dto.email, dto.otp);
  }

  // ── Admin: enable/disable portal access per client ──

  @Get('access/:clientId')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get portal access status for a client' })
  getAccess(@Req() req: any, @Param('clientId') clientId: string) {
    return this.service.getAccess(req.tenantId, clientId);
  }

  @Post('access/:clientId')
  @UseGuards(AuthGuard, TenantGuard, RbacGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Enable or disable portal access for a client' })
  setAccess(@Req() req: any, @Param('clientId') clientId: string, @Body() dto: SetPortalAccessDto) {
    return this.service.setAccess(req.tenantId, clientId, dto.enabled);
  }

  // ── Client-facing (portal session token) ──

  @Get('dashboard')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Client dashboard summary' })
  getDashboard(@Req() req: any) {
    return this.service.getDashboard(req.portalUser.tenantId, req.portalUser.clientId);
  }

  @Get('team')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Assigned staff (no rates/salary)' })
  getTeam(@Req() req: any) {
    return this.service.getTeam(req.portalUser.tenantId, req.portalUser.clientId);
  }

  @Get('attendance')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Attendance for assigned staff (daily + monthly summary)' })
  getAttendance(@Req() req: any, @Query('month') month?: string, @Query('year') year?: string) {
    return this.service.getAttendance(
      req.portalUser.tenantId, req.portalUser.clientId,
      month ? +month : undefined, year ? +year : undefined,
    );
  }

  @Get('leave')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Leave requests for assigned staff' })
  getLeave(@Req() req: any, @Query('year') year?: string) {
    return this.service.getLeave(req.portalUser.tenantId, req.portalUser.clientId, year ? +year : undefined);
  }

  @Get('invoices')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Client invoices' })
  getInvoices(@Req() req: any) {
    return this.service.getInvoices(req.portalUser.tenantId, req.portalUser.clientId);
  }

  @Get('invoices/:id')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Invoice detail with line items' })
  getInvoiceDetail(@Req() req: any, @Param('id') id: string) {
    return this.service.getInvoiceDetail(req.portalUser.tenantId, req.portalUser.clientId, id);
  }

  @Get('holidays')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Company holidays for the year' })
  getHolidays(@Req() req: any, @Query('year') year?: string) {
    return this.service.getHolidays(req.portalUser.tenantId, year ? +year : undefined);
  }

  @Get('company')
  @UseGuards(ClientPortalGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Company information (name, website, phone, address)' })
  getCompany(@Req() req: any) {
    return this.service.getCompany(req.portalUser.tenantId);
  }
}
