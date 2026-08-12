import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@ApiTags('Users')
@UseGuards(AuthGuard, TenantGuard, RbacGuard)
@ApiBearerAuth('bearer')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users in tenant' })
  @ApiResponse({ status: 200, description: 'User list with pagination' })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(req.tenantId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      role,
    });
  }

  // ── Access profiles ──

  @Get('access-profiles')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List access profiles (role + module set)' })
  listAccessProfiles(@Req() req: any) {
    return this.usersService.listAccessProfiles(req.tenantId);
  }

  @Post('access-profiles')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an access profile (cannot grant beyond your own access)' })
  createAccessProfile(@Req() req: any, @Body() body: any) {
    return this.usersService.createAccessProfile(req.tenantId, body, this.acting(req));
  }

  @Patch('access-profiles/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an access profile (cannot grant beyond your own access)' })
  updateAccessProfile(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.usersService.updateAccessProfile(req.tenantId, id, body, this.acting(req));
  }

  @Delete('access-profiles/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a non-system access profile with no users' })
  deleteAccessProfile(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deleteAccessProfile(req.tenantId, id);
  }

  @Patch(':id/access-profile')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign or clear a user\'s access profile (cannot grant beyond your own access)' })
  assignAccessProfile(
    @Req() req: any,
    @Param('id') id: string,
    @Body('profileId') profileId: string | null,
  ) {
    return this.usersService.assignAccessProfile(req.tenantId, id, profileId ?? null, this.acting(req));
  }

  private acting(req: any) {
    return { id: req.user.id, role: req.user.role, scopes: req.moduleScopes ?? null };
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change user role' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  updateRole(
    @Req() req: any,
    @Param('id') id: string,
    @Body('role') role: UserRole,
  ) {
    return this.usersService.updateRole(req.tenantId, id, role, req.user.id);
  }

  @Patch(':id/module-scopes')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set or clear per-module access for a user (cannot grant beyond your own access)' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  updateModuleScopes(
    @Req() req: any,
    @Param('id') id: string,
    @Body('scopes') scopes: unknown,
  ) {
    return this.usersService.updateModuleScopes(req.tenantId, id, scopes ?? null, this.acting(req));
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate user' })
  @ApiResponse({ status: 200, description: 'Updated user' })
  toggleActive(
    @Req() req: any,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.usersService.toggleActive(req.tenantId, id, isActive, req.user.id);
  }
}
