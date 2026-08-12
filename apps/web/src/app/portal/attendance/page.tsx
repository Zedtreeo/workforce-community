'use client';

import { useEffect, useState } from 'react';

import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, Button, Modal, PageSkeleton, PageHeader } from '../../../components/ui';
import { FileEdit } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
}

interface AttendanceData {
  year: number;
  month: number;
  records: AttendanceRecord[];
  summary: {
    present: number;
    absent: number;
    leave: number;
    wfh: number;
    halfDay: number;
    totalDays: number;
  };
  dailyHours?: Record<string, number>;
  dailySessions?: Record<string, { clockIn: string; clockOut: string | null }>;
  totalHours?: number;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

const statusBadgeVariant: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  LEAVE: 'warning',
  WFH: 'info',
  HALF_DAY: 'warning',
};

export default function MyAttendancePage() {
  const { data: session } = useSession();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);

  // Correction modal state
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: '',
    requestedStatus: 'PRESENT',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);

  // ── Web Clock In/Out state ──
  const [clock, setClock] = useState<{
    isClockedIn: boolean;
    clockedInAt: string | null;
    activeSessionStartedToday?: boolean;
    todaySeconds: number;
    todayHours: number;
    todaySessions: number;
    loggedSeconds?: number;
    loggedHours?: number;
    activeSeconds?: number;
    activeHours?: number;
    idleHours?: number;
    activityPercent?: number | null;
  } | null>(null);
  const [clockBusy, setClockBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Recent sessions
  interface RecentSession {
    id: string;
    clockIn: string;
    clockOut: string | null;
    isActive: boolean;
    durationSeconds: number;
    durationLabel: string;
    source: string;
    crossesMidnight: boolean;
  }
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const fetchSessions = async () => {
    if (!session?.session?.token) return;
    try {
      const res = await apiFetch<RecentSession[]>('/portal/recent-sessions?limit=10', { token: session.session.token });
      setSessions(res || []);
    } catch { /* silent */ }
  };

  const fetchClockStatus = async () => {
    if (!session?.session?.token) return;
    try {
      const res = await apiFetch<typeof clock>('/portal/clock-status', { token: session.session.token });
      setClock(res);
    } catch { /* silent */ }
  };

  // Refresh clock status on mount + every 30s
  useEffect(() => {
    if (!session?.session?.token) return;
    fetchClockStatus();
    fetchSessions();
    const iv = setInterval(() => { fetchClockStatus(); fetchSessions(); }, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session?.token]);

  // Live timer tick (1s) — only when clocked in
  useEffect(() => {
    if (!clock?.isClockedIn) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [clock?.isClockedIn]);

  const handleClockToggle = async () => {
    if (!session?.session?.token || clockBusy) return;
    setClockBusy(true);
    setAlert(null);
    try {
      if (clock?.isClockedIn) {
        const res = await apiFetch<{ durationHours: number; durationSeconds: number; clockedOutAt: string }>(
          '/portal/clock-out',
          { token: session.session.token, method: 'POST', body: '{}' },
        );
        const h = Math.floor(res.durationSeconds / 3600);
        const m = Math.floor((res.durationSeconds % 3600) / 60);
        setAlert({ type: 'success', message: `Clocked out. Session duration: ${h}h ${m}m (${res.durationHours}h).` });
      } else {
        await apiFetch('/portal/clock-in', { token: session.session.token, method: 'POST', body: JSON.stringify({}) });
        setAlert({ type: 'success', message: 'Clocked in. Have a productive day.' });
      }
      await Promise.all([fetchClockStatus(), fetchSessions()]);
    } catch (e: any) {
      setAlert({ type: 'danger', message: e?.message || 'Failed to update clock status. Please try again.' });
    } finally {
      setClockBusy(false);
    }
  };

  // Live "today" elapsed seconds including the active session.
  // Only add a local delta if the active session STARTED today — otherwise
  // todaySeconds from the server (which intersected the IST day) is authoritative
  // and the +30s server-poll cadence is good enough.
  const liveTodaySeconds = (() => {
    if (!clock) return 0;
    if (!clock.isClockedIn || !clock.clockedInAt) return clock.todaySeconds;
    if (clock.activeSessionStartedToday === false) return clock.todaySeconds;
    const sessionMs = nowTick - new Date(clock.clockedInAt).getTime();
    return Math.max(clock.todaySeconds, Math.floor(sessionMs / 1000));
  })();

  const fmtClock = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!session?.session?.token) return;
    setLoading(true);
    apiFetch<AttendanceData>(`/portal/attendance?month=${month}&year=${year}`, {
      token: session.session.token,
    })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.session?.token, month, year]);

  const handleCorrectionSubmit = async () => {
    if (!session?.session?.token || !correctionForm.reason.trim()) return;
    setSubmitting(true);
    setAlert(null);
    try {
      await apiFetch('/portal/attendance/correction', {
        token: session.session.token,
        method: 'POST',
        body: JSON.stringify({
          date: correctionForm.date,
          requestedStatus: correctionForm.requestedStatus,
          reason: correctionForm.reason,
        }),
      });
      setShowCorrection(false);
      setCorrectionForm({ date: '', requestedStatus: 'PRESENT', reason: '' });
      setAlert({ type: 'success', message: 'Correction request submitted successfully. HR will review it shortly.' });
    } catch {
      setAlert({ type: 'danger', message: 'Failed to submit correction request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="My Attendance"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Attendance' }]}
          actions={
            <Button size="sm" variant="secondary" icon={<FileEdit size={16} />} onClick={() => setShowCorrection(true)}>
              Request Correction
            </Button>
          }
        />

        {/* Clock In / Clock Out card */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${clock?.isClockedIn ? 'bg-success animate-pulse' : 'bg-content-tertiary'}`} />
                <span className="text-sm font-semibold text-content-primary">
                  {clock?.isClockedIn ? 'Currently Clocked In' : 'Clocked Out'}
                </span>
              </div>
              <div className="text-xs text-content-tertiary">
                {clock?.isClockedIn && clock.clockedInAt
                  ? (clock.activeSessionStartedToday === false
                      ? `Since ${new Date(clock.clockedInAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — spans midnight; only today's hours shown`
                      : `Since ${new Date(clock.clockedInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} — sessions today: ${clock.todaySessions}`)
                  : `${clock?.todaySessions ?? 0} session${(clock?.todaySessions ?? 0) === 1 ? '' : 's'} today`}
              </div>
              <div className="text-[11px] text-content-tertiary mt-1">
                Sessions auto clock-out after 10 hours — clock in again to extend your shift.
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className={`text-2xl font-bold tabular-nums ${clock?.isClockedIn ? 'text-success-dark' : 'text-content-primary'}`}>
                  {fmtClock(liveTodaySeconds)}
                </div>
                <div className="text-[11px] text-content-tertiary uppercase tracking-wide">Logged</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums text-content-secondary">
                  {clock?.activeHours != null ? `${clock.activeHours.toFixed(2)}h` : '—'}
                </div>
                <div className="text-[11px] text-content-tertiary uppercase tracking-wide">Active</div>
              </div>
              {clock?.activityPercent != null && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums text-brand-600">{clock.activityPercent}%</div>
                  <div className="text-[11px] text-content-tertiary uppercase tracking-wide">Activity</div>
                </div>
              )}
              <Button
                onClick={handleClockToggle}
                disabled={clockBusy || !clock}
                variant={clock?.isClockedIn ? 'danger' : 'primary'}
                size="lg"
              >
                {clockBusy ? '…' : clock?.isClockedIn ? 'Clock Out' : 'Clock In'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <Card padding="none">
            <div className="px-4 py-3 border-b border-surface-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-content-primary">Recent Sessions</span>
              <span className="text-xs text-content-tertiary">Last {sessions.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-left border-b border-surface-100">
                <tr>
                  <th className="px-4 py-2 font-medium text-content-secondary text-xs">Clock In</th>
                  <th className="px-4 py-2 font-medium text-content-secondary text-xs">Clock Out</th>
                  <th className="px-4 py-2 font-medium text-content-secondary text-xs">Duration</th>
                  <th className="px-4 py-2 font-medium text-content-secondary text-xs">Source</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => {
                  const inDt = new Date(sess.clockIn);
                  const outDt = sess.clockOut ? new Date(sess.clockOut) : null;
                  const inLabel = inDt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  const outLabel = outDt
                    ? outDt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : null;
                  return (
                    <tr key={sess.id} className="border-b border-surface-100 last:border-0">
                      <td className="px-4 py-2.5 text-content-primary tabular-nums">{inLabel}</td>
                      <td className="px-4 py-2.5">
                        {outLabel ? (
                          <span className="text-content-primary tabular-nums">
                            {outLabel}
                            {sess.crossesMidnight && (
                              <span className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 align-middle">overnight</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-success-dark font-medium">● Active</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-content-secondary font-medium tabular-nums">{sess.durationLabel}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] uppercase tracking-wide text-content-tertiary">
                          {sess.source.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {/* Alert */}
        {alert && (
          <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
            alert.type === 'success' ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger-dark'
          }`}>
            {alert.message}
          </div>
        )}

        {/* Month/Year Selector */}
        <div className="flex gap-2">
          <select
            className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
          >
            {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
            value={year}
            onChange={(e) => setYear(+e.target.value)}
          >
            {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : data ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[
                { label: 'Present', value: data.summary.present, color: 'text-success-dark' },
                { label: 'Absent', value: data.summary.absent, color: 'text-danger-dark' },
                { label: 'Leave', value: data.summary.leave, color: 'text-warning-dark' },
                { label: 'WFH', value: data.summary.wfh, color: 'text-brand-600' },
                { label: 'Half Day', value: data.summary.halfDay, color: 'text-warning-dark' },
              ].map((s) => (
                <Card key={s.label} padding="sm">
                  <div className="text-center">
                    <p className="text-xs text-content-tertiary">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </Card>
              ))}
            </div>

            {/* Records Table — date-wise, merged with time-log clock-in/out */}
            <Card padding="none">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200">
                  <tr>
                    <th className="px-4 py-3 font-medium text-content-secondary">Date</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Day</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Status</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Clock In</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Clock Out</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Hours</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {(() => {
                    // Every day of the month with a record OR clock activity
                    const monthPrefix = `${data.year}-${String(data.month).padStart(2, '0')}`;
                    const recByKey = new Map<string, AttendanceRecord>();
                    for (const r of data.records) recByKey.set(new Date(r.date).toISOString().split('T')[0], r);
                    const dayKeys = [...new Set([
                      ...recByKey.keys(),
                      ...Object.keys(data.dailySessions ?? {}),
                      ...Object.keys(data.dailyHours ?? {}),
                    ])].filter((k) => k.startsWith(monthPrefix)).sort();

                    if (dayKeys.length === 0) {
                      return <tr><td colSpan={7} className="px-4 py-8 text-center text-content-tertiary">No records for this month</td></tr>;
                    }
                    return dayKeys.map((key) => {
                      const r = recByKey.get(key);
                      const sess = data.dailySessions?.[key];
                      const hrs = data.dailyHours?.[key];
                      const status = r?.status ?? (hrs && hrs > 0 ? 'PRESENT' : null);
                      const clockIn = sess?.clockIn ?? r?.checkIn;
                      const clockOut = sess ? sess.clockOut : r?.checkOut;
                      const ongoing = !!sess && sess.clockOut === null;
                      // Overnight shift — clock-out lands on the next calendar day (IST)
                      const overnight = !!clockIn && !!clockOut &&
                        new Date(clockIn).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !==
                        new Date(clockOut).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                      const d = new Date(key);
                      return (
                        <tr key={key} className="hover:bg-surface-50">
                          <td className="px-4 py-2 text-content-primary">{d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                          <td className="px-4 py-2 text-content-tertiary">{d.toLocaleDateString('en', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</td>
                          <td className="px-4 py-2">
                            {status ? (
                              <Badge variant={statusBadgeVariant[status] || 'default'}>
                                {status.replace('_', ' ')}
                              </Badge>
                            ) : <span className="text-content-tertiary">—</span>}
                          </td>
                          <td className="px-4 py-2 text-content-secondary tabular-nums">{clockIn ? fmtTime(clockIn) : '—'}</td>
                          <td className="px-4 py-2 text-content-secondary tabular-nums">
                            {ongoing
                              ? <span className="text-success-dark font-medium">● working</span>
                              : clockOut ? (
                                  <>
                                    {fmtTime(clockOut)}
                                    {overnight && <sup className="ml-0.5 text-[9px] font-semibold text-warning-dark" title="Clock-out on the next day">+1</sup>}
                                  </>
                                ) : '—'}
                          </td>
                          <td className="px-4 py-2 text-content-secondary tabular-nums">{hrs != null ? `${hrs}h` : '—'}</td>
                          <td className="px-4 py-2 text-content-tertiary">{r?.notes || '—'}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </Card>
          </>
        ) : (
          <p className="text-content-tertiary text-sm">No data available</p>
        )}
      </div>

      {/* Correction Request Modal */}
      <Modal
        open={showCorrection}
        onClose={() => setShowCorrection(false)}
        title="Request Attendance Correction"
        description="Submit a correction request to HR for review"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCorrection(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={submitting}
              disabled={!correctionForm.date || !correctionForm.reason.trim()}
              onClick={handleCorrectionSubmit}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
              value={correctionForm.date}
              onChange={(e) => setCorrectionForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">Requested Status</label>
            <select
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
              value={correctionForm.requestedStatus}
              onChange={(e) => setCorrectionForm((f) => ({ ...f, requestedStatus: e.target.value }))}
            >
              <option value="PRESENT">Present</option>
              <option value="WFH">Work From Home</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="LEAVE">Leave</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              Reason <span className="text-danger-dark">*</span>
            </label>
            <textarea
              className="w-full border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0 min-h-[80px] resize-none"
              placeholder="Explain why this correction is needed..."
              value={correctionForm.reason}
              onChange={(e) => setCorrectionForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
