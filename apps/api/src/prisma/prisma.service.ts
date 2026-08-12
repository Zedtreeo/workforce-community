import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    const isProduction = config.get('NODE_ENV') === 'production';

    super({
      log: isProduction
        ? [
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ],
      datasources: {
        db: {
          url: config.get<string>('DATABASE_URL'),
        },
      },
    });

    // ── Query logging (dev only) ──────────────────────────────
    if (!isProduction) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;
      (this as any).$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          // Slow query warning — anything over 100 ms
          self.logger.warn({
            query: e.query,
            params: e.params,
            duration: `${e.duration}ms`,
            message: 'Slow query detected',
          });
        } else {
          self.logger.debug({
            query: e.query,
            duration: `${e.duration}ms`,
          });
        }
      });
    }

    // Error/warn logging in all environments
    (this as any).$on('error', (e: Prisma.LogEvent) => {
      this.logger.error({ message: e.message, target: e.target });
    });

    (this as any).$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn({ message: e.message, target: e.target });
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    this.logger.log('Closing database connection...');
    await this.$disconnect();
  }

  /**
   * Soft-delete aware query helper.
   * Appends `deletedAt: null` to the where clause unless `includeDeleted` is true.
   *
   * Usage:
   *   this.prisma.employee.findMany({
   *     where: this.prisma.excludeDeleted({ tenantId, status: 'ACTIVE' }),
   *   });
   */
  excludeDeleted<T extends Record<string, unknown>>(
    where: T,
    includeDeleted = false,
  ): T & { deletedAt?: null } {
    if (includeDeleted) return where;
    return { ...where, deletedAt: null };
  }

  /**
   * Paginated query helper — eliminates boilerplate across all services.
   *
   * Returns { data, meta: { total, page, limit, totalPages } }
   *
   * Usage:
   *   return this.prisma.paginate(this.prisma.employee, {
   *     where: { tenantId, deletedAt: null },
   *     orderBy: { createdAt: 'desc' },
   *     include: { department: true },
   *   }, { page: 1, limit: 20 });
   */
  async paginate<T>(
    model: {
      findMany: (args: any) => Promise<T[]>;
      count: (args: any) => Promise<number>;
    },
    args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, unknown> | Record<string, unknown>[];
      include?: Record<string, unknown>;
      select?: Record<string, unknown>;
    },
    pagination: { page?: number; limit?: number } = {},
  ): Promise<{
    data: T[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      model.findMany({
        ...args,
        skip,
        take: limit,
      }),
      model.count({ where: args.where }),
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
}
