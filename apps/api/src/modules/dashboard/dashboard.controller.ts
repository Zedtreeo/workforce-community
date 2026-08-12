import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

// Dashboard stats expose client REVENUE (invoice draft/outstanding/collected/
// overdue). Gate at MANAGER+ so a MEMBER can't read billing figures.
@Controller('dashboard')
@ApiTags('Dashboard')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@Roles(UserRole.MANAGER)
@ApiBearerAuth('bearer')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated dashboard stats' })
  @ApiResponse({ status: 200, description: 'Returns aggregated dashboard statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@Req() req: any) {
    return this.dashboardService.getStats(req.tenantId);
  }
}
