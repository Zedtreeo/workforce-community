import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { UserRole, Prisma } from '@prisma/client';
import {
  ModuleScopes, parseModuleScopes, invalidateModuleScopes, invalidateAllModuleScopes,
  excessModules,
} from '../../common/config/module-scopes';

/** Who is performing a role/scope change (from AuthGuard). */
export interface ActingUser {
  id: string;
  role: string;
  scopes: ModuleScopes | null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 50,
  ADMIN: 40,
  MANAGER: 30,
  MEMBER: 20,
  VIEWER: 10,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { page?: number; limit?: number; search?: string; role?: string }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      deletedAt: null,
    };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.role) {
      where.role = params.role;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          moduleScopes: true,
          accessProfile: { select: { id: true, name: true, baseRole: true, scopes: true } },
          lastLoginAt: true,
          createdAt: true,
          image: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateRole(tenantId: string, userId: string, newRole: UserRole, actingUserId: string) {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === actingUserId) throw new BadRequestException('Cannot change your own role');

    const actingUser = await this.prisma.user.findFirst({
      where: { id: actingUserId, tenantId },
    });
    if (!actingUser) throw new ForbiddenException('Acting user not found');

    const actingLevel = ROLE_HIERARCHY[actingUser.role] || 0;
    const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
    const newLevel = ROLE_HIERARCHY[newRole] || 0;

    if (newLevel >= actingLevel) throw new ForbiddenException('Cannot assign a role equal to or higher than your own');
    if (targetLevel >= actingLevel) throw new ForbiddenException('Cannot change role of a user at or above your level');
    if (newRole === UserRole.OWNER) throw new ForbiddenException('OWNER role cannot be assigned');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }

  /**
   * Set or clear a user's per-module access (users.module_scopes).
   * Admins can never grant modules they don't have themselves — a scoped
   * admin therefore can't lift their own (or anyone's) restriction beyond
   * their own access.
   */
  async updateModuleScopes(
    tenantId: string,
    userId: string,
    rawScopes: unknown,
    acting: ActingUser,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === acting.id) {
      throw new BadRequestException('Cannot change your own module access');
    }
    this.assertGrantWithin(acting, { role: targetUser.role, scopes: parseModuleScopes(rawScopes) });

    const scopes = rawScopes === null || rawScopes === undefined ? null : parseModuleScopes(rawScopes);
    if (rawScopes !== null && rawScopes !== undefined && !scopes) {
      throw new BadRequestException(
        'Invalid scopes — expected {"mode":"allow"|"deny","modules":["invoices",...]} or null for full access',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { moduleScopes: scopes === null ? Prisma.DbNull : (scopes as any) },
      select: { id: true, email: true, name: true, role: true, isActive: true, moduleScopes: true },
    });
    invalidateModuleScopes(userId);
    return updated;
  }

  // ── Access profiles (named role + module set) ──

  /**
   * "You can give others at most what you have": block a change that would
   * grant modules the acting admin can't reach themselves.
   */
  private assertGrantWithin(acting: ActingUser, target: { role: string; scopes: ModuleScopes | null }) {
    const excess = excessModules(
      { role: acting.role, scopes: acting.scopes },
      target,
    );
    if (excess.length > 0) {
      throw new ForbiddenException(
        `You cannot grant modules you don't have access to: ${excess.join(', ')}`,
      );
    }
  }

  async listAccessProfiles(tenantId: string) {
    return this.prisma.accessProfile.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      select: {
        id: true, name: true, description: true, baseRole: true,
        scopes: true, isSystem: true,
        _count: { select: { users: true } },
      },
    });
  }

  async createAccessProfile(
    tenantId: string,
    body: { name?: string; description?: string; baseRole?: UserRole; scopes?: unknown },
    acting: ActingUser,
  ) {
    const name = (body.name ?? '').trim();
    if (!name) throw new BadRequestException('Profile name is required');
    const baseRole = body.baseRole ?? UserRole.MEMBER;
    if (baseRole === UserRole.OWNER) throw new ForbiddenException('OWNER profiles cannot be created');
    const scopes = this.parseScopesOrThrow(body.scopes);
    this.assertGrantWithin(acting, { role: baseRole, scopes });

    const existing = await this.prisma.accessProfile.findFirst({ where: { tenantId, name } });
    if (existing) throw new BadRequestException(`A profile named "${name}" already exists`);

    return this.prisma.accessProfile.create({
      data: {
        tenantId, name,
        description: body.description?.trim() || null,
        baseRole,
        scopes: scopes === null ? Prisma.DbNull : (scopes as any),
      },
    });
  }

  async updateAccessProfile(
    tenantId: string,
    profileId: string,
    body: { name?: string; description?: string; baseRole?: UserRole; scopes?: unknown },
    acting: ActingUser,
  ) {
    const profile = await this.prisma.accessProfile.findFirst({ where: { id: profileId, tenantId } });
    if (!profile) throw new NotFoundException('Profile not found');

    // The profile's RESULTING access must stay within the acting admin's own
    const resultingRole = (body.baseRole ?? profile.baseRole) as UserRole;
    const resultingScopes = body.scopes !== undefined
      ? this.parseScopesOrThrow(body.scopes)
      : parseModuleScopes(profile.scopes);
    this.assertGrantWithin(acting, { role: resultingRole, scopes: resultingScopes });

    const data: any = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw new BadRequestException('Profile name is required');
      if (profile.isSystem && name !== profile.name) {
        throw new BadRequestException('System profiles cannot be renamed');
      }
      data.name = name;
    }
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.baseRole !== undefined) {
      if (body.baseRole === UserRole.OWNER) throw new ForbiddenException('OWNER role cannot be assigned');
      data.baseRole = body.baseRole;
    }
    if (body.scopes !== undefined) {
      const scopes = this.parseScopesOrThrow(body.scopes);
      data.scopes = scopes === null ? Prisma.DbNull : scopes;
    }

    // Editing the access of your OWN profile could lock you out mid-flight.
    const actingUser = await this.prisma.user.findFirst({
      where: { id: acting.id, tenantId }, select: { accessProfileId: true },
    });
    if (actingUser?.accessProfileId === profileId && (data.scopes !== undefined || data.baseRole)) {
      throw new BadRequestException('You cannot change the access of the profile you are assigned to');
    }

    const updated = await this.prisma.accessProfile.update({ where: { id: profileId }, data });

    // Keep assigned users' role in sync with the profile's base role
    if (data.baseRole) {
      await this.prisma.user.updateMany({
        where: { tenantId, accessProfileId: profileId, role: { not: UserRole.OWNER } },
        data: { role: data.baseRole },
      });
    }
    invalidateAllModuleScopes();
    return updated;
  }

  async deleteAccessProfile(tenantId: string, profileId: string) {
    const profile = await this.prisma.accessProfile.findFirst({
      where: { id: profileId, tenantId },
      include: { _count: { select: { users: true } } },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile.isSystem) throw new BadRequestException('System profiles cannot be deleted');
    if (profile._count.users > 0) {
      throw new BadRequestException(`${profile._count.users} user(s) are assigned to this profile — reassign them first`);
    }
    await this.prisma.accessProfile.delete({ where: { id: profileId } });
    return { deleted: true };
  }

  /** Assign a profile (stamps its baseRole, clears per-user override) or unassign with null. */
  async assignAccessProfile(
    tenantId: string,
    userId: string,
    profileId: string | null,
    acting: ActingUser,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === acting.id) throw new BadRequestException('Cannot change your own access profile');
    if (targetUser.role === UserRole.OWNER) throw new ForbiddenException('Cannot change an OWNER account');

    let data: any;
    if (profileId === null) {
      // Falling back to bare-role access: the target's role stays as-is
      this.assertGrantWithin(acting, { role: targetUser.role, scopes: null });
      data = { accessProfileId: null };
    } else {
      const profile = await this.prisma.accessProfile.findFirst({ where: { id: profileId, tenantId } });
      if (!profile) throw new NotFoundException('Profile not found');
      this.assertGrantWithin(acting, { role: profile.baseRole, scopes: parseModuleScopes(profile.scopes) });
      data = {
        accessProfileId: profile.id,
        role: profile.baseRole,
        moduleScopes: Prisma.DbNull, // the profile is now the source of truth
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, email: true, name: true, role: true, isActive: true,
        moduleScopes: true, accessProfile: { select: { id: true, name: true } },
      },
    });
    invalidateModuleScopes(userId);
    return updated;
  }

  private parseScopesOrThrow(raw: unknown): ModuleScopes | null {
    if (raw === null || raw === undefined) return null;
    const scopes = parseModuleScopes(raw);
    if (!scopes) {
      throw new BadRequestException(
        'Invalid scopes — expected {"mode":"allow"|"deny","modules":["invoices",...]} or null for full access',
      );
    }
    return scopes;
  }

  async toggleActive(tenantId: string, userId: string, isActive: boolean, actingUserId: string) {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === actingUserId) throw new BadRequestException('Cannot deactivate your own account');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }
}
