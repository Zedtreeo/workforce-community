import {
  Controller, Get, Post, Patch,
  Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('settings')
@ApiTags('Settings')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Tenant Settings ──

  @Get('tenant')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tenant settings' })
  @ApiResponse({ status: 200, description: 'Returns tenant settings' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getTenantSettings(@Req() req: any) {
    return this.settingsService.getTenantSettings(req.tenantId);
  }

  @Patch('tenant')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update tenant settings' })
  @ApiResponse({ status: 200, description: 'Tenant settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  updateTenantSettings(@Req() req: any, @Body() dto: UpdateTenantSettingsDto) {
    return this.settingsService.updateTenantSettings(req.tenantId, dto);
  }

  // ── User Management ──

  @Get('users')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users in tenant' })
  @ApiResponse({ status: 200, description: 'Returns list of users in the tenant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  getUsers(@Req() req: any) {
    return this.settingsService.getUsers(req.tenantId);
  }

  @Post('users/invite')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite/create a new user' })
  @ApiResponse({ status: 201, description: 'User invited successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  inviteUser(@Req() req: any, @Body() dto: InviteUserDto) {
    return this.settingsService.inviteUser(req.tenantId, dto);
  }

  @Patch('users/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user role or status' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  updateUser(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.settingsService.updateUser(req.tenantId, id, dto, req.user.id);
  }

  @Post('users/:id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Deactivate a user' })
  @ApiResponse({ status: 201, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Not found' })
  deactivateUser(@Req() req: any, @Param('id') id: string) {
    return this.settingsService.deactivateUser(req.tenantId, id, req.user.id);
  }
}
