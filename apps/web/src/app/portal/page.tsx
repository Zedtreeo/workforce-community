'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Card, StatCard, Badge, PageSkeleton, PageHeader } from '../../components/ui';
import { CalendarClock, TreePalm, Landmark, Briefcase, CalendarDays, Clock, AlertTriangle, Building2, Globe, Phone, MapPin } from 'lucide-react';

interface CompanyInfo { name: string; website: string | null; phone: string | null; address: string | null; logo: string | null; }

interface PortalDashboard {
  linked: boolean;
  employee?: {
    id: string;
    name: string;
    employeeCode: string;
    designation: string | null;
    department: string | null;
    joinDate: string;
    status: string;
  };
  currentAssignment?: {
    clientName: string;
    clientCountry: string;
    role: string;
    startDate: string;
  } | null;
  today?: {
    attendance: string;
    isClockedIn: boolean;
    clockInTime: string | null;
  };
  leaveBalances?: { type: string; code: string; entitled: number; used: number; available: number }[];
  pendingLeaves?: number;
  recentTimeLogs?: { date: string; clockIn: string; clockOut: string | null; duration: number | null }[];
}

export default function PortalPage() {
  const { data: session } = useSession();
  const [dash, setDash] = useState<PortalDashboard | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.session?.token) return;
    apiFetch<PortalDashboard>('/portal/dashboard', { token: session.session.token })
      .then(setDash)
      .catch(() => {})
      .finally(() => setLoading(false));
    apiFetch<CompanyInfo>('/portal/company', { token: session.session.token })
      .then(setCompany)
      .catch(() => {});
  }, [session?.session?.token]);

  if (loading) return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;

  if (!dash?.linked) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <Card className="max-w-lg bg-warning-light border-warning">
            <div className="flex gap-3">
              <AlertTriangle size={20} className="text-warning-dark shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-semibold text-warning-dark mb-1">Profile Not Linked</h2>
                <p className="text-sm text-warning-dark/80">
                  Your user account is not linked to an employee profile. Please contact your administrator
                  to ensure your email matches an employee record.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const emp = dash.employee!;
  const assign = dash.currentAssignment;
  const today = dash.today!;

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const quickLinks = [
    { label: 'My Attendance', href: '/portal/attendance', icon: <CalendarClock size={22} /> },
    { label: 'My Leaves', href: '/portal/leaves', icon: <TreePalm size={22} /> },
    { label: 'My Assignments', href: '/portal/assignments', icon: <Briefcase size={22} /> },
    { label: 'Holidays', href: '/portal/holidays', icon: <CalendarDays size={22} /> },
    { label: 'My Payslips', href: '/portal/payslips', icon: <Landmark size={22} /> },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title={`Welcome, ${emp.name}`}
          description={`${emp.designation || 'Employee'} · ${emp.department || 'No department'} · ${emp.employeeCode}`}
          actions={
            <Badge variant={emp.status === 'ACTIVE' ? 'success' : 'default'} dot>
              {emp.status}
            </Badge>
          }
        />

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card hover className="text-center py-6">
                <div className="h-11 w-11 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-3">
                  {link.icon}
                </div>
                <p className="text-sm font-medium text-content-primary">{link.label}</p>
              </Card>
            </Link>
          ))}
        </div>

        {/* Today's Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Today's Attendance"
            value={today.attendance.replace('_', ' ')}
            icon={<CalendarClock />}
          />
          <StatCard
            label="Clock Status"
            value={today.isClockedIn ? 'Clocked In' : 'Not Clocked In'}
            change={today.clockInTime ? `Since ${formatTime(today.clockInTime)}` : undefined}
            changeType={today.isClockedIn ? 'positive' : 'neutral'}
            icon={<Clock />}
          />
          <StatCard
            label="Pending Leave Requests"
            value={dash.pendingLeaves || 0}
            icon={<TreePalm />}
          />
        </div>

        {/* Current Assignment */}
        {assign && (
          <Card>
            <h3 className="text-sm font-semibold text-content-primary mb-3">Current Assignment</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 flex-wrap text-sm">
              <div><span className="text-content-tertiary">Client:</span> <span className="font-medium text-content-primary">{assign.clientName}</span></div>
              <div><span className="text-content-tertiary">Country:</span> <span className="text-content-secondary">{assign.clientCountry}</span></div>
              <div><span className="text-content-tertiary">Role:</span> <span className="text-content-secondary">{assign.role}</span></div>
              <div><span className="text-content-tertiary">Since:</span> <span className="text-content-secondary">{new Date(assign.startDate).toLocaleDateString()}</span></div>
            </div>
          </Card>
        )}

        {/* Leave Balances */}
        {dash.leaveBalances && dash.leaveBalances.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-content-primary mb-3">Leave Balances</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {dash.leaveBalances.map((b) => (
                <Card key={b.code}>
                  <p className="text-xs text-content-tertiary">{b.type}</p>
                  <p className="text-xl font-bold text-content-primary mt-1">{b.available}</p>
                  <p className="text-xs text-content-tertiary mt-0.5">{b.used} used of {b.entitled}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Time Logs */}
        {dash.recentTimeLogs && dash.recentTimeLogs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-content-primary mb-3">Recent Time Logs</h3>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Clock In</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Clock Out</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {dash.recentTimeLogs.map((tl, i) => (
                      <tr key={i} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 text-content-primary">{new Date(tl.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-content-secondary">{formatTime(tl.clockIn)}</td>
                        <td className="px-4 py-3">{tl.clockOut ? <span className="text-content-secondary">{formatTime(tl.clockOut)}</span> : <Badge variant="success" dot>Active</Badge>}</td>
                        <td className="px-4 py-3 text-content-secondary">{formatDuration(tl.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {company && (
          <div>
            <h3 className="text-sm font-semibold text-content-primary mb-3 flex items-center gap-1.5">
              <Building2 size={16} className="text-content-tertiary" /> Company Information
            </h3>
            <Card>
              <p className="text-base font-semibold text-content-primary">{company.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                {company.website && (
                  <div className="flex items-center gap-2 text-content-secondary">
                    <Globe size={15} className="text-content-tertiary shrink-0" />
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">
                      {company.website}
                    </a>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2 text-content-secondary">
                    <Phone size={15} className="text-content-tertiary shrink-0" />
                    <a href={`tel:${company.phone}`} className="hover:text-content-primary">{company.phone}</a>
                  </div>
                )}
                {company.address && (
                  <div className="flex items-start gap-2 text-content-secondary">
                    <MapPin size={15} className="text-content-tertiary shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line">{company.address}</span>
                  </div>
                )}
                {!company.website && !company.phone && !company.address && (
                  <p className="text-content-tertiary text-xs">Contact details not configured yet.</p>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
