import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class ProfileChangesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { status?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.status) {
      where.status = params.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.profileChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
            },
          },
        },
      }),
      this.prisma.profileChangeRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const request = await this.prisma.profileChangeRequest.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            phone: true,
            designation: true,
            pfNumber: true,
            esiNumber: true,
            panNumber: true,
            bankAccount: true,
            bankIfsc: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Change request not found');
    }

    return request;
  }

  async approve(tenantId: string, id: string, reviewerId: string, comment?: string) {
    const request = await this.prisma.profileChangeRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!request) {
      throw new NotFoundException('Pending change request not found');
    }

    const changes = request.changes as Record<string, { old: any; new: any }>;

    // Build the update data from the approved changes
    const updateData: Record<string, any> = {};
    for (const [field, value] of Object.entries(changes)) {
      updateData[field] = value.new;
    }

    // Apply changes to employee and update request status in a transaction
    await this.prisma.$transaction([
      this.prisma.employee.update({
        where: { id: request.employeeId },
        data: updateData,
      }),
      this.prisma.profileChangeRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewComment: comment || null,
        },
      }),
    ]);

    return { message: 'Profile changes approved and applied' };
  }

  async reject(tenantId: string, id: string, reviewerId: string, comment?: string) {
    const request = await this.prisma.profileChangeRequest.findFirst({
      where: { id, tenantId, status: 'PENDING' },
    });

    if (!request) {
      throw new NotFoundException('Pending change request not found');
    }

    await this.prisma.profileChangeRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment || null,
      },
    });

    return { message: 'Profile change request rejected' };
  }

  async getPendingCount(tenantId: string) {
    const count = await this.prisma.profileChangeRequest.count({
      where: { tenantId, status: 'PENDING' },
    });
    return { count };
  }
}

