import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(`Client with email "${dto.email}" already exists`);
    }

    return this.prisma.client.create({
      data: {
        ...dto,
        tenantId,
        country: dto.country.toUpperCase(),
        currency: dto.currency?.toUpperCase() ?? 'USD',
      },
    });
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string; isActive?: boolean },
  ) {
    const { page = 1, limit = 20, search, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ClientWhereInput = {
      tenantId,
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { country: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          billingEntity: { select: { id: true, name: true, invoicePrefix: true } },
          _count: {
            select: {
              assignments: { where: { status: 'ACTIVE' } },
            },
          },
        },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: { startDate: 'desc' },
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                status: true,
              },
            },
          },
        },
        billingEntity: { select: { id: true, name: true, invoicePrefix: true } },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client #${id} not found`);
    }
    return client;
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(tenantId, id);

    if (dto.email) {
      const existing = await this.prisma.client.findFirst({
        where: { tenantId, email: dto.email, id: { not: id }, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(`Another client already uses "${dto.email}"`);
      }
    }

    const data: any = { ...dto };
    if (dto.country) data.country = dto.country.toUpperCase();
    if (dto.currency) data.currency = dto.currency.toUpperCase();

    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    // Check for active assignments
    const activeCount = await this.prisma.employeeAssignment.count({
      where: { tenantId, clientId: id, status: 'ACTIVE' },
    });
    if (activeCount > 0) {
      throw new ConflictException(
        `Cannot delete client — ${activeCount} active employee assignment(s). End them first.`,
      );
    }

    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
