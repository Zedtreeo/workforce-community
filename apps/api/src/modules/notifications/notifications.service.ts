import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a notification for a specific user.
   */
  async create(params: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    linkUrl?: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl,
        metadata: params.metadata,
      },
    });
  }

  /**
   * Notify all users with a given minimum role level in the tenant.
   */
  async notifyByRole(params: {
    tenantId: string;
    minRole: string;
    type: NotificationType;
    title: string;
    message: string;
    linkUrl?: string;
    metadata?: any;
    excludeUserId?: string;
  }) {
    const ROLE_LEVELS: Record<string, number> = {
      OWNER: 50, ADMIN: 40, MANAGER: 30, MEMBER: 20, VIEWER: 10,
    };
    const minLevel = ROLE_LEVELS[params.minRole] || 0;

    const eligibleRoles = Object.entries(ROLE_LEVELS)
      .filter(([, level]) => level >= minLevel)
      .map(([role]) => role);

    const users = await this.prisma.user.findMany({
      where: {
        tenantId: params.tenantId,
        role: { in: eligibleRoles as any },
        isActive: true,
        deletedAt: null,
        ...(params.excludeUserId && { id: { not: params.excludeUserId } }),
      },
      select: { id: true },
    });

    if (users.length === 0) return [];

    return this.prisma.notification.createMany({
      data: users.map((u) => ({
        tenantId: params.tenantId,
        userId: u.id,
        type: params.type,
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl,
        metadata: params.metadata,
      })),
    });
  }

  /**
   * Get notifications for a user (paginated).
   */
  async getForUser(
    tenantId: string,
    userId: string,
    params: { page?: number; limit?: number; unreadOnly?: boolean },
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = params;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { tenantId, userId, isRead: false },
      }),
    ]);

    return {
      data,
      unreadCount,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(tenantId: string, userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(tenantId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Get unread count for header badge.
   */
  async getUnreadCount(tenantId: string, userId: string) {
    const count = await this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
    return { unreadCount: count };
  }
}
