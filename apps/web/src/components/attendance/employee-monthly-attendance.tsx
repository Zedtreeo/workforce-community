'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { Button, Card } from '../ui';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'WFH';

interface HistoryResponse {
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  records: Array<{
    id: string; date: string; status: AttendanceStatus;
    checkIn?: string; checkOut?: string; workHours?: string; notes?: string;
  }>;
  summary: {
    total: number; present: number; absent: number; halfDay: number;
    leave: number; holiday: number; weekend: number; wfh: number;
  };
  dailyHours?: Record<string, number>;
  dailySessions?: Record<string, { clockIn: string; clockOut: string | null }>;
  totalHours?: number;
  totalSeconds?: number;
}

const STATUS_STYLE: Record<AttendanceStatus, { bg: string; label: string; short: string }> = {
  PRESENT: { bg: 'bg-success text-white', label: 'Present', short: 'P' },
  ABSENT: { bg: 'bg-danger text-white', label: 'Absent', short: 'A' },
  HALF_DAY: { bg: 'bg-warning text-white', label: 'Half Day', short: 'HD' },
  LEAVE: { bg: 'bg-warning text-white', label: 'Leave', short: 'L' },
  HOLIDAY: { bg: 'bg-brand-500 text-white', label: 'Holiday', short: 'H' },
  WEEKEND: { bg: 'bg-surface-300 text-content-secondary', label: 'Weekend', short: 'W' },
  WFH: { bg: 'bg-info text-white', label: 'WFH', short: 'WFH' },
};

/** Monthly attendance calendar + records for one employee (reusable). */
export function EmployeeMonthlyAttendance({ employeeId }: { employeeId: string }) {
  const { data: session } = useSession();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!session || !employeeId) return;
    setLoading(true);
    try {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await apiFetch<HistoryResponse>(`/attendance/employee/${employeeId}?from=${from}&to=${to}`);
      setData(res);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [session, employeeId, year, month]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const recordMap = new Map<number, AttendanceStatus>();
  if (data) for (const rec of data.records) recordMap.set(new Date(rec.date).getUTCDate(), rec.status);

  // Date-wise rows for the table: every day of this month that has an
  // attendance record OR clock-in/out activity in the time logs.
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const recByKey = new Map<string, HistoryResponse['records'][number]>();
  if (data) for (const rec of data.records) recByKey.set(new Date(rec.date).toISOString().split('T')[0], rec);
  const dayKeys = [...new Set([
    ...recByKey.keys(),
    ...Object.keys(data?.dailySessions ?? {}),
    ...Object.keys(data?.dailyHours ?? {}),
  ])].filter((k) => k.startsWith(monthPrefix)).sort().reverse();

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-content-primary">
            {data ? `${data.employee.firstName} ${data.employee.lastName}` : 'Loading…'}
          </h2>
          <p className="text-sm text-content-tertiary mt-0.5">
            {data?.employee.employeeCode} · Monthly attendance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={prevMonth}>←</Button>
          <span className="text-sm font-medium text-content-primary min-w-32 text-center">{monthName} {year}</span>
          <Button variant="secondary" size="sm" onClick={nextMonth}>→</Button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <SummaryPill label="Total" value={data.summary.total} />
          <SummaryPill label="Total Hours" value={(data.totalHours ?? 0) as any} color="brand" />
          <SummaryPill label="Present" value={data.summary.present} color="green" />
          <SummaryPill label="Absent" value={data.summary.absent} color="red" />
          <SummaryPill label="Half Day" value={data.summary.halfDay} color="yellow" />
          <SummaryPill label="Leave" value={data.summary.leave} color="orange" />
          <SummaryPill label="WFH" value={data.summary.wfh} color="blue" />
          <SummaryPill label="Holiday" value={data.summary.holiday} color="purple" />
        </div>
      )}

      <Card padding="lg">
        <div className="grid grid-cols-7 gap-2 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-xs font-medium text-content-tertiary pb-2">{d}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hrs = data?.dailyHours?.[dateKey];
            const status = recordMap.get(day) ?? (hrs && hrs > 0 ? 'PRESENT' : null);
            const style = status ? STATUS_STYLE[status as AttendanceStatus] : null;
            return (
              <div key={day}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm border ${style ? `${style.bg} border-transparent` : 'bg-surface-50 border-surface-200 text-content-tertiary'}`}
                title={hrs != null ? `${day} — ${hrs}h worked` : undefined}>
                <span className="font-medium">{day}</span>
                {style && <span className="text-[10px] font-bold mt-0.5">{style.short}</span>}
                {hrs != null && hrs > 0 && <span className="text-[10px] font-semibold mt-0.5 opacity-90">{hrs}h</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-3 border-b border-surface-200 bg-surface-50">
          <h3 className="text-sm font-semibold text-content-primary">Records ({dayKeys.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100">
              {['Date', 'Status', 'Clock In', 'Clock Out', 'Hours', 'Notes'].map((h) => (
                <th key={h} className="text-left px-4 py-2 font-medium text-content-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-content-tertiary">Loading…</td></tr>
            ) : dayKeys.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-content-tertiary">No records for this month.</td></tr>
            ) : (
              dayKeys.map((key) => {
                const rec = recByKey.get(key);
                const sess = data?.dailySessions?.[key];
                const hrs = data?.dailyHours?.[key];
                const status = rec?.status ?? (hrs && hrs > 0 ? 'PRESENT' : null);
                const style = status ? STATUS_STYLE[status] : null;
                // Time-log sessions are the source of truth for web clock-in/out;
                // fall back to the attendance record's stored times.
                const clockIn = sess?.clockIn ?? rec?.checkIn;
                const clockOut = sess ? sess.clockOut : rec?.checkOut;
                const ongoing = !!sess && sess.clockOut === null;
                // Overnight shift — clock-out lands on the next calendar day (IST)
                const overnight = !!clockIn && !!clockOut &&
                  new Date(clockIn).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) !==
                  new Date(clockOut).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                return (
                  <tr key={key}>
                    <td className="px-4 py-2 text-content-secondary">
                      {new Date(key).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', weekday: 'short' })}
                    </td>
                    <td className="px-4 py-2">{style ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${style.bg}`}>{style.label}</span> : <span className="text-content-tertiary text-xs">—</span>}</td>
                    <td className="px-4 py-2 text-content-secondary text-xs">{clockIn ? new Date(clockIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'}</td>
                    <td className="px-4 py-2 text-content-secondary text-xs">
                      {ongoing
                        ? <span className="inline-block px-1.5 py-0.5 rounded bg-success-light text-success-dark font-medium">working…</span>
                        : clockOut ? (
                            <>
                              {new Date(clockOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                              {overnight && <sup className="ml-0.5 text-[9px] font-semibold text-warning-dark" title="Clock-out on the next day">+1</sup>}
                            </>
                          ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-content-secondary text-xs tabular-nums">{hrs != null ? `${hrs}h` : (rec?.workHours ?? '—')}</td>
                    <td className="px-4 py-2 text-content-tertiary text-xs">{rec?.notes ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SummaryPill({ label, value, color = 'gray' }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-surface-50 border-surface-200 text-content-secondary',
    green: 'bg-success-light border-success-light text-success-dark',
    red: 'bg-danger-light border-danger-light text-danger-dark',
    yellow: 'bg-warning-light border-warning-light text-warning-dark',
    orange: 'bg-warning-light border-warning-light text-warning-dark',
    blue: 'bg-brand-50 border-brand-50 text-brand-700',
    purple: 'bg-brand-50 border-brand-50 text-brand-700',
  };
  return (
    <div className={`rounded-lg border p-2 text-center ${colorMap[color]}`}>
      <p className="text-[10px] font-medium opacity-75 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
