'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '../../lib/auth-client';
import { usePermissions } from '../../lib/use-permissions';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Card, CardHeader, CardTitle, StatCard, Badge, PageSkeleton, Button, PageHeader } from '../../components/ui';
import {
  Users, UserCheck, UserMinus, Briefcase,
  FileText, DollarSign, AlertTriangle, CheckCircle,
  Plus, Receipt, CalendarClock, Building2, ArrowRight,
} from 'lucide-react';

interface DashboardStats {
  employees: {
    total: number;
    active: number;
    assigned: number;
    unassigned: number;
  };
  clients: {
    total: number;
    active: number;
  };
  revenue: {
    draft: { count: number; amount: number | string };
    outstanding: { count: number; amount: number | string };
    collected: { count: number; amount: number | string };
    overdue: { count: number; amount: number | string };
  };
  recentInvoices: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    total: string;
    currency: string;
    status: string;
    invoiceDate: string;
  }[];
}

const STATUS_BADGE_MAP: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default',
  SENT: 'info',
  PAID: 'success',
  OVERDUE: 'danger',
  CANCELLED: 'warning',
};

// Landing fallbacks for scope-limited roles that can't see the dashboard,
// in priority order (first accessible wins).
const LANDING_FALLBACKS = [
  '/attendance/summary', '/shifts', '/clients', '/employees',
  '/leaves', '/reports', '/documents', '/holidays', '/portal',
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { me, canAccessPath } = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // A role whose module scopes exclude the dashboard (e.g. attendance-only)
  // lands here after login — bounce them to their first accessible page
  // instead of showing a blocked/empty dashboard.
  const dashboardBlocked = me?.sidebarAccess?.['/dashboard'] === false;
  useEffect(() => {
    if (!dashboardBlocked) return;
    const target = LANDING_FALLBACKS.find((p) => canAccessPath(p)) ?? '/portal';
    router.replace(target);
  }, [dashboardBlocked, canAccessPath, router]);

  useEffect(() => {
    if (!session || dashboardBlocked) return;
    apiFetch<DashboardStats>('/dashboard/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session, dashboardBlocked]);

  const fmt = (v: number | string) =>
    Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Dashboard"
          description="Overview of your remote staffing operations."
        />

        {/* Workforce Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/employees">
            <StatCard label="Employees" value={stats?.employees.total ?? 0} change={`${stats?.employees.active ?? 0} active`} changeType="neutral" icon={<Users />} />
          </Link>
          <StatCard label="Assigned" value={stats?.employees.assigned ?? 0} change="deployed to clients" changeType="positive" icon={<UserCheck />} />
          <StatCard label="On Bench" value={stats?.employees.unassigned ?? 0} change="available for assignment" changeType="neutral" icon={<UserMinus />} />
          <Link href="/clients">
            <StatCard label="Clients" value={stats?.clients.active ?? 0} change={`${stats?.clients.total ?? 0} total`} changeType="neutral" icon={<Briefcase />} />
          </Link>
        </div>

        {/* Revenue Stats */}
        <div>
          <h2 className="text-xs font-semibold text-content-tertiary uppercase tracking-widest mb-3">Revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Draft" value={fmt(stats?.revenue.draft.amount ?? 0)} change={`${stats?.revenue.draft.count ?? 0} invoices`} changeType="neutral" icon={<FileText />} />
            <StatCard label="Outstanding" value={fmt(stats?.revenue.outstanding.amount ?? 0)} change={`${stats?.revenue.outstanding.count ?? 0} invoices`} changeType="neutral" icon={<DollarSign />} />
            <StatCard label="Collected" value={fmt(stats?.revenue.collected.amount ?? 0)} change={`${stats?.revenue.collected.count ?? 0} invoices`} changeType="positive" icon={<CheckCircle />} />
            <StatCard label="Overdue" value={fmt(stats?.revenue.overdue.amount ?? 0)} change={`${stats?.revenue.overdue.count ?? 0} invoices`} changeType="negative" icon={<AlertTriangle />} />
          </div>
        </div>

        {/* Bottom: Recent Invoices + Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent Invoices */}
          <div className="md:col-span-2">
            <Card padding="none">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <h2 className="text-sm font-semibold text-content-primary">Recent Invoices</h2>
                <Link href="/invoices" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-surface-100">
                {!stats?.recentInvoices?.length ? (
                  <div className="px-5 py-10 text-center text-content-tertiary text-sm">
                    No invoices yet. Generate your first from a client with active assignments.
                  </div>
                ) : (
                  stats.recentInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-mono font-semibold text-content-primary">{inv.invoiceNumber}</p>
                        <p className="text-xs text-content-tertiary mt-0.5">{inv.clientName}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <p className="text-sm font-mono text-content-primary">
                          {inv.currency} {fmt(inv.total)}
                        </p>
                        <Badge variant={STATUS_BADGE_MAP[inv.status] ?? 'default'}>
                          {inv.status}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <h2 className="text-sm font-semibold text-content-primary mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <QuickAction label="Add Employee" href="/employees/new" icon={<Plus size={14} />} />
              <QuickAction label="Add Client" href="/clients/new" icon={<Plus size={14} />} />
              <QuickAction label="Generate Invoice" href="/invoices" icon={<Receipt size={14} />} />
              <QuickAction label="Mark Attendance" href="/attendance" icon={<CalendarClock size={14} />} />
              <QuickAction label="View Departments" href="/departments" icon={<Building2 size={14} />} />
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function QuickAction({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-content-secondary hover:bg-surface-50 hover:text-content-primary border border-surface-200 transition-colors"
    >
      <span className="h-7 w-7 flex items-center justify-center bg-brand-50 rounded-md text-brand-600">
        {icon}
      </span>
      {label}
    </Link>
  );
}
