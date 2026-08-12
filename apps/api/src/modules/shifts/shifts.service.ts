import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shift Types CRUD ──────────────────────────────

  async getShiftTypes(tenantId: string) {
    return this.prisma.shiftType.findMany({
      where: { tenantId },
      include: { _count: { select: { assignments: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getShiftType(tenantId: string, id: string) {
    const shift = await this.prisma.shiftType.findFirst({
      where: { id, tenantId },
      include: {
        assignments: {
          where: { isActive: true },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
            },
          },
        },
      },
    });
    if (!shift) throw new NotFoundException('Shift type not found');
    return shift;
  }

  async createShiftType(tenantId: string, dto: {
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    lunchBreakMinutes?: number;
    totalHours?: number;
    workingHours?: number;
    graceMinutes?: number;
    description?: string;
    isDefault?: boolean;
  }) {
    // Check duplicate code
    const existing = await this.prisma.shiftType.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Shift code "${dto.code}" already exists`);

    const lunchBreak = dto.lunchBreakMinutes ?? 60;
    const totalHours = dto.totalHours ?? 9;
    const workingHours = dto.workingHours ?? (totalHours - lunchBreak / 60);

    // If setting as default, unset others
    if (dto.isDefault) {
      await this.prisma.shiftType.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.shiftType.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        startTime: dto.startTime,
        endTime: dto.endTime,
        lunchBreakMinutes: lunchBreak,
        totalHours,
        workingHours,
        graceMinutes: dto.graceMinutes ?? 15,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateShiftType(tenantId: string, id: string, dto: {
    name?: string;
    startTime?: string;
    endTime?: string;
    lunchBreakMinutes?: number;
    totalHours?: number;
    workingHours?: number;
    graceMinutes?: number;
    description?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    const shift = await this.prisma.shiftType.findFirst({ where: { id, tenantId } });
    if (!shift) throw new NotFoundException('Shift type not found');

    if (dto.isDefault) {
      await this.prisma.shiftType.updateMany({
        where: { tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Recalculate working hours if lunch or total changed
    const totalHours = dto.totalHours ?? Number(shift.totalHours);
    const lunchBreak = dto.lunchBreakMinutes ?? shift.lunchBreakMinutes;
    const workingHours = dto.workingHours ?? (totalHours - lunchBreak / 60);

    return this.prisma.shiftType.update({
      where: { id },
      data: {
        ...dto,
        totalHours,
        workingHours,
        lunchBreakMinutes: lunchBreak,
      },
    });
  }

  async deleteShiftType(tenantId: string, id: string) {
    const shift = await this.prisma.shiftType.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { assignments: { where: { isActive: true } } } } },
    });
    if (!shift) throw new NotFoundException('Shift type not found');
    if (shift._count.assignments > 0) {
      throw new BadRequestException(`Cannot delete: ${shift._count.assignments} active employee assignments exist`);
    }

    return this.prisma.shiftType.delete({ where: { id } });
  }

  // ── Employee Shift Assignments ────────────────────

  async assignShift(tenantId: string, dto: {
    employeeId: string;
    shiftTypeId: string;
    effectiveFrom: string;
    effectiveTo?: string;
  }) {
    // Validate employee
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Validate shift
    const shift = await this.prisma.shiftType.findFirst({
      where: { id: dto.shiftTypeId, tenantId, isActive: true },
    });
    if (!shift) throw new NotFoundException('Shift type not found or inactive');

    // Deactivate existing active assignment
    await this.prisma.employeeShift.updateMany({
      where: { tenantId, employeeId: dto.employeeId, isActive: true },
      data: { isActive: false, effectiveTo: new Date(dto.effectiveFrom) },
    });

    return this.prisma.employeeShift.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        shiftTypeId: dto.shiftTypeId,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        shiftType: { select: { name: true, code: true, startTime: true, endTime: true } },
      },
    });
  }

  async bulkAssignShift(tenantId: string, dto: {
    employeeIds: string[];
    shiftTypeId: string;
    effectiveFrom: string;
  }) {
    const shift = await this.prisma.shiftType.findFirst({
      where: { id: dto.shiftTypeId, tenantId, isActive: true },
    });
    if (!shift) throw new NotFoundException('Shift type not found');

    const results: any[] = [];
    for (const employeeId of dto.employeeIds) {
      try {
        const result = await this.assignShift(tenantId, {
          employeeId,
          shiftTypeId: dto.shiftTypeId,
          effectiveFrom: dto.effectiveFrom,
        });
        results.push(result);
      } catch (e) {
        results.push({ employeeId, error: (e as Error).message });
      }
    }
    return { assigned: results.filter((r) => !r.error).length, failed: results.filter((r) => r.error).length, results };
  }

  async getEmployeeShift(tenantId: string, employeeId: string) {
    return this.prisma.employeeShift.findFirst({
      where: { tenantId, employeeId, isActive: true },
      include: {
        shiftType: true,
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
    });
  }

  async getEmployeeShiftHistory(tenantId: string, employeeId: string) {
    return this.prisma.employeeShift.findMany({
      where: { tenantId, employeeId },
      include: { shiftType: { select: { name: true, code: true, startTime: true, endTime: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
