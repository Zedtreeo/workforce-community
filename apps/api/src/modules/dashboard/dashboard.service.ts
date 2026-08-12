import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CacheService } from '../../common/cache';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getStats(tenantId: string) {
    const cacheKey = this.cache.key(tenantId, 'dashboard', 'stats');
    return this.cache.getOrSet(cacheKey, () => this.computeStats(tenantId), 60);
  }

  private async computeStats(tenantId: string) {
    const [
      employees,
      activeEmployees,
      clients,
      activeClients,
      activeAssignments,
      unassignedCount,
      invoiceDraft,
      invoiceSent,
      invoicePaid,
      invoiceOverdue,
      recentInvoices,
    ] = await Promise.all([
      // Employee counts
      this.prisma.employee.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.employee.count({ where: { tenantId, deletedAt: null, status: 'ACTIVE' } }),

      // Client counts
      this.prisma.client.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.client.count({ where: { tenantId, deletedAt: null, isActive: true } }),

      // Assignment counts
      this.prisma.employeeAssignment.count({ where: { tenantId, status: 'ACTIVE' } }),

      // Unassigned active employees (no active assignment)
      this.prisma.employee.count({
        where: {
          tenantId,
          deletedAt: null,
          status: 'ACTIVE',
          assignments: { none: { status: 'ACTIVE' } },
        },
      }),

      // Invoice aggregates
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'DRAFT' },
        _sum: { total: true },
        _count: true,
      }),
      // Outstanding = issued but not (fully) paid — SENT, OVERDUE or PARTIALLY_PAID
      this.prisma.invoice.aggregate({
        where: { tenantId, status: { in: ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, status: 'PAID' },
        _sum: { paidAmount: true, total: true },
        _count: true,
      }),
      // Overdue = explicitly OVERDUE, or SENT past its due date
      this.prisma.invoice.aggregate({
        where: { tenantId, OR: [{ status: 'OVERDUE' }, { status: 'SENT', dueDate: { lt: new Date() } }] },
        _sum: { total: true },
        _count: true,
      }),

      // Recent invoices
      this.prisma.invoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          client: { select: { name: true } },
        },
      }),
    ]);

    return {
      employees: {
        total: employees,
        active: activeEmployees,
        assigned: activeAssignments,
        unassigned: unassignedCount,
      },
      clients: {
        total: clients,
        active: activeClients,
      },
      revenue: {
        draft: { count: invoiceDraft._count, amount: invoiceDraft._sum.total ?? 0 },
        outstanding: { count: invoiceSent._count, amount: invoiceSent._sum.total ?? 0 },
        collected: { count: invoicePaid._count, amount: invoicePaid._sum.paidAmount ?? invoicePaid._sum.total ?? 0 },
        overdue: { count: invoiceOverdue._count, amount: invoiceOverdue._sum.total ?? 0 },
      },
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client.name,
        total: inv.total,
        currency: inv.currency,
        status: inv.status,
        invoiceDate: inv.invoiceDate,
      })),
    };
  }
}
