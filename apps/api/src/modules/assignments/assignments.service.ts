import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { EndAssignmentDto } from './dto/end-assignment.dto';
import { Prisma, AssignmentStatus } from '@prisma/client';
import { InvoiceAutoGenService } from '../invoices/services/invoice-auto-gen.service';
import { LetterGenerationService } from '../letters/services/letter-generation.service';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService,
    private readonly invoiceAutoGen: InvoiceAutoGenService,
    private readonly letterGen: LetterGenerationService,) {}

  async create(tenantId: string, dto: CreateAssignmentDto, userId?: string) {
    // Validate employee + client belong to tenant
    const [employee, client] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: dto.employeeId, tenantId, deletedAt: null },
      }),
      this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId, deletedAt: null },
      }),
    ]);
    if (!employee) throw new NotFoundException('Employee not found in this tenant');
    if (!client) throw new NotFoundException('Client not found in this tenant');

    // Enforce single active assignment per employee
    const activeExisting = await this.prisma.employeeAssignment.findFirst({
      where: { tenantId, employeeId: dto.employeeId, status: 'ACTIVE' },
      include: { client: { select: { name: true } } },
    });
    if (activeExisting) {
      throw new ConflictException(
        `Employee already assigned to "${activeExisting.client.name}". End that assignment first.`,
      );
    }

    const __created = await (this.prisma.employeeAssignment.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        clientId: dto.clientId,
        role: dto.role,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        billingRate: new Prisma.Decimal(dto.billingRate),
        currency: (dto.currency ?? client.currency).toUpperCase(),
        billingCycle: dto.billingCycle ?? 'MONTHLY',
        workSchedule: dto.workSchedule ?? 'FULL_TIME',
        notes: dto.notes,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true },
        },
        client: { select: { id: true, name: true, country: true, currency: true } },
      },
    }));
    // Invoice auto-gen disabled — invoices are generated manually per employee via
    // the "Invoice" button (generate-for-assignment). Do NOT auto-create a per-client draft.
    // Auto-generate a director-signed Service Agreement draft for this client (idempotent, fire-and-forget)
    this.letterGen.autoGenerateClientAgreement(tenantId, dto.clientId, __created.id, userId ?? 'system').catch(() => {});
    return __created;
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      employeeId?: string;
      clientId?: string;
      status?: AssignmentStatus;
    },
  ) {
    const { page = 1, limit = 20, employeeId, clientId, status } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeAssignmentWhereInput = {
      tenantId,
      ...(employeeId && { employeeId }),
      ...(clientId && { clientId }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employeeAssignment.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        include: {
          employee: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true },
          },
          client: { select: { id: true, name: true, country: true, currency: true } },
        },
      }),
      this.prisma.employeeAssignment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const assignment = await this.prisma.employeeAssignment.findFirst({
      where: { id, tenantId },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, designation: true, email: true },
        },
        client: true,
      },
    });
    if (!assignment) throw new NotFoundException(`Assignment #${id} not found`);
    return assignment;
  }

  /**
   * Get current active assignment for a given employee (if any).
   */
  async findActiveForEmployee(tenantId: string, employeeId: string) {
    return this.prisma.employeeAssignment.findFirst({
      where: { tenantId, employeeId, status: 'ACTIVE' },
      include: {
        client: { select: { id: true, name: true, country: true, currency: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAssignmentDto, userId?: string) {
    await this.findOne(tenantId, id);

    const data: any = {
      ...dto,
      updatedBy: userId,
    };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if (dto.billingRate) data.billingRate = new Prisma.Decimal(dto.billingRate);
    if (dto.currency) data.currency = dto.currency.toUpperCase();

    return this.prisma.employeeAssignment.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        client: { select: { id: true, name: true, currency: true } },
      },
    });
  }

  /**
   * End an active assignment.
   */
  async end(tenantId: string, id: string, dto: EndAssignmentDto, userId?: string) {
    const assignment = await this.findOne(tenantId, id);
    if (assignment.status !== 'ACTIVE') {
      throw new ConflictException(`Assignment is already ${assignment.status}`);
    }

    return this.prisma.employeeAssignment.update({
      where: { id },
      data: {
        endDate: new Date(dto.endDate),
        status: dto.status ?? 'COMPLETED',
        notes: dto.notes ?? assignment.notes,
        updatedBy: userId,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.employeeAssignment.delete({ where: { id } });
  }
}
