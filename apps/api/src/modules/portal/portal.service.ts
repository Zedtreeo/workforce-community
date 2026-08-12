import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { LeavesService } from '../leaves/leaves.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PortalApplyLeaveDto, AttendanceCorrectionDto } from './portal.dto';
import { istDayBoundsUTC, todayIST } from '../../common/utils/ist-date';
import { AutoClockoutService, MAX_SHIFT_HOURS, MAX_SHIFT_MS } from '../attendance/auto-clockout.service';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leavesService: LeavesService,
    private readonly notificationsService: NotificationsService,
    private readonly autoClockout: AutoClockoutService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Find the employee record linked to the current user (by email match).
   */
  async getMyEmployee(tenantId: string, userEmail: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, email: userEmail, deletedAt: null },
      include: {
        department: { select: { name: true } },
        assignments: {
          where: { status: 'ACTIVE' },
          include: { client: { select: { name: true, country: true } } },
          take: 1,
        },
      },
    });
    if (!employee) return null;
    return employee;
  }

  /**
   * Employee dashboard — today's snapshot.
   */
  async getMyDashboard(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) return { linked: false };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    const [todayAttendance, activeTimeLog, leaveBalances, pendingLeaves, recentTimeLogs] = await Promise.all([
      this.prisma.attendance.findFirst({
        where: { tenantId, employeeId: employee.id, date: today },
      }),
      this.prisma.timeLog.findFirst({
        where: { tenantId, employeeId: employee.id, clockOut: null },
      }),
      this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId: employee.id, year },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
      this.prisma.leaveRequest.count({
        where: { tenantId, employeeId: employee.id, status: 'PENDING' },
      }),
      this.prisma.timeLog.findMany({
        where: { tenantId, employeeId: employee.id },
        orderBy: { clockIn: 'desc' },
        take: 5,
      }),
    ]);

    return {
      linked: true,
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        designation: employee.designation,
        department: employee.department?.name,
        joinDate: employee.joinDate,
        status: employee.status,
      },
      currentAssignment: employee.assignments[0] ? {
        clientName: employee.assignments[0].client.name,
        clientCountry: employee.assignments[0].client.country,
        role: employee.assignments[0].role,
        startDate: employee.assignments[0].startDate,
      } : null,
      today: {
        attendance: todayAttendance?.status || 'NOT_MARKED',
        isClockedIn: !!activeTimeLog,
        clockInTime: activeTimeLog?.clockIn || null,
      },
      leaveBalances: leaveBalances.map((b) => ({
        type: b.leaveType.name,
        code: b.leaveType.code,
        entitled: Number(b.entitled),
        used: Number(b.used),
        available: Number(b.entitled) + Number(b.carriedOver) + Number(b.adjustment) - Number(b.used),
      })),
      pendingLeaves,
      recentTimeLogs: recentTimeLogs.map((tl) => ({
        date: tl.date,
        clockIn: tl.clockIn,
        clockOut: tl.clockOut,
        duration: tl.duration,
      })),
    };
  }

  /**
   * My attendance history.
   */
  async getMyAttendance(tenantId: string, userEmail: string, params: { month?: number; year?: number }) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const year = params.year ?? new Date().getFullYear();
    const month = params.month ?? new Date().getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // last day of month

    const records = await this.prisma.attendance.findMany({
      where: {
        tenantId,
        employeeId: employee.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    const summary = {
      present: records.filter((r) => r.status === 'PRESENT').length,
      absent: records.filter((r) => r.status === 'ABSENT').length,
      leave: records.filter((r) => r.status === 'LEAVE').length,
      wfh: records.filter((r) => r.status === 'WFH').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length,
      totalDays: records.length,
    };

    // Date-wise clock-in/out + worked hours from time logs (web clock-in)
    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const { dailyHours, dailySessions, totalHours } =
      await this.attendanceService.getDailyClockStats(tenantId, employee.id, {
        from: `${year}-${mm}-01`,
        to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      });

    return { year, month, records, summary, dailyHours, dailySessions, totalHours };
  }

  /**
   * My leave requests.
   */
  async getMyLeaves(tenantId: string, userEmail: string, params: { year?: number }) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const year = params.year ?? new Date().getFullYear();

    const [requests, balances] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          startDate: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        },
        include: { leaveType: { select: { name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveBalance.findMany({
        where: { tenantId, employeeId: employee.id, year },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
    ]);

    return {
      requests: requests.map((r) => ({
        id: r.id,
        leaveType: r.leaveType.name,
        leaveCode: r.leaveType.code,
        startDate: r.startDate,
        endDate: r.endDate,
        days: Number(r.days),
        reason: r.reason,
        status: r.status,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      })),
      balances: balances.map((b) => ({
        type: b.leaveType.name,
        code: b.leaveType.code,
        entitled: Number(b.entitled),
        used: Number(b.used),
        available: Number(b.entitled) + Number(b.carriedOver) + Number(b.adjustment) - Number(b.used),
      })),
    };
  }

  /**
   * My time logs & monitoring.
   */
  async getMyMonitoring(tenantId: string, userEmail: string, params: { date?: string }) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const dateStr = params.date ?? new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    const nextDate = new Date(dateStr);
    nextDate.setDate(nextDate.getDate() + 1);

    // Only fetch time logs and aggregate active/idle — no screenshots, no activity details
    const [timeLogs, activityAgg] = await Promise.all([
      this.prisma.timeLog.findMany({
        where: { tenantId, employeeId: employee.id, date: targetDate },
        orderBy: { clockIn: 'asc' },
      }),
      this.prisma.activitySnapshot.aggregate({
        where: {
          tenantId,
          employeeId: employee.id,
          capturedAt: { gte: targetDate, lt: nextDate },
        },
        _count: { id: true },
        _avg: { activityPercent: true },
      }),
    ]);

    // Count idle snapshots separately
    const idleCount = await this.prisma.activitySnapshot.count({
      where: {
        tenantId,
        employeeId: employee.id,
        capturedAt: { gte: targetDate, lt: nextDate },
        isIdle: true,
      },
    });

    const totalSnapshots = activityAgg._count.id;
    const activeCount = totalSnapshots - idleCount;

    const totalSeconds = timeLogs.reduce((sum, tl) => {
      if (tl.duration) return sum + tl.duration;
      if (tl.clockOut) return sum + Math.floor((tl.clockOut.getTime() - tl.clockIn.getTime()) / 1000);
      return sum + Math.floor((Date.now() - tl.clockIn.getTime()) / 1000);
    }, 0);

    const totalWorkHours = +(totalSeconds / 3600).toFixed(2);
    const avgActivity = Math.round(activityAgg._avg.activityPercent ?? 0);

    // Derive active vs idle hours from snapshot ratio
    const activeHours = totalSnapshots > 0 ? +((activeCount / totalSnapshots) * totalWorkHours).toFixed(2) : totalWorkHours;
    const idleHours = +(totalWorkHours - activeHours).toFixed(2);

    return {
      date: dateStr,
      summary: {
        totalWorkHours,
        activeHours,
        idleHours,
        avgActivity,
      },
      timeLogs,
    };
  }

  // ── New Portal Endpoints ────────────────────────────

  /**
   * Apply for leave (self-service) — wraps LeavesService.applyLeave.
   */
  async applyLeave(tenantId: string, userEmail: string, dto: PortalApplyLeaveDto) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    return this.leavesService.applyLeave(tenantId, {
      employeeId: employee.id,
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days: dto.days,
      reason: dto.reason,
    });
  }

  /**
   * Get available leave types for the tenant (for apply-leave dropdown).
   */
  async getLeaveTypes(tenantId: string) {
    return this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, code: true },
    });
  }

  // Public company info for the employee portal (contact details only).
  async getCompany(tenantId: string) {
    return this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { name: true, website: true, phone: true, address: true, logo: true },
    });
  }

  /**
   * Get all assignments (current + past) for the logged-in employee.
   */
  async getMyAssignments(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    // GUARD: employees must NOT see the client billing rate / payment. Select only
    // non-financial fields — never billingRate, currency or billingCycle.
    return this.prisma.employeeAssignment.findMany({
      where: { tenantId, employeeId: employee.id },
      select: {
        id: true,
        role: true,
        startDate: true,
        endDate: true,
        status: true,
        workSchedule: true,
        client: { select: { name: true, country: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Get company holidays for a given year.
   */
  async getMyHolidays(tenantId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();

    return this.prisma.holiday.findMany({
      where: { tenantId, year: targetYear },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Request an attendance correction — notifies admins.
   */
  async requestAttendanceCorrection(
    tenantId: string,
    userEmail: string,
    dto: AttendanceCorrectionDto,
  ) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const employeeName = `${employee.firstName} ${employee.lastName}`;

    this.notificationsService.notifyByRole({
      tenantId,
      minRole: 'ADMIN',
      type: 'LEAVE' as any,
      title: 'Attendance Correction Request',
      message: `${employeeName} requested correction for ${dto.date}: ${dto.requestedStatus}. Reason: ${dto.reason}`,
      linkUrl: '/attendance',
      metadata: {
        employeeId: employee.id,
        date: dto.date,
        requestedStatus: dto.requestedStatus,
      },
    }).catch(() => {}); // fire-and-forget

    return { message: 'Correction request submitted to HR' };
  }

  // ── Profile Self-Service ──

  private readonly EDITABLE_FIELDS = [
    'firstName', 'lastName', 'phone', 'designation',
    'pfNumber', 'esiNumber', 'panNumber', 'bankAccount', 'bankIfsc',
  ];

  async getMyProfile(tenantId: string, userEmail: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, email: userEmail, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }

    const pendingChanges = await this.prisma.profileChangeRequest.findMany({
      where: { tenantId, employeeId: employee.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    const changeHistory = await this.prisma.profileChangeRequest.findMany({
      where: { tenantId, employeeId: employee.id, status: { not: 'PENDING' } },
      orderBy: { reviewedAt: 'desc' },
      take: 10,
    });

    return {
      profile: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        designation: employee.designation,
        department: employee.department?.name || null,
        departmentId: employee.departmentId,
        joinDate: employee.joinDate,
        status: employee.status,
        pfNumber: employee.pfNumber,
        esiNumber: employee.esiNumber,
        panNumber: employee.panNumber,
        bankAccount: employee.bankAccount,
        bankIfsc: employee.bankIfsc,
      },
      pendingChanges,
      changeHistory,
    };
  }

  async submitProfileChange(tenantId: string, userEmail: string, userId: string, body: any) {
    const employee = await this.prisma.employee.findFirst({
      where: { tenantId, email: userEmail, deletedAt: null },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }

    // Filter only allowed fields and detect actual changes
    const changes: Record<string, { old: any; new: any }> = {};
    for (const field of this.EDITABLE_FIELDS) {
      if (body[field] !== undefined && body[field] !== (employee as any)[field]) {
        changes[field] = {
          old: (employee as any)[field],
          new: body[field],
        };
      }
    }

    if (Object.keys(changes).length === 0) {
      return { message: 'No changes detected' };
    }

    // Check if there's already a pending request
    const existingPending = await this.prisma.profileChangeRequest.findFirst({
      where: { tenantId, employeeId: employee.id, status: 'PENDING' },
    });

    if (existingPending) {
      // Update the existing pending request with new changes
      await this.prisma.profileChangeRequest.update({
        where: { id: existingPending.id },
        data: { changes: changes as any },
      });
      return { message: 'Pending change request updated', id: existingPending.id };
    }

    const request = await this.prisma.profileChangeRequest.create({
      data: {
        tenantId,
        employeeId: employee.id,
        requestedBy: userId,
        changes: changes as any,
        status: 'PENDING',
      },
    });

    return { message: 'Profile change request submitted for admin approval', id: request.id };
  }


  async getMyPayslips(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) return [];
    
    return this.prisma.payslip.findMany({
      where: { tenantId, employeeId: employee.id },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
  }

  /**
   * Get my employee profile (used by portal pages to get employee ID).
   */
  async getMe(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');
    return {
      id: employee.id,
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        employeeCode: employee.employeeCode,
        designation: employee.designation,
        department: employee.department?.name,
        joinDate: employee.joinDate,
        status: employee.status,
        email: employee.email,
      },
    };
  }

  /**
   * Get my active pay structure assignment with template & components.
   */
  async getMyPayStructure(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const assignment = await this.prisma.payStructureAssignment.findFirst({
      where: {
        tenantId,
        employeeId: employee.id,
        isActive: true,
      },
      include: {
        template: {
          include: {
            components: {
              include: { head: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    return assignment;
  }

  /**
   * Get my current clock-in status: are we currently clocked in?
   * Plus today's totals (hours so far).
   */
  async getMyClockStatus(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    // IST day boundaries — handle overnight logs that cross midnight
    const { start: todayStart, end: todayEnd } = istDayBoundsUTC(todayIST());

    const [active, overlappingLogs, todaySnaps] = await Promise.all([
      this.prisma.timeLog.findFirst({
        where: { tenantId, employeeId: employee.id, clockOut: null },
        orderBy: { clockIn: 'desc' },
      }),
      this.prisma.timeLog.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          clockIn: { lt: todayEnd },
          OR: [{ clockOut: null }, { clockOut: { gt: todayStart } }],
        },
        orderBy: { clockIn: 'asc' },
      }),
      this.prisma.activitySnapshot.findMany({
        where: {
          tenantId,
          employeeId: employee.id,
          capturedAt: { gte: todayStart, lt: todayEnd },
        },
        select: { isIdle: true },
      }),
    ]);

    // Logged seconds = intersect each log with today's IST window
    const now = Date.now();
    const loggedSeconds = overlappingLogs.reduce((sum, tl) => {
      const startMs = Math.max(tl.clockIn.getTime(), todayStart.getTime());
      const endMs = Math.min(tl.clockOut ? tl.clockOut.getTime() : now, todayEnd.getTime(), tl.clockIn.getTime() + 16 * 60 * 60 * 1000);
      return sum + Math.max(0, Math.floor((endMs - startMs) / 1000));
    }, 0);

    // Active seconds = logged × (non-idle snapshots / total snapshots).
    // Matches TeamLogger / Hubstaff: each snapshot represents 1 capture cycle;
    // active ratio = non-idle / total.
    const totalSnaps = todaySnaps.length;
    const nonIdleSnaps = todaySnaps.filter((s) => !s.isIdle).length;
    // No snapshots => activity is unknown (web-only clock-in); show null/"—" rather
    // than implying 100% active by defaulting active = logged.
    const activeRatio = totalSnaps > 0 ? nonIdleSnaps / totalSnaps : null;
    const activeSeconds = activeRatio != null ? Math.floor(loggedSeconds * activeRatio) : null;
    const idleSeconds = activeSeconds != null ? loggedSeconds - activeSeconds : null;

    return {
      isClockedIn: !!active,
      activeTimeLogId: active?.id ?? null,
      clockedInAt: active?.clockIn?.toISOString() ?? null,
      activeSessionStartedToday: active ? active.clockIn.getTime() >= todayStart.getTime() : false,
      // Backward-compat fields (kept so existing UI doesn't break):
      todaySeconds: loggedSeconds,
      todayHours: +(loggedSeconds / 3600).toFixed(2),
      todaySessions: overlappingLogs.length,
      // New richer breakdown:
      loggedSeconds,
      loggedHours: +(loggedSeconds / 3600).toFixed(2),
      activeSeconds,
      activeHours: activeSeconds != null ? +(activeSeconds / 3600).toFixed(2) : null,
      idleSeconds,
      idleHours: idleSeconds != null ? +(idleSeconds / 3600).toFixed(2) : null,
      activityPercent: totalSnaps > 0 ? Math.round((nonIdleSnaps / totalSnaps) * 100) : null,
      snapshotsToday: totalSnaps,
    };
  }

  /**
   * Clock me in (web portal — source=MANUAL).
   */
  async clockMeIn(tenantId: string, userEmail: string, notes?: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    // Prevent double clock-in — but a session past the 10h limit is closed
    // automatically (at clockIn + 10h) so the employee can start a fresh one.
    const openSessions = await this.prisma.timeLog.findMany({
      where: { tenantId, employeeId: employee.id, clockOut: null },
    });
    const now = Date.now();
    if (openSessions.some((s) => now - s.clockIn.getTime() < MAX_SHIFT_MS)) {
      throw new ConflictException('You are already clocked in. Clock out first.');
    }
    for (const stale of openSessions) {
      await this.autoClockout.autoClose(stale);
    }

    const clockIn = new Date();
    const date = new Date(clockIn.toISOString().split('T')[0]);

    const log = await this.prisma.timeLog.create({
      data: {
        tenantId,
        employeeId: employee.id,
        date,
        clockIn,
        source: 'MANUAL',
        notes: notes || 'Web clock-in',
      },
    });

    // Upsert attendance row so the day shows as PRESENT in calendar views
    await this.prisma.attendance.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date } },
      create: {
        tenantId,
        employeeId: employee.id,
        date,
        status: 'PRESENT',
        checkIn: clockIn,
        notes: 'Web clock-in',
        source: 'SYSTEM',
      },
      update: {
        status: 'PRESENT',
      },
    }).catch(() => {});

    return {
      success: true,
      timeLogId: log.id,
      clockedInAt: log.clockIn.toISOString(),
    };
  }

  /**
   * Clock me out (web portal).
   */
  async clockMeOut(tenantId: string, userEmail: string) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const active = await this.prisma.timeLog.findFirst({
      where: { tenantId, employeeId: employee.id, clockOut: null },
      orderBy: { clockIn: 'desc' },
    });
    if (!active) throw new ConflictException('You are not clocked in.');

    // Sessions are capped at 10h: if the sweep hasn't closed this one yet,
    // credit at most clockIn + 10h rather than the full elapsed time.
    const now = new Date();
    const capped = now.getTime() - active.clockIn.getTime() > MAX_SHIFT_MS;
    const clockOut = capped ? new Date(active.clockIn.getTime() + MAX_SHIFT_MS) : now;
    const duration = Math.floor((clockOut.getTime() - active.clockIn.getTime()) / 1000);

    const updated = await this.prisma.timeLog.update({
      where: { id: active.id },
      data: {
        clockOut,
        duration,
        ...(capped && {
          notes: `${active.notes ? `${active.notes} • ` : ''}Auto clock-out after ${MAX_SHIFT_HOURS}h (capped on manual clock-out)`,
        }),
      },
    });

    // Update attendance row(s): set checkOut on the clock-IN date (so workHours is captured),
    // and ensure the clock-OUT date is also marked PRESENT for overnight sessions.
    try {
      const inDate = new Date(active.clockIn.toISOString().split('T')[0]);
      const outDate = new Date(clockOut.toISOString().split('T')[0]);

      const existing = await this.prisma.attendance.findUnique({
        where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date: inDate } },
      });
      if (existing) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkOut: clockOut,
            // workHours = full session duration (admin sees true value in calendar tooltip)
            workHours: +(duration / 3600).toFixed(2) as any,
          },
        });
      }

      // Overnight session — make sure the clock-out day is PRESENT too
      if (outDate.getTime() !== inDate.getTime()) {
        await this.prisma.attendance.upsert({
          where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date: outDate } },
          create: {
            tenantId,
            employeeId: employee.id,
            date: outDate,
            status: 'PRESENT',
            checkOut: clockOut,
            notes: 'Web clock-out (overnight session)',
            source: 'SYSTEM',
          },
          update: { status: 'PRESENT', checkOut: clockOut },
        });
      }
    } catch (e) { /* non-fatal — clock-out result still returns */ }

    return {
      success: true,
      timeLogId: updated.id,
      clockedOutAt: updated.clockOut!.toISOString(),
      durationSeconds: duration,
      durationHours: +(duration / 3600).toFixed(2),
      autoCapped: capped,
    };
  }

  /**
   * Recent clock-in/out sessions for the current employee (most recent first).
   */
  async getMyRecentSessions(tenantId: string, userEmail: string, limit = 10) {
    const employee = await this.getMyEmployee(tenantId, userEmail);
    if (!employee) throw new NotFoundException('Employee profile not linked');

    const sessions = await this.prisma.timeLog.findMany({
      where: { tenantId, employeeId: employee.id },
      orderBy: { clockIn: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      select: {
        id: true,
        clockIn: true,
        clockOut: true,
        duration: true,
        source: true,
        notes: true,
      },
    });

    const now = Date.now();
    return sessions.map((tl) => {
      const computed = tl.duration ??
        (tl.clockOut
          ? Math.floor((tl.clockOut.getTime() - tl.clockIn.getTime()) / 1000)
          : Math.floor((now - tl.clockIn.getTime()) / 1000));
      const h = Math.floor(computed / 3600);
      const m = Math.floor((computed % 3600) / 60);
      return {
        id: tl.id,
        clockIn: tl.clockIn.toISOString(),
        clockOut: tl.clockOut?.toISOString() ?? null,
        isActive: !tl.clockOut,
        durationSeconds: computed,
        durationLabel: `${h}h ${m}m`,
        source: tl.source,
        notes: tl.notes,
        // Convenience: did this session cross midnight (IST)?
        crossesMidnight: !!tl.clockOut && (() => {
          const istInDay  = new Date(tl.clockIn.getTime() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
          const istOutDay = new Date(tl.clockOut!.getTime() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
          return istInDay !== istOutDay;
        })(),
      };
    });
  }

}
