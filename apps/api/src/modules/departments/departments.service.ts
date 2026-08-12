import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Department code "${dto.code}" already exists in this tenant`);
    }

    return this.prisma.department.create({
      data: { ...dto, tenantId },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findAll(
    tenantId: string,
    params: { page?: number; limit?: number; search?: string },
  ) {
    const { page = 1, limit = 50, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.DepartmentWhereInput = {
      tenantId,
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { name: 'asc' },
        include: { _count: { select: { employees: true } } },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        _count: { select: { employees: true } },
        employees: {
          where: { deletedAt: null },
          take: 10,
          orderBy: { firstName: 'asc' },
          select: { id: true, firstName: true, lastName: true, designation: true, status: true },
        },
      },
    });
    if (!dept) {
      throw new NotFoundException(`Department #${id} not found`);
    }
    return dept;
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(tenantId, id);

    if (dto.code) {
      const existing = await this.prisma.department.findFirst({
        where: { tenantId, code: dto.code, id: { not: id }, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException(`Department code "${dto.code}" already exists`);
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: { _count: { select: { employees: true } } },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
