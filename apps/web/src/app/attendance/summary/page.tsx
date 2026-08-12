'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import {
  PageHeader, StatCard, DataTable, Badge, Button, PageSkeleton,
} from '../../../components/ui';
import {
  Clock, Timer, FilePlus2, Users2, MoonStar, UserCheck, RefreshCw, ChevronRight,
} from 'lucide-react';
import { todayIST, fmtTimeIST } from '../../../lib/ist-dates';

/* hours (decimal) -> "HH:MM" */
function hm(h: number): string {
  const t = Math.max(0, Math.round((h || 0) * 60));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
/* hours (decimal) -> "13h 10m" for big stat cards */
function hLabel(h: number): string {
  const t = Math.max(0, Math.round((h || 0) * 60));
  const hh = Math.floor(t / 60), mm = t % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

function ActivityBar({ percent }: { percent: number }) {
  const color = percent >= 70 ? 'bg-success' : percent >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-content-secondary w-9 text-right">{percent}%</span>
      <div className="w-16 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

export default function AttendanceSummaryPage() {
  const { data } = useSession();
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayIST());

  const fetchTeam = useCallback(async () => {
    if (!data?.session?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch<any[]>(`/monitoring/team?date=${date}`);
      setTeam(res);
    } catch (e) {
      console.error('Failed to fetch team overview:', e);
    } finally {
      setLoading(false);
    }
  }, [data, date]);

  useEffect(() => {
    fetchTeam();
    const iv = setInterval(fetchTeam, 60_000);
    return () => clearInterval(iv);
  }, [fetchTeam]);

  const idleOf = (e: any) => Math.max(0, (e.totalWorkHours || 0) - (e.activeWorkHours || 0));
  // Including Idle Timeout = full span from first check-in to current time (incl gaps).
  const includingOf = (e: any) => (e.spanStart && e.spanEnd)
    ? Math.max(0, (new Date(e.spanEnd).getTime() - new Date(e.spanStart).getTime()) / 3600000)
    : 0;
  const sum = (f: (e: any) => number) => team.reduce((s, e) => s + (f(e) || 0), 0);
  const worked = team.filter((e) => (e.totalWorkHours || 0) > 0).length;

  const columns: any[] = [
    {
      key: 'name', header: 'Employee', sortable: true,
      render: (e: any) => (
        <div>
          <p className="font-medium text-content-primary">{e.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-content-tertiary">{e.employeeCode}</p>
            <Badge variant={e.isOnline ? 'success' : 'default'} dot>{e.isOnline ? 'Online' : 'Offline'}</Badge>
          </div>
        </div>
      ),
    },
    {
      key: 'span', header: 'Activity Span',
      render: (e: any) => e.spanStart && e.spanEnd
        ? <span className="text-sm text-content-secondary">{fmtTimeIST(e.spanStart)} <span className="text-content-tertiary">&rarr;</span> {fmtTimeIST(e.spanEnd)}</span>
        : <span className="text-content-tertiary">&mdash;</span>,
    },
    {
      key: 'total', header: 'Total Time Worked', headerClassName: 'text-center', className: 'text-center', sortable: true,
      render: (e: any) => <Badge variant="brand">{hm(e.activeWorkHours)}</Badge>,
    },
    { key: 'avgActivity', header: '% Active', headerClassName: 'text-center', className: 'text-center', sortable: true, render: (e: any) => <ActivityBar percent={e.avgActivity} /> },
    {
      key: 'idle', header: 'Idle Timeout Deduction', headerClassName: 'text-center', className: 'text-center',
      render: (e: any) => <span className={`text-sm font-medium ${idleOf(e) > 0 ? 'text-danger' : 'text-content-tertiary'}`}>{hm(idleOf(e))}</span>,
    },
    {
      key: 'including', header: 'Including Idle Timeout', headerClassName: 'text-center', className: 'text-center text-brand-700 font-medium',
      render: (e: any) => <>{hm(includingOf(e))}</>,
    },
    {
      key: 'actions', header: '', headerClassName: 'text-right', className: 'text-right',
      render: (e: any) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/attendance/${e.id}`}>
            <Button variant="ghost" size="xs">Monthly</Button>
          </Link>
          <Link href={`/attendance/screenshots/${e.id}?date=${date}`}>
            <Button variant="ghost" size="xs" iconRight={<ChevronRight size={14} />}>Timeline</Button>
          </Link>
        </div>
      ),
    },
  ];

  if (loading && team.length === 0) {
    return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Attendance Summary"
          description="Aggregated work hours, activity levels and time breakdown for employees."
          breadcrumbs={[{ label: 'Attendance' }, { label: 'Summary' }]}
          actions={
            <div className="flex items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchTeam}>Refresh</Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Time Worked" value={hLabel(sum((e) => e.totalWorkHours))} icon={<Clock />} />
          <StatCard label="Active" value={hLabel(sum((e) => e.activeWorkHours))} icon={<Timer />} />
          <StatCard label="Idle Time" value={hLabel(sum(idleOf))} icon={<MoonStar />} />
          <StatCard label="Employees Worked" value={`${worked}/${team.length}`} icon={<UserCheck />} />
        </div>

        <DataTable columns={columns} data={team} rowKey={(e: any) => e.id} loading={loading} loadingRows={6} />
      </div>
    </DashboardLayout>
  );
}
