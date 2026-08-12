import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    changes?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.auditLog.create({ data: params }).catch(() => {});
  }

  async getLogs(tenantId: string, params: {
    entity?: string;
    userId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (params.entity) where.entity = params.entity;
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Bulk Employee Import ──

  async bulkImportEmployees(tenantId: string, rows: Array<{
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    designation?: string;
    departmentCode?: string;
    joinDate: string;
    salary: number;
  }>, userId: string) {
    const results = { created: 0, skipped: 0, errors: [] as string[] };

    // Pre-load departments for code lookup
    const departments = await this.prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, code: true },
    });
    const deptMap = new Map(departments.map((d) => [d.code, d.id]));

    for (const row of rows) {
      try {
        // Check duplicate
        const existing = await this.prisma.employee.findFirst({
          where: { tenantId, employeeCode: row.employeeCode, deletedAt: null },
        });
        if (existing) {
          results.skipped++;
          continue;
        }

        const departmentId = row.departmentCode ? deptMap.get(row.departmentCode) : null;

        await this.prisma.employee.create({
          data: {
            tenantId,
            employeeCode: row.employeeCode,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone || null,
            designation: row.designation || null,
            departmentId: departmentId || null,
            joinDate: new Date(row.joinDate),
            salary: row.salary,
            createdBy: userId,
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`${row.employeeCode}: ${e.message}`);
      }
    }

    // Log the bulk import
    await this.log({
      tenantId,
      userId,
      action: 'IMPORT',
      entity: 'Employee',
      changes: { created: results.created, skipped: results.skipped, errors: results.errors.length },
    });

    return results;
  }

  // ── Bulk Employee Export ──

  async exportEmployees(tenantId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      include: { department: { select: { name: true, code: true } } },
      orderBy: { employeeCode: 'asc' },
    });

    return employees.map((e) => ({
      employeeCode: e.employeeCode,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone || '',
      designation: e.designation || '',
      department: e.department?.name || '',
      departmentCode: e.department?.code || '',
      joinDate: e.joinDate.toISOString().split('T')[0],
      salary: Number(e.salary),
      status: e.status,
      pfNumber: e.pfNumber || '',
      esiNumber: e.esiNumber || '',
      panNumber: e.panNumber || '',
      bankAccount: e.bankAccount || '',
      bankIfsc: e.bankIfsc || '',
    }));
  }
}
