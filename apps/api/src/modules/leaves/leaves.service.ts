import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CacheService } from '../../common/cache';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { InitBalancesDto } from './dto/init-balances.dto';
import { Prisma } from '@prisma/client';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Leave Types ─────────────────────────────────────

  async createLeaveType(tenantId: string, dto: CreateLeaveTypeDto) {
    const existing = await this.prisma.leaveType.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) throw new ConflictException(`Leave type code "${dto.code}" already exists`);

    this.cache.del(this.cache.key(tenantId, 'leaves', 'types'));
    return this.prisma.leaveType.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        isPaid: dto.isPaid ?? true,
        defaultDays: dto.defaultDays ?? 12,
        carryForward: dto.carryForward ?? false,
        maxCarryDays: dto.maxCarryDays ?? 0,
      },
    });
  }

  async updateLeaveType(tenantId: string, id: string, dto: UpdateLeaveTypeDto) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    this.cache.del(this.cache.key(tenantId, 'leaves', 'types'));
    return this.prisma.leaveType.update({
      where: { id },
      data: dto,
    });
  }

  async getLeaveTypes(tenantId: string) {
    const cacheKey = this.cache.key(tenantId, 'leaves', 'types');
    return this.cache.getOrSet(
      cacheKey,
      () => this.prisma.leaveType.findMany({
        where: { tenantId },
        orderBy: { name: 'asc' },
      }),
      300, // 5 min — leave types are reference data
    );
  }

  // ── Leave Balances ──────────────────────────────────

  /**
   * Initialize balances for one or all active employees for a given year.
   * Creates a balance row per leave type. Skips if already exists.
   */
  async initBalances(tenantId: string, dto: InitBalancesDto) {
    const year = dto.year ?? new Date().getFullYear();

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
    });
    if (leaveTypes.length === 0) {
      throw new BadRequestException('No active leave types found. Create leave types first.');
    }

    const employeeFilter: Prisma.EmployeeWhereInput = {
      tenantId,
      deletedAt: null,
      status: 'ACTIVE',
      ...(dto.employeeId && { id: dto.employeeId }),
    };
    const employees = await this.prisma.employee.findMany({
      where: employeeFilter,
      select: { id: true },
    });

    let created = 0;
    let skipped = 0;

    for (const emp of employees) {
      for (const lt of leaveTypes) {
        const exists = await this.prisma.leaveBalance.findFirst({
          where: { tenantId, employeeId: emp.id, leaveTypeId: lt.id, year },
        });
        if (exists) {
          skipped++;
          continue;
        }

        await this.prisma.leaveBalance.create({
          data: {
            tenantId,
            employeeId: emp.id,
            leaveTypeId: lt.id,
            year,
            entitled: lt.defaultDays,
            used: 0,
            carriedOver: 0,
            adjustment: 0,
          },
        });
        created++;
      }
    }

    return { year, employeesProcessed: employees.length, created, skipped };
  }

  async getBalances(tenantId: string, params: { employeeId?: string; year?: number }) {
    const year = params.year ?? new Date().getFullYear();

    const where: Prisma.LeaveBalanceWhereInput = {
      tenantId,
      year,
      ...(params.employeeId && { employeeId: params.employeeId }),
    };

    const balances = await this.prisma.leaveBalance.findMany({
      where,
      include: {
        leaveType: { select: { name: true, code: true, isPaid: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { leaveType: { name: 'asc' } }],
    });

    return balances.map((b) => {
      const entitled = Number(b.entitled), used = Number(b.used);
      const carriedOver = Number(b.carriedOver), adjustment = Number(b.adjustment);
      return {
        id: b.id,
        employee: b.employee,
        leaveType: b.leaveType,
        year: b.year,
        entitled, used, carriedOver, adjustment,
        available: +(entitled + carriedOver + adjustment - used).toFixed(2),
      };
    });
  }

  async adjustBalance(tenantId: string, id: string, adjustment: number) {
    const bal = await this.prisma.leaveBalance.findFirst({ where: { id, tenantId } });
    if (!bal) throw new NotFoundException('Leave balance not found');
    const updated = await this.prisma.leaveBalance.update({
      where: { id },
      data: { adjustment },
      include: {
        leaveType: { select: { name: true, code: true, isPaid: true } },
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });
    const entitled = Number(updated.entitled), used = Number(updated.used);
    const carriedOver = Number(updated.carriedOver), adj = Number(updated.adjustment);
    return {
      id: updated.id, employee: updated.employee, leaveType: updated.leaveType, year: updated.year,
      entitled, used, carriedOver, adjustment: adj,
      available: +(entitled + carriedOver + adj - used).toFixed(2),
    };
  }

  // ── Annual (calendar-year) leave accrual ──────────────────────
  // Each active employee earns leave per completed month WITHIN the current
  // calendar year (anchored at the later of Jan 1 and their join date), so the
  // Earned Leave balance resets every January rather than accumulating over the
  // whole tenure. Full-time (9h shift) earns 1.0 leave/month; part-time (4.5h)
  // earns 0.5 (rate = shiftHours / 9, capped at 1). The balance is SET (not
  // incremented) each run, so it is idempotent and safe to re-run.

  private monthsCompleted(start: Date, asOf: Date): number {
    let m = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
    if (asOf.getDate() < start.getDate()) m--;
    return Math.max(0, m);
  }

  private async getEarnedLeaveType(tenantId: string) {
    let t = await this.prisma.leaveType.findFirst({
      where: { tenantId, OR: [{ code: 'EARNED' }, { name: 'Earned Leave' }] },
    });
    if (!t) {
      t = await this.prisma.leaveType.create({
        data: { tenantId, name: 'Earned Leave', code: 'EARNED', isPaid: true, defaultDays: 0, carryForward: true, maxCarryDays: 999, isActive: true },
      });
    }
    return t;
  }

  private async getShiftHours(tenantId: string, employeeId: string): Promise<number> {
    const es = await this.prisma.employeeShift.findFirst({
      where: { tenantId, employeeId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
      include: { shiftType: { select: { totalHours: true } } },
    });
    return es?.shiftType ? Number(es.shiftType.totalHours) : 9;
  }

  async accrueClientTenureLeaves(tenantId: string) {
    const earnedType = await this.getEarnedLeaveType(tenantId);
    const now = new Date();
    const year = now.getFullYear();
    // Accrual is anchored to the start of the CURRENT calendar year (leaves are
    // earned per completed month within the year), so an employee's earned leave
    // resets each January and never runs away with total tenure. Anchor = the
    // later of the year-start and the join date.
    const yearStart = new Date(year, 0, 1);
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, joinDate: true, exitDate: true },
    });
    let leavesCredited = 0;
    const details: any[] = [];
    for (const e of employees) {
      if (!e.joinDate) continue;
      const anchor = e.joinDate > yearStart ? e.joinDate : yearStart;
      const asOf = e.exitDate && e.exitDate < now ? e.exitDate : now;
      const completed = this.monthsCompleted(anchor, asOf);
      const shiftHours = await this.getShiftHours(tenantId, e.id);
      const rate = Math.min(1, shiftHours / 9);
      const earned = +(completed * rate).toFixed(2);
      // SET (not increment) so the run is idempotent and safe to re-run: it
      // recomputes this year's earned balance from the anchor every time.
      await this.prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_leaveTypeId_year: { tenantId, employeeId: e.id, leaveTypeId: earnedType.id, year } },
        update: { entitled: earned },
        create: { tenantId, employeeId: e.id, leaveTypeId: earnedType.id, year, entitled: earned },
      });
      await this.prisma.employee.update({ where: { id: e.id }, data: { accruedLeaveMonths: completed } });
      leavesCredited += earned;
      details.push({ employeeId: e.id, monthsThisYear: completed, shiftHours, rate, earned });
    }
    return { tenantId, year, employeesProcessed: employees.length, leavesCredited: +leavesCredited.toFixed(2), details };
  }

  @Cron('0 1 1 * *') // 01:00 on the 1st of every month
  async monthlyAccrualCron() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      try { await this.accrueClientTenureLeaves(t.id); } catch (e) { /* logged by filter */ }
    }
  }

  // ── Leave Requests ──────────────────────────────────

  async applyLeave(tenantId: string, dto: ApplyLeaveDto) {
    // Validate employee
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // Validate leave type
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, tenantId, isActive: true },
    });
    if (!leaveType) throw new NotFoundException('Leave type not found or inactive');

    // Validate dates
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('End date cannot be before start date');

    // Check for overlapping leave requests (non-cancelled, non-rejected)
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });
    if (overlap) {
      throw new ConflictException('Overlapping leave request already exists for this period');
    }

    // Check balance
    const year = start.getFullYear();
    const balance = await this.prisma.leaveBalance.findFirst({
      where: { tenantId, employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year },
    });
    if (balance) {
      const available = Number(balance.entitled) + Number(balance.carriedOver) + Number(balance.adjustment) - Number(balance.used);
      if (dto.days > available) {
        throw new BadRequestException(
          `Insufficient leave balance. Available: ${available} days, Requested: ${dto.days} days`,
        );
      }
    }
    // If no balance row exists, still allow — admin may not have initialized yet

    const request = await this.prisma.leaveRequest.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        days: dto.days,
        reason: dto.reason,
      },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true } },
      },
    });

    // Notify managers about new leave request
    this.notifications.notifyByRole({
      tenantId,
      minRole: 'MANAGER',
      type: 'LEAVE_APPLIED',
      title: 'New Leave Request',
      message: `${request.employee.firstName} ${request.employee.lastName} applied for ${request.leaveType.name} (${dto.days} days)`,
      linkUrl: '/leaves',
      metadata: { leaveRequestId: request.id },
    }).catch(() => {}); // fire-and-forget

    return request;
  }

  async reviewLeave(tenantId: string, id: string, userId: string, dto: ReviewLeaveDto) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Cannot review a request with status "${request.status}"`);
    }

    const data: any = {
      status: dto.status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: dto.reviewNote,
    };

    // If approved, deduct from balance
    if (dto.status === 'APPROVED') {
      const year = request.startDate.getFullYear();
      const balance = await this.prisma.leaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      });
      if (balance) {
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: Number(request.days) } },
        });
      }
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true } },
      },
    });

    // Notify the employee who applied about the decision
    // Find the user linked to this employee (by email match)
    const empRecord = await this.prisma.employee.findFirst({
      where: { id: request.employeeId, tenantId },
      select: { email: true },
    });
    if (empRecord) {
      const empUser = await this.prisma.user.findFirst({
        where: { tenantId, email: empRecord.email, deletedAt: null },
        select: { id: true },
      });
      if (empUser) {
        const type = dto.status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED';
        this.notifications.create({
          tenantId,
          userId: empUser.id,
          type: type as any,
          title: `Leave ${dto.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          message: `Your ${updated.leaveType.name} request (${Number(request.days)} days) has been ${dto.status.toLowerCase()}`,
          linkUrl: '/leaves',
          metadata: { leaveRequestId: id },
        }).catch(() => {});
      }
    }

    return updated;
  }

  async cancelLeave(tenantId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('Leave request not found');
    if (request.status === 'CANCELLED') {
      throw new BadRequestException('Already cancelled');
    }

    // If it was approved, refund balance
    if (request.status === 'APPROVED') {
      const year = request.startDate.getFullYear();
      const balance = await this.prisma.leaveBalance.findFirst({
        where: {
          tenantId,
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      });
      if (balance) {
        await this.prisma.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { decrement: Number(request.days) } },
        });
      }
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true } },
      },
    });
  }

  async getLeaveRequests(
    tenantId: string,
    params: {
      employeeId?: string;
      status?: string;
      year?: number;
      page?: number;
      limit?: number;
    },
  ) {
    const { employeeId, status, year, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
      ...(employeeId && { employeeId }),
      ...(status && { status: status as any }),
      ...(year && {
        startDate: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          leaveType: { select: { name: true, code: true, isPaid: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getLeaveStats(tenantId: string) {
    const year = new Date().getFullYear();

    const [pending, approved, rejected, cancelled] = await Promise.all([
      this.prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'APPROVED',
          startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'REJECTED',
          startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        },
      }),
      this.prisma.leaveRequest.count({
        where: {
          tenantId,
          status: 'CANCELLED',
          startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        },
      }),
    ]);

    // Employees currently on leave today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const onLeaveToday = await this.prisma.leaveRequest.count({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    return { pending, approved, rejected, cancelled, onLeaveToday, year };
  }
}
