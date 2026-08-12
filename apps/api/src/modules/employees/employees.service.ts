import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Prisma, EmployeeStatus } from '@prisma/client';
import { scrypt, randomBytes } from 'node:crypto';
import { EmailService } from '../email/email.service';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService, private readonly emailService: EmailService) {}

  async approve(tenantId: string, id: string, approverId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!emp) throw new NotFoundException('Employee not found');

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        approvalStatus: 'APPROVED' as any,
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectedAt: null,
        rejectedReason: null,
      },
    });

    // Fire-and-forget notification
    const baseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    this.emailService.send({
      to: emp.email,
      subject: 'Your application has been approved — welcome aboard',
      html: `<p>Hi ${emp.firstName},</p>
        <p>Your onboarding application has been approved. You can now log in to the employee portal:</p>
        <p><a href="${baseUrl}/login">Open Employee Portal</a></p>
        <p>Welcome to the team!</p>`,
    }).catch(() => {});

    return updated;
  }

  async reject(tenantId: string, id: string, reason: string, approverId: string) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Rejection reason must be at least 5 characters');
    }
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!emp) throw new NotFoundException('Employee not found');

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        approvalStatus: 'REJECTED' as any,
        rejectedAt: new Date(),
        rejectedReason: reason,
        approvedBy: approverId,
      },
    });

    this.emailService.send({
      to: emp.email,
      subject: 'Update on your onboarding application',
      html: `<p>Hi ${emp.firstName},</p>
        <p>Unfortunately your onboarding application could not be approved at this time. Reason:</p>
        <blockquote>${reason}</blockquote>
        <p>If you believe this is in error, please reply to this email.</p>`,
    }).catch(() => {});

    return updated;
  }


  async create(tenantId: string, dto: CreateEmployeeDto, userId?: string) {
    // Check employee code uniqueness within tenant
    const existing = await this.prisma.employee.findUnique({
      where: {
        tenantId_employeeCode: { tenantId, employeeCode: dto.employeeCode },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Employee code "${dto.employeeCode}" already exists in this tenant`,
      );
    }

    const { grantPortalAccess: shouldGrantAccess, ...employeeData } = dto;

    const employee = await this.prisma.employee.create({
      data: {
        ...employeeData,
        tenantId,
        joinDate: new Date(dto.joinDate),
        salary: new Prisma.Decimal(dto.salary),
        createdBy: userId,
        updatedBy: userId,
      },
      include: { department: true },
    });

    let portalAccessGranted = false;
    if (shouldGrantAccess) {
      try {
        await this.grantPortalAccess(tenantId, employee.id);
        portalAccessGranted = true;
      } catch {
        // Employee creation still succeeds even if invite fails
        portalAccessGranted = false;
      }
    }

    return { ...employee, portalAccessGranted };
  }

  async findAll(
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      status?: EmployeeStatus;
      departmentId?: string;
    },
  ) {
    const { page = 1, limit = 20, search, status, departmentId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      tenantId,
      deletedAt: null,
      ...(status && { status }),
      ...(departmentId && { departmentId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          shifts: {
            where: { isActive: true },
            take: 1,
            orderBy: { effectiveFrom: 'desc' },
            include: { shiftType: { select: { id: true, name: true, code: true, startTime: true, endTime: true } } },
          },
          payStructureAssignments: {
            where: { isActive: true },
            take: 1,
            orderBy: { effectiveFrom: 'desc' },
            include: { template: { select: { id: true, name: true } } },
          },
        },
      }),
      this.prisma.employee.count({ where }),
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

  async findOne(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: true,
        tenant: { select: { name: true, currency: true } },
        reportingManager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        shifts: {
          where: { isActive: true },
          take: 1,
          orderBy: { effectiveFrom: 'desc' },
          include: { shiftType: { select: { id: true, name: true, code: true, startTime: true, endTime: true } } },
        },
        payStructureAssignments: {
          where: { isActive: true },
          take: 1,
          orderBy: { effectiveFrom: 'desc' },
          include: { template: { select: { id: true, name: true } } },
        },
      },
    });
    if (!employee) {
      throw new NotFoundException(`Employee #${id} not found`);
    }
    return employee;
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto, userId?: string) {
    await this.findOne(tenantId, id);

    const data: any = {
      ...dto,
      updatedBy: userId,
    };
    if (dto.joinDate) data.joinDate = new Date(dto.joinDate);
    if (dto.salary) data.salary = new Prisma.Decimal(dto.salary);

    return this.prisma.employee.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async remove(tenantId: string, id: string, userId?: string) {
    await this.findOne(tenantId, id);
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
  }

  async restore(tenantId: string, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: { not: null } },
    });
    if (!employee) {
      throw new NotFoundException(`Deleted employee #${id} not found`);
    }
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async grantPortalAccess(tenantId: string, employeeId: string) {
    const employee = await this.findOne(tenantId, employeeId);

    // Login is passwordless email-OTP, so enabling portal access just means the
    // employee has a (non-deleted) user row whose email matches their record —
    // they then sign in with a one-time code. No password, no setup email.
    // A previously-revoked (soft-deleted) row is reactivated rather than
    // re-created (the User @@unique([tenantId, email]) still holds the slot).
    const revoked = await this.prisma.user.findFirst({
      where: { tenantId, email: employee.email, deletedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (revoked) {
      const user = await this.prisma.user.update({
        where: { id: revoked.id },
        data: { deletedAt: null },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
      return { user, enabled: true, message: 'Portal access re-enabled. The employee signs in with an email one-time code.' };
    }

    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: employee.email, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (existing) {
      return { user: existing, enabled: true, message: 'Portal access is already enabled.' };
    }

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: employee.email,
        name: `${employee.firstName} ${employee.lastName}`,
        role: 'MEMBER',
        emailVerified: true,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return { user, enabled: true, message: 'Portal access enabled. The employee signs in with an email one-time code — no password needed.' };
  }

  /** Disable portal login for an employee — soft-deletes the user row and drops
   *  active sessions so the change takes effect immediately. Reversible via
   *  grantPortalAccess (which reactivates the same row). */
  async revokePortalAccess(tenantId: string, employeeId: string) {
    const employee = await this.findOne(tenantId, employeeId);
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email: employee.email, deletedAt: null },
    });
    if (!user) return { enabled: false, message: 'Portal access is already disabled.' };

    await this.prisma.session.deleteMany({ where: { userId: user.id } });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    return { enabled: false, message: 'Portal access disabled. The employee can no longer sign in.' };
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /** Hash password using scrypt — same format as Better Auth (salt:key) */
  private hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const salt = randomBytes(16).toString('hex');
      scrypt(
        password.normalize('NFKC'),
        salt,
        64,
        { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
        (err, key) => {
          if (err) reject(err);
          else resolve(`${salt}:${key.toString('hex')}`);
        },
      );
    });
  }


  async hasPortalAccess(tenantId: string, employeeId: string): Promise<boolean> {
    const employee = await this.findOne(tenantId, employeeId);
    const user = await this.prisma.user.findFirst({
      where: { tenantId, email: employee.email, deletedAt: null },
    });
    return !!user;
  }

  async getStats(tenantId: string) {
    const [total, active, inactive, terminated] = await Promise.all([
      this.prisma.employee.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.employee.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { tenantId, deletedAt: null, status: 'INACTIVE' } }),
      this.prisma.employee.count({ where: { tenantId, deletedAt: null, status: 'TERMINATED' } }),
    ]);
    return { total, active, inactive, terminated };
  }

  /** Distinct, non-empty designations across employees + offer letters (for create-or-select). */
  async getDesignations(tenantId: string): Promise<string[]> {
    const [emps, offers] = await Promise.all([
      this.prisma.employee.findMany({
        where: { tenantId, designation: { not: null } },
        select: { designation: true }, distinct: ['designation'],
      }),
      this.prisma.offerLetter.findMany({
        where: { tenantId }, select: { designation: true }, distinct: ['designation'],
      }),
    ]);
    const set = new Set<string>();
    for (const e of emps) if (e.designation?.trim()) set.add(e.designation.trim());
    for (const o of offers) if (o.designation?.trim()) set.add(o.designation.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }
}
