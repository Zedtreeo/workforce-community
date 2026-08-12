import {
  Controller, Get, Patch, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ProfileChangesService } from './profile-changes.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('profile-changes')
@ApiTags('Profile Changes')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class ProfileChangesController {
  constructor(private readonly service: ProfileChangesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List profile change requests' })
  @ApiResponse({ status: 200, description: 'Paginated list of change requests' })
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(req.tenantId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('pending-count')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Count of pending change requests' })
  getPendingCount(@Req() req: any) {
    return this.service.getPendingCount(req.tenantId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get single change request with details' })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.tenantId, id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve profile change request' })
  @ApiResponse({ status: 200, description: 'Changes approved and applied to employee' })
  approve(
    @Req() req: any,
    @Param('id') id: string,
    @Body('comment') comment?: string,
  ) {
    return this.service.approve(req.tenantId, id, req.user.id, comment);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject profile change request' })
  @ApiResponse({ status: 200, description: 'Changes rejected' })
  reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body('comment') comment?: string,
  ) {
    return this.service.reject(req.tenantId, id, req.user.id, comment);
  }
}

