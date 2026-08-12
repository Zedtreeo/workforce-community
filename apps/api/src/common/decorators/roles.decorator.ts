import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../guards/rbac.guard';

/**
 * Decorator to set minimum required roles on a route.
 * Usage: @Roles(UserRole.ADMIN, UserRole.OWNER)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
