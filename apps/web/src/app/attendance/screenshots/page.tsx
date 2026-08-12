'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import {
  PageHeader, StatCard, DataTable, Badge, Button, Card, PageSkeleton,
} from '../../../components/ui';
import {
  Wifi, BarChart3, Clock, Users, RefreshCw, ChevronRight,
} from 'lucide-react';
import { todayIST } from '../../../lib/ist-dates';

/* ── activity bar ── */
function ActivityBar({ percent }: { percent: number }) {
  const color = percent >= 70 ? 'bg-success' : percent >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-16 h-2 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <span className="text-xs font-medium text-content-secondary">{percent}%</span>
    </div>
  );
}

/* ── main page ── */
export default function MonitoringPage() {
  const { data } = useSession();
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => todayIST());
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

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

  const filtered = team.filter((e: any) =>
    filter === 'online' ? e.isOnline : filter === 'offline' ? !e.isOnline : true,
  );

  const online = team.filter((e: any) => e.isOnline).length;
  const avgActivity = team.length > 0 ? Math.round(team.reduce((s: number, e: any) => s + e.avgActivity, 0) / team.length) : 0;
  const totalHours = team.reduce((s: number, e: any) => s + e.totalWorkHours, 0).toFixed(1);

  const columns: any[] = [
    {
      key: 'name', header: 'Employee', sortable: true,
      render: (e: any) => (
        <div>
          <p className="font-medium text-content-primary">{e.name}</p>
          <p className="text-xs text-content-tertiary">{e.employeeCode} · {e.designation || 'N/A'}</p>
        </div>
      ),
    },
    {
      key: 'isOnline', header: 'Status',
      render: (e: any) => <Badge variant={e.isOnline ? 'success' : 'default'} dot>{e.isOnline ? 'Online' : 'Offline'}</Badge>,
    },
    { key: 'clientName', header: 'Client', render: (e: any) => <span className="text-content-secondary">{e.clientName || '—'}</span> },
    {
      key: 'totalWorkHours', header: 'Hours', headerClassName: 'text-center', className: 'text-center font-medium text-content-primary', sortable: true,
      render: (e: any) => <>{e.totalWorkHours}h</>,
    },
    { key: 'avgActivity', header: 'Activity', headerClassName: 'text-center', sortable: true, render: (e: any) => <ActivityBar percent={e.avgActivity} /> },
    { key: 'screenshotCount', header: 'Screenshots', headerClassName: 'text-center', className: 'text-center text-content-secondary', sortable: true },
    { key: 'totalKeystrokes', header: 'Keystrokes', headerClassName: 'text-center', className: 'text-center text-content-secondary', render: (e: any) => <>{e.totalKeystrokes.toLocaleString()}</> },
    { key: 'totalClicks', header: 'Clicks', headerClassName: 'text-center', className: 'text-center text-content-secondary', render: (e: any) => <>{e.totalClicks.toLocaleString()}</> },
    {
      key: 'actions', header: '', headerClassName: 'text-right', className: 'text-right',
      render: (e: any) => (
        <Link href={`/attendance/screenshots/${e.id}?date=${date}`}>
          <Button variant="ghost" size="xs" iconRight={<ChevronRight size={14} />}>Timeline</Button>
        </Link>
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
          title="Screenshots"
          description="Select an employee to view captured screenshots"
          breadcrumbs={[{ label: 'Attendance' }, { label: 'Screenshots' }]}
          actions={
            <div className="flex items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={fetchTeam}>Refresh</Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Employees" value={team.length} icon={<Users />} />
          <StatCard label="Currently Online" value={online} changeType="positive" icon={<Wifi />} />
          <StatCard label="Avg Activity" value={`${avgActivity}%`} icon={<BarChart3 />} />
          <StatCard label="Total Hours Today" value={`${totalHours}h`} icon={<Clock />} />
        </div>

        <div className="flex gap-2">
          {(['all', 'online', 'offline'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-brand-600 text-white' : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
              }`}
            >
              {f === 'all' ? `All (${team.length})` : f === 'online' ? `Online (${online})` : `Offline (${team.length - online})`}
            </button>
          ))}
        </div>

        <DataTable columns={columns} data={filtered} rowKey={(e: any) => e.id} loading={loading} loadingRows={6} />
      </div>
    </DashboardLayout>
  );
}
