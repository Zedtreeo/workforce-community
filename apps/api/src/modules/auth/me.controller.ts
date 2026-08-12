import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { SIDEBAR_PERMISSIONS, SIDEBAR_PATH_MODULES } from '../../common/config/permissions';
import { ModuleScopes, scopeAllowsModule } from '../../common/config/module-scopes';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

@Controller('me')
@ApiTags('Me')
@UseGuards(AuthGuard, TenantGuard)
@ApiBearerAuth('bearer')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Get current user profile, role, and permissions' })
  @ApiResponse({ status: 200, description: 'Returns current user profile, role, and permissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@Req() req: any) {
    const user = req.user;
    const role = user.role || 'MEMBER';
    const level = ROLE_HIERARCHY[role] || 0;
    // Set by AuthGuard on every authenticated request
    const scopes: ModuleScopes | null = req.moduleScopes ?? null;

    // Compute accessible sidebar items: role minimums AND per-user module scopes.
    const sidebarAccess: Record<string, boolean> = {};
    const paths = new Set([
      ...Object.keys(SIDEBAR_PERMISSIONS),
      ...Object.keys(SIDEBAR_PATH_MODULES),
    ]);
    for (const path of paths) {
      const minRole =
        SIDEBAR_PERMISSIONS[path] ??
        SIDEBAR_PERMISSIONS[Object.keys(SIDEBAR_PERMISSIONS).find((p) => path.startsWith(`${p}/`)) ?? ''];
      const roleOk = minRole ? level >= (ROLE_HIERARCHY[minRole] || 0) : true;
      const moduleKey = SIDEBAR_PATH_MODULES[path];
      const scopeOk = moduleKey ? scopeAllowsModule(scopes, moduleKey) : true;
      sidebarAccess[path] = roleOk && scopeOk;
    }

    // Compute permission flags (role gate + module scope)
    const isAdmin = level >= ROLE_HIERARCHY.ADMIN;
    const isManager = level >= ROLE_HIERARCHY.MANAGER;
    const canManageEmployees = isAdmin && scopeAllowsModule(scopes, 'employees');
    const canManageClients = isAdmin && scopeAllowsModule(scopes, 'clients');
    const canManageInvoices = isAdmin && scopeAllowsModule(scopes, 'invoices');
    const canManageSettings = isAdmin && scopeAllowsModule(scopes, 'settings');
    const canReviewLeaves = isManager && scopeAllowsModule(scopes, 'leaves');
    const canViewReports = isManager && scopeAllowsModule(scopes, 'reports');
    const canViewMonitoring = isManager && scopeAllowsModule(scopes, 'monitoring');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      tenantId: req.tenantId,
      image: user.image,
      moduleScopes: scopes,
      permissions: {
        canManageEmployees,
        canManageClients,
        canManageInvoices,
        canManageSettings,
        canReviewLeaves,
        canViewReports,
        canViewMonitoring,
      },
      sidebarAccess,
    };
  }
}
