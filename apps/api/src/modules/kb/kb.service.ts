import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateHelpContentDto } from './dto/create-help-content.dto';
import { UpdateHelpContentDto } from './dto/update-help-content.dto';
import { CreateKbArticleDto } from './dto/create-kb-article.dto';
import { UpdateKbArticleDto } from './dto/update-kb-article.dto';
import { Prisma } from '@prisma/client';

/**
 * KB modules a regular employee (below MANAGER) may read. Admin/ops content
 * (clients, invoices, payroll guides, monitoring, …) stays MANAGER+ only.
 */
const EMPLOYEE_KB_MODULES = ['general', 'attendance', 'leaves', 'holidays', 'portal'];
const ROLE_LEVELS: Record<string, number> = {
  OWNER: 50, ADMIN: 40, MANAGER: 30, MEMBER: 20, VIEWER: 10,
};
const isPrivilegedKbReader = (role?: string) => (ROLE_LEVELS[role ?? ''] || 0) >= ROLE_LEVELS.MANAGER;

@Injectable()
export class KbService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Help Content (Field Tooltips) ───────────────────────────

  async createHelpContent(tenantId: string, dto: CreateHelpContentDto) {
    const existing = await this.prisma.helpContent.findUnique({
      where: { tenantId_key: { tenantId, key: dto.key } },
    });
    if (existing) {
      throw new ConflictException(`Help content key "${dto.key}" already exists`);
    }

    return this.prisma.helpContent.create({
      data: { ...dto, tenantId },
    });
  }

  async findAllHelpContent(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; module?: string },
    role?: string,
  ) {
    const { page = 1, limit = 50, search, module: mod } = params;
    const skip = (page - 1) * limit;
    const privileged = isPrivilegedKbReader(role);

    const where: Prisma.HelpContentWhereInput = {
      tenantId,
      isActive: true,
      ...(privileged
        ? (mod ? { module: mod } : {})
        : { module: mod && EMPLOYEE_KB_MODULES.includes(mod) ? mod : { in: EMPLOYEE_KB_MODULES } }),
      ...(search && {
        OR: [
          { key: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.helpContent.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: [{ module: 'asc' }, { fieldName: 'asc' }],
      }),
      this.prisma.helpContent.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findHelpContentByKey(tenantId: string, key: string) {
    const item = await this.prisma.helpContent.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!item) {
      throw new NotFoundException(`Help content "${key}" not found`);
    }
    return item;
  }

  async findHelpContentByModule(tenantId: string, module: string, role?: string) {
    if (!isPrivilegedKbReader(role) && !EMPLOYEE_KB_MODULES.includes(module)) return [];
    return this.prisma.helpContent.findMany({
      where: { tenantId, module, isActive: true },
      orderBy: { fieldName: 'asc' },
    });
  }

  async updateHelpContent(tenantId: string, id: string, dto: UpdateHelpContentDto) {
    const existing = await this.prisma.helpContent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Help content #${id} not found`);
    }

    if (dto.key && dto.key !== existing.key) {
      const conflict = await this.prisma.helpContent.findUnique({
        where: { tenantId_key: { tenantId, key: dto.key } },
      });
      if (conflict) {
        throw new ConflictException(`Help content key "${dto.key}" already exists`);
      }
    }

    return this.prisma.helpContent.update({
      where: { id },
      data: dto,
    });
  }

  async removeHelpContent(tenantId: string, id: string) {
    const existing = await this.prisma.helpContent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Help content #${id} not found`);
    }
    return this.prisma.helpContent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─── KB Articles ─────────────────────────────────────────────

  async createArticle(tenantId: string, dto: CreateKbArticleDto) {
    const existing = await this.prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`Article slug "${dto.slug}" already exists`);
    }

    return this.prisma.kbArticle.create({
      data: { ...dto, tenantId },
    });
  }

  async findAllArticles(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      module?: string;
      category?: string;
      published?: boolean;
    },
    role?: string,
  ) {
    const { page = 1, limit = 20, search, module: mod, category, published } = params;
    const skip = (page - 1) * limit;
    const privileged = isPrivilegedKbReader(role);

    const where: Prisma.KbArticleWhereInput = {
      tenantId,
      deletedAt: null,
      ...(category && { category: category as any }),
      // Employees see only published, employee-relevant modules
      ...(privileged
        ? {
            ...(mod && { module: mod }),
            ...(published !== undefined && { isPublished: published }),
          }
        : {
            module: mod && EMPLOYEE_KB_MODULES.includes(mod) ? mod : { in: EMPLOYEE_KB_MODULES },
            isPublished: true,
          }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } },
          { tags: { has: search.toLowerCase() } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          module: true,
          category: true,
          tags: true,
          isPublished: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findArticleBySlug(tenantId: string, slug: string, role?: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
    });
    if (!article || article.deletedAt) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }
    if (!isPrivilegedKbReader(role) &&
        (!article.isPublished || !EMPLOYEE_KB_MODULES.includes(article.module))) {
      throw new NotFoundException(`Article "${slug}" not found`);
    }

    // Increment view count (fire and forget)
    this.prisma.kbArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    return article;
  }

  async findArticleById(tenantId: string, id: string, role?: string) {
    const article = await this.prisma.kbArticle.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException(`Article #${id} not found`);
    }
    if (!isPrivilegedKbReader(role) &&
        (!article.isPublished || !EMPLOYEE_KB_MODULES.includes(article.module))) {
      throw new NotFoundException(`Article #${id} not found`);
    }
    return article;
  }

  async updateArticle(tenantId: string, id: string, dto: UpdateKbArticleDto) {
    const existing = await this.findArticleById(tenantId, id);

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.kbArticle.findUnique({
        where: { tenantId_slug: { tenantId, slug: dto.slug } },
      });
      if (conflict) {
        throw new ConflictException(`Article slug "${dto.slug}" already exists`);
      }
    }

    return this.prisma.kbArticle.update({
      where: { id },
      data: dto,
    });
  }

  async removeArticle(tenantId: string, id: string) {
    await this.findArticleById(tenantId, id);
    return this.prisma.kbArticle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Search (unified across help content + articles) ─────────

  async search(tenantId: string, query: string, limit = 10, role?: string) {
    if (!query || query.length < 2) return { helpContent: [], articles: [] };
    const privileged = isPrivilegedKbReader(role);
    const moduleFilter = privileged ? {} : { module: { in: EMPLOYEE_KB_MODULES } };

    const [helpContent, articles] = await Promise.all([
      this.prisma.helpContent.findMany({
        where: {
          tenantId,
          isActive: true,
          ...moduleFilter,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { key: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { module: 'asc' },
      }),
      this.prisma.kbArticle.findMany({
        where: {
          tenantId,
          isPublished: true,
          deletedAt: null,
          ...moduleFilter,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
            { tags: { has: query.toLowerCase() } },
          ],
        },
        take: limit,
        orderBy: { viewCount: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          module: true,
          category: true,
          tags: true,
        },
      }),
    ]);

    return { helpContent, articles };
  }
}
