'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '../../../../lib/auth-client';
import { apiFetch } from '../../../../lib/api';
import { DashboardLayout } from '../../../../components/dashboard-layout';
import { StatCard, Badge, Button, Card, PageSkeleton } from '../../../../components/ui';
import { todayIST, fmtTimeIST, istHour as istHourTZ } from '../../../../lib/ist-dates';

/* ── Types ── */
interface Snapshot {
  id: string;
  capturedAt: string;
  screenshotUrl?: string;
  thumbnailUrl?: string;
  activityPercent: number;
  keystrokes: number;
  mouseClicks: number;
  mouseMovements: number;
  activeApp?: string;
  activeTitle?: string;
  isIdle: boolean;
}

interface TimelineData {
  date: string;
  employeeId: string;
  summary: {
    totalSnapshots: number;
    avgActivity: number;
    totalKeystrokes: number;
    totalClicks: number;
    idleSnapshots: number;
    totalWorkSeconds: number;
    totalWorkHours: number;
  };
  hourlyActivity: { hour: number; avgPercent: number; count: number }[];
  timeLogs: any[];
  snapshots: Snapshot[];
}

/* ── Helpers ── */
function fmtTime(iso: string) {
  // IST display — see lib/ist-dates
  return fmtTimeIST(iso);
}

function hhmm(hours: number): string {
  const t = Math.max(0, Math.round((hours || 0) * 60));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ActivityBadge({ percent, isIdle }: { percent: number; isIdle: boolean }) {
  if (isIdle) return <Badge variant="danger">Idle</Badge>;
  return <Badge variant={percent >= 70 ? 'success' : percent >= 40 ? 'warning' : 'danger'}>{percent}%</Badge>;
}

/* ── Screenshot Gallery ── */
function ScreenshotGallery({ snapshots }: { snapshots: Snapshot[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = snapshots.find((s) => s.id === selectedId) || null;

  // Group snapshots by hour
  const grouped: Record<string, Snapshot[]> = {};
  snapshots.forEach((s) => {
    const hour = istHourTZ(s.capturedAt);
    const label =
      hour === 0 ? '12 AM' :
      hour < 12 ? `${hour} AM` :
      hour === 12 ? '12 PM' :
      `${hour - 12} PM`;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(s);
  });

  if (snapshots.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-content-tertiary">No screenshots for this date</div>
      </Card>
    );
  }

  return (
    <>
      {/* ── Lightbox modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200 bg-surface-50">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold text-content-primary">{fmtTime(selected.capturedAt)}</span>
                <ActivityBadge percent={selected.activityPercent} isIdle={selected.isIdle} />
                <span className="text-sm text-content-secondary truncate">{selected.activeApp || 'Unknown App'}</span>
                {selected.activeTitle && (
                  <span className="text-xs text-content-tertiary truncate max-w-[300px] hidden md:inline">&mdash; {selected.activeTitle}</span>
                )}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-3 text-xs text-content-tertiary">
                  <span title="Keystrokes">⌨ {selected.keystrokes}</span>
                  <span title="Clicks">🖱 {selected.mouseClicks}</span>
                  <span title="Movements">↔ {selected.mouseMovements}</span>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="ml-2 text-content-tertiary hover:text-content-primary transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Image */}
            <div className="flex items-center justify-center bg-surface-100" style={{ maxHeight: 'calc(90vh - 110px)' }}>
              {selected.screenshotUrl ? (
                <img
                  src={selected.screenshotUrl}
                  alt={`Screenshot at ${fmtTime(selected.capturedAt)}`}
                  className="max-w-full max-h-[calc(90vh-120px)] object-contain"
                />
              ) : (
                <div className="text-content-tertiary py-24">No image available</div>
              )}
            </div>
            {/* Prev / Next */}
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-surface-200 bg-surface-50">
              <button
                className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-content-tertiary disabled:cursor-not-allowed"
                disabled={snapshots.indexOf(selected) === 0}
                onClick={() => {
                  const idx = snapshots.indexOf(selected);
                  if (idx > 0) setSelectedId(snapshots[idx - 1].id);
                }}
              >
                ◀ Previous
              </button>
              <span className="text-xs text-content-tertiary">
                {snapshots.indexOf(selected) + 1} of {snapshots.length}
              </span>
              <button
                className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:text-content-tertiary disabled:cursor-not-allowed"
                disabled={snapshots.indexOf(selected) === snapshots.length - 1}
                onClick={() => {
                  const idx = snapshots.indexOf(selected);
                  if (idx < snapshots.length - 1) setSelectedId(snapshots[idx + 1].id);
                }}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Gallery grouped by hour ── */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([hour, snaps]) => (
          <div key={hour}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-content-secondary">{hour}</h3>
              <span className="text-xs text-content-tertiary">
                ({snaps.length} screenshot{snaps.length !== 1 ? 's' : ''})
              </span>
              <div className="flex-1 h-px bg-surface-200" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {snaps.map((snap) => {
                const borderColor =
                  snap.isIdle ? 'border-red-300' :
                  snap.activityPercent >= 70 ? 'border-green-300' :
                  snap.activityPercent >= 40 ? 'border-yellow-300' :
                  'border-red-300';
                return (
                  <div
                    key={snap.id}
                    className={`group relative bg-white rounded-lg border-2 ${borderColor} overflow-hidden cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200`}
                    onClick={() => setSelectedId(snap.id)}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-surface-100 flex items-center justify-center overflow-hidden">
                      {snap.thumbnailUrl ? (
                        <img
                          src={snap.thumbnailUrl}
                          alt={`Screenshot at ${fmtTime(snap.capturedAt)}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : snap.isIdle ? (
                        <div className="text-center px-2">
                          <div className="text-lg opacity-50">💤</div>
                          <div className="text-[11px] text-content-tertiary mt-0.5">Idle period</div>
                          <div className="text-[10px] text-content-tertiary">screenshot skipped</div>
                        </div>
                      ) : (
                        <div className="text-center px-2">
                          <div className="text-lg opacity-50">⚠️</div>
                          <div className="text-[11px] text-content-tertiary">Capture failed</div>
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-content-primary">{fmtTime(snap.capturedAt)}</span>
                        <ActivityBadge percent={snap.activityPercent} isIdle={snap.isIdle} />
                      </div>
                      <p className="text-[11px] text-content-tertiary truncate">
                        {snap.activeApp || 'Unknown'}
                      </p>
                      <div className="flex gap-2 text-[10px] text-content-tertiary">
                        <span>⌨ {snap.keystrokes}</span>
                        <span>🖱 {snap.mouseClicks}</span>
                      </div>
                    </div>
                    {/* Hover expand icon */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Hourly Activity Bar Chart ── */
function HourlyChart({ data }: { data: { hour: number; avgPercent: number; count: number }[] }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-content-secondary mb-4">Hourly Activity</h2>
      <div className="flex items-end gap-1" style={{ height: '120px' }}>
        {Array.from({ length: 24 }, (_, h) => {
          const entry = data.find((d) => d.hour === h);
          const pct = entry?.avgPercent ?? 0;
          const height = pct > 0 ? Math.max(pct, 5) : 0;
          const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : pct > 0 ? 'bg-danger' : 'bg-surface-100';
          return (
            <div
              key={h}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${h}:00 — ${pct}% (${entry?.count ?? 0} snapshots)`}
            >
              <div className="w-full flex items-end" style={{ height: '100px' }}>
                <div className={`w-full rounded-t ${color}`} style={{ height: `${height}%` }} />
              </div>
              <span className="text-[10px] text-content-tertiary">{h}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-content-tertiary">
        <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
      </div>
    </Card>
  );
}

/* ── Time Logs Table ── */
function TimeLogsTable({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <Card padding="none">
        <div className="text-center py-8 text-content-tertiary">No time logs for this date</div>
      </Card>
    );
  }
  return (
    <Card padding="none">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-50 border-b border-surface-200">
            <th className="text-left px-5 py-3 font-medium text-content-secondary">Clock In</th>
            <th className="text-left px-5 py-3 font-medium text-content-secondary">Clock Out</th>
            <th className="text-left px-5 py-3 font-medium text-content-secondary">Duration</th>
            <th className="text-left px-5 py-3 font-medium text-content-secondary">Source</th>
            <th className="text-left px-5 py-3 font-medium text-content-secondary">Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-b border-surface-100">
              <td className="px-5 py-3 font-medium">{fmtTime(log.clockIn)}</td>
              <td className="px-5 py-3">
                {log.clockOut ? fmtTime(log.clockOut) : <span className="text-success-dark font-medium">● Active</span>}
              </td>
              <td className="px-5 py-3 text-content-secondary">{log.duration ? fmtDuration(log.duration) : '—'}</td>
              <td className="px-5 py-3"><Badge>{log.source.replace('_', ' ')}</Badge></td>
              <td className="px-5 py-3 text-content-tertiary">{log.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ── Main page ── */
export default function EmployeeTimelinePage() {
  return (
    <Suspense fallback={<DashboardLayout><PageSkeleton /></DashboardLayout>}>
      <TimelineContent />
    </Suspense>
  );
}

function TimelineContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data } = useSession();
  const employeeId = params.employeeId as string;

  const [date, setDate] = useState(() => searchParams.get('date') || todayIST());
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'timeline' | 'screenshots'>('screenshots');

  const fetchTimeline = useCallback(async () => {
    if (!data?.session?.id) return;
    setLoading(true);
    try {
      const res = await apiFetch<TimelineData>(`/monitoring/timeline/${employeeId}?date=${date}`);
      setTimeline(res);
    } catch (e) {
      console.error('Failed to fetch timeline:', e);
    } finally {
      setLoading(false);
    }
  }, [data, employeeId, date]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/attendance/screenshots" className="text-sm text-content-tertiary hover:text-content-secondary">
              ← Back to Team
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-content-primary">Employee Timeline</h1>
              <p className="text-sm text-content-tertiary mt-0.5">Activity detail for {date}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary" size="sm"
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d.toISOString().split('T')[0]);
              }}
            >
              ◀ Prev
            </Button>
            <input
              type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <Button
              variant="secondary" size="sm"
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d.toISOString().split('T')[0]);
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : timeline ? (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard label="Logged Hours" value={`${timeline.summary.totalWorkHours}h`} />
              <StatCard
                label="Active Hours"
                value={`${((timeline.summary as any).activeWorkHours ?? 0).toFixed(2)}h`}
              />
              <StatCard
                label="Avg Activity"
                value={`${timeline.summary.avgActivity}%`}
                changeType={timeline.summary.avgActivity >= 60 ? 'positive' : 'negative'}
              />
              <StatCard label="Screenshots" value={String(timeline.summary.totalSnapshots)} />
              <StatCard label="Keystrokes" value={timeline.summary.totalKeystrokes.toLocaleString()} />
              <StatCard label="Mouse Clicks" value={timeline.summary.totalClicks.toLocaleString()} />
              <StatCard
                label="Idle Time"
                value={hhmm(Math.max(0, (timeline.summary.totalWorkHours || 0) - (((timeline.summary as any).activeWorkHours) || 0)))}
                changeType={timeline.summary.idleSnapshots > 5 ? 'negative' : 'neutral'}
              />
            </div>

            {/* Hourly chart */}
            <HourlyChart data={timeline.hourlyActivity} />

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setTab('screenshots')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'screenshots' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
                }`}
              >
                Screenshots ({timeline.snapshots.length})
              </button>
              <button
                onClick={() => setTab('timeline')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'timeline' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-content-secondary hover:bg-surface-200'
                }`}
              >
                Check-in / Out ({timeline.timeLogs.length})
              </button>
            </div>

            {/* Tab content */}
            {tab === 'screenshots' && <ScreenshotGallery snapshots={timeline.snapshots} />}
            {tab === 'timeline' && <TimeLogsTable logs={timeline.timeLogs} />}
          </>
        ) : (
          <div className="text-center py-12 text-content-tertiary">No data available</div>
        )}
      </div>
    </DashboardLayout>
  );
}
