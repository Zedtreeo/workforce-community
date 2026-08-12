import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CacheService } from '../../common/cache';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { AssignShiftDto } from './dto/assign-shift.dto';

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ── Holidays ──

  async getHolidays(tenantId: string, params: { year?: number }) {
    const year = params.year ?? new Date().getFullYear();
    const cacheKey = this.cache.key(tenantId, 'holidays', String(year));
    return this.cache.getOrSet(
      cacheKey,
      () => this.prisma.holiday.findMany({
        where: { tenantId, year },
        orderBy: { date: 'asc' },
      }),
      300, // 5 min — holidays rarely change
    );
  }

  async createHoliday(tenantId: string, dto: CreateHolidayDto) {
    this.cache.del(this.cache.key(tenantId, 'holidays', String(dto.year)));
    return this.prisma.holiday.create({
      data: {
        tenantId,
        name: dto.name,
        date: new Date(dto.date),
        isOptional: dto.isOptional ?? false,
        year: dto.year,
      },
    });
  }

  async deleteHoliday(tenantId: string, id: string) {
    const holiday = await this.prisma.holiday.findFirst({ where: { id, tenantId } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    this.cache.del(this.cache.key(tenantId, 'holidays', String(holiday.year)));
    return this.prisma.holiday.delete({ where: { id } });
  }

  // ── Shift Types ──

  async getShiftTypes(tenantId: string) {
    const cacheKey = this.cache.key(tenantId, 'shifts', 'types');
    return this.cache.getOrSet(
      cacheKey,
      () => this.prisma.shiftType.findMany({
        where: { tenantId, isActive: true },
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: 'asc' },
      }),
      300,
    );
  }

  async createShiftType(tenantId: string, dto: CreateShiftDto) {
    this.cache.del(this.cache.key(tenantId, 'shifts', 'types'));
    return this.prisma.shiftType.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        startTime: dto.startTime,
        endTime: dto.endTime,
        graceMinutes: dto.graceMinutes ?? 15,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  // ── Employee Shifts ──

  async getEmployeeShifts(tenantId: string, params: { employeeId?: string }) {
    return this.prisma.employeeShift.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(params.employeeId && { employeeId: params.employeeId }),
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        shiftType: { select: { name: true, code: true, startTime: true, endTime: true } },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async assignShift(tenantId: string, dto: AssignShiftDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Deactivate existing active shift
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
}
