import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Role hierarchy: OWNER > ADMIN > MANAGER > MEMBER > VIEWER
 * A user with a higher role can access endpoints requiring a lower role.
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles specified = open to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as UserRole;

    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const minRequired = Math.min(
      ...requiredRoles.map((r) => ROLE_HIERARCHY[r] || 0),
    );

    if (userLevel < minRequired) {
      throw new ForbiddenException(
        `Role ${userRole} does not have access. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
