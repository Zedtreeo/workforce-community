import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CacheService } from '../../common/cache';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Tenant Settings ────────────────────────────────

  async getTenantSettings(tenantId: string) {
    const cacheKey = this.cache.key(tenantId, 'settings', 'tenant');
    return this.cache.getOrSet(
      cacheKey,
      async () => {
        const tenant = await this.prisma.tenant.findFirst({
          where: { id: tenantId },
          select: {
            id: true, name: true, slug: true, domain: true, logo: true,
            plan: true, currency: true, timezone: true,
            gstNumber: true, panNumber: true, pfNumber: true, esiNumber: true,
            website: true, phone: true, address: true,
            isActive: true, createdAt: true,
            _count: { select: { users: true, employees: true, clients: true } },
          },
        });
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
      },
      300, // 5 min — tenant settings rarely change
    );
  }

  async updateTenantSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    this.cache.del(this.cache.key(tenantId, 'settings', 'tenant'));
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }

  // ── User Management ────────────────────────────────

  async getUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true, image: true,
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async inviteUser(tenantId: string, dto: InviteUserDto) {
    // Check duplicate
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existing) throw new ConflictException('A user with this email already exists in this tenant');

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user + credential account
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        name: dto.name,
        role: dto.role as any,
        emailVerified: true,
        accounts: {
          create: {
            accountId: dto.email,
            providerId: 'credential',
            password: hashedPassword,
          },
        },
      },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true,
      },
    });

    return user;
  }

  async updateUser(tenantId: string, userId: string, dto: UpdateUserDto, currentUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    // Prevent self-demotion from OWNER
    if (userId === currentUserId && user.role === 'OWNER' && dto.role && dto.role !== 'OWNER') {
      throw new ForbiddenException('Cannot demote yourself from OWNER role');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.role && { role: dto.role as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true,
      },
    });
  }

  async deactivateUser(tenantId: string, userId: string, currentUserId: string) {
    if (userId === currentUserId) {
      throw new ForbiddenException('Cannot deactivate yourself');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
