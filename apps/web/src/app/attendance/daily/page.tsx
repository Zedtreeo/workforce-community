// REPLACEMENT for apps/web/src/app/attendance/page.tsx
//
// Adds:
//   • Import CSV button in PageHeader actions
//   • Click any row's "Rectify" link to open RectifyAttendanceModal
//   • From Rectify modal, click "View changes" to open AuditHistoryModal
//
// Everything else from the original page preserved.

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, StatCard, Badge, PageSkeleton, DataTable, DatePicker, PageHeader } from '../../../components/ui';
import type { Column } from '../../../components/ui';
import { CalendarClock, Users, UserCheck, UserX, Clock, Coffee, ArrowRight, Upload, Edit3 } from 'lucide-react';

import { AttendanceImportModal } from '../_components/AttendanceImportModal';
import { RectifyAttendanceModal } from '../_components/RectifyAttendanceModal';
import { AuditHistoryModal } from '../_components/AuditHistoryModal';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'WFH';

interface DailyRow {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    designation?: string;
    department?: { id: string; name: string } | null;
  };
  attendance: {
    id: string;
    status: AttendanceStatus;
    checkIn?: string | null;
    checkOut?: string | null;
    notes?: string | null;
    source?: string;
  } | null;
}

interface DailyResponse {
  date: string;
  rows: DailyRow[];
  summary: {
    total: number; present: number; absent: number;
    halfDay: number; leave: number; wfh: number; unmarked: number;
  };
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'PRESENT',  label: 'P',   activeClass: 'bg-success text-white border-success' },
  { value: 'ABSENT',   label: 'A',   activeClass: 'bg-danger text-white border-danger' },
  { value: 'HALF_DAY', label: 'HD',  activeClass: 'bg-warning text-white border-warning' },
  { value: 'LEAVE',    label: 'L',   activeClass: 'bg-orange-500 text-white border-orange-500' },
  { value: 'WFH',      label: 'WFH', activeClass: 'bg-info text-white border-info' },
  { value: 'HOLIDAY',  label: 'H',   activeClass: 'bg-brand-500 text-white border-brand-500' },
];

const STATUS_BADGE_MAP: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'brand' | 'default'> = {
  PRESENT: 'success', ABSENT: 'danger', HALF_DAY: 'warning',
  LEAVE: 'warning',   WFH: 'info',     HOLIDAY: 'brand',
};

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function hhmm(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const [date, setDate] = useState(getTodayISO());
  const [sheet, setSheet] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Record<string, AttendanceStatus>>({});

  // Modal state
  const [importOpen, setImportOpen] = useState(false);
  const [rectifyTarget, setRectifyTarget] = useState<any>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const fetchSheet = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setPending({});
    try {
      const res = await apiFetch<DailyResponse>(`/attendance/daily?date=${date}`);
      setSheet(res);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [session, date]);

  useEffect(() => { fetchSheet(); }, [fetchSheet]);

  const handleMark = (employeeId: string, status: AttendanceStatus) => {
    setPending((prev) => ({ ...prev, [employeeId]: status }));
  };
  const getCurrentStatus = (row: DailyRow): AttendanceStatus | null =>
    pending[row.employee.id] ?? row.attendance?.status ?? null;

  const handleSaveAll = async () => {
    if (Object.keys(pending).length === 0) return;
    setSaving(true);
    try {
      const entries = Object.entries(pending).map(([employeeId, status]) => ({ employeeId, status }));
      await apiFetch('/attendance/bulk', { method: 'POST', body: JSON.stringify({ date, entries }) });
      await fetchSheet();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    if (!sheet) return;
    const updates: Record<string, AttendanceStatus> = {};
    for (const row of sheet.rows) if (getCurrentStatus(row) !== status) updates[row.employee.id] = status;
    setPending((prev) => ({ ...prev, ...updates }));
  };

  const openRectify = (row: DailyRow) => {
    if (!row.attendance) return; // can't rectify a row that doesn't exist
    setRectifyTarget({
      attendanceId: row.attendance.id,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
      date,
      current: {
        status: row.attendance.status,
        checkIn: hhmm(row.attendance.checkIn),
        checkOut: hhmm(row.attendance.checkOut),
        notes: row.attendance.notes ?? null,
        source: row.attendance.source ?? 'MANUAL',
      },
    });
  };

  const pendingCount = Object.keys(pending).length;

  const columns: Column<DailyRow>[] = [
    {
      key: 'employee', header: 'Employee',
      render: (row) => (
        <div>
          <p className="font-medium text-content-primary">
            {row.employee.firstName} {row.employee.lastName}
          </p>
          <p className="text-xs text-content-tertiary">
            {row.employee.employeeCode} · {row.employee.designation ?? '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'department', header: 'Department', className: 'text-content-secondary text-xs',
      render: (row) => <>{row.employee.department?.name ?? '—'}</>,
    },
    {
      key: 'markStatus', header: 'Mark Status',
      render: (row) => {
        const current = getCurrentStatus(row);
        return (
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => {
              const active = current === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={(e) => { e.stopPropagation(); handleMark(row.employee.id, opt.value); }}
                  className={`w-9 h-7 text-xs font-bold rounded-md border transition-all duration-150 ${
                    active ? opt.activeClass : 'bg-white border-surface-200 text-content-tertiary hover:bg-surface-50 hover:border-surface-300'
                  }`}
                  title={opt.value.replace('_', ' ')}
                >{opt.label}</button>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'current', header: 'Current',
      render: (row) => {
        const current = getCurrentStatus(row);
        const isDirty = pending[row.employee.id] !== undefined;
        if (!current) return <span className="text-xs text-content-tertiary">Unmarked</span>;
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={STATUS_BADGE_MAP[current] || 'default'} dot>
              {current.replace('_', ' ')}
            </Badge>
            {row.attendance?.source && (
              <code className="text-[10px] px-1 rounded bg-surface-100 text-content-tertiary">
                {row.attendance.source}
              </code>
            )}
            {isDirty && <span className="text-brand-500 text-xs">*</span>}
          </div>
        );
      },
    },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          {row.attendance && (
            <button
              onClick={(e) => { e.stopPropagation(); openRectify(row); }}
              className="inline-flex items-center gap-1 text-content-secondary hover:text-brand-600 text-xs font-medium transition-colors"
              title="Edit with reason"
            >
              <Edit3 size={12} /> Rectify
            </button>
          )}
          <Link
            href={`/attendance/${row.employee.id}`}
            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs font-medium transition-colors"
          >
            History <ArrowRight size={12} />
          </Link>
        </div>
      ),
    },
  ];

  if (loading && !sheet) {
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
          title="Attendance"
          description={sheet ? `${sheet.summary.total} active employees` : 'Loading...'}
          breadcrumbs={[{ label: 'Attendance' }]}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload size={14} /> Import CSV
              </Button>
              <DatePicker value={date} onChange={(e) => setDate(e.target.value)} />
              <Button variant="secondary" size="sm" onClick={() => setDate(getTodayISO())}>Today</Button>
            </div>
          }
        />

        {sheet && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total" value={sheet.summary.total} icon={<Users />} />
            <StatCard label="Present" value={sheet.summary.present}
              change={`${sheet.summary.total > 0 ? Math.round((sheet.summary.present / sheet.summary.total) * 100) : 0}%`}
              changeType="positive" icon={<UserCheck />} />
            <StatCard label="Absent" value={sheet.summary.absent} changeType="negative" icon={<UserX />} />
            <StatCard label="Half Day" value={sheet.summary.halfDay} icon={<Clock />} />
            <StatCard label="Leave" value={sheet.summary.leave} icon={<Coffee />} />
            <StatCard label="Unmarked" value={sheet.summary.unmarked} icon={<CalendarClock />} />
          </div>
        )}

        <Card padding="none">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-content-tertiary">Mark all:</span>
              {STATUS_OPTIONS.slice(0, 5).map((opt) => (
                <Button key={opt.value} variant="secondary" size="xs" onClick={() => handleMarkAll(opt.value)}>
                  {opt.value.replace('_', ' ')}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {pendingCount > 0 && (
                <span className="text-xs text-brand-600 font-medium">
                  {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''}
                </span>
              )}
              <Button onClick={handleSaveAll} disabled={pendingCount === 0} loading={saving} size="sm">
                Save{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Button>
            </div>
          </div>
        </Card>

        <DataTable<DailyRow>
          columns={columns}
          data={sheet?.rows ?? []}
          rowKey={(row) => row.employee.id}
          loading={loading}
          loadingRows={8}
          compact
          emptyMessage="No active employees."
          emptyIcon={<Users />}
        />
      </div>

      {/* Modals */}
      <AttendanceImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCommitted={fetchSheet}
      />
      <RectifyAttendanceModal
        open={!!rectifyTarget}
        target={rectifyTarget}
        onClose={() => setRectifyTarget(null)}
        onSaved={fetchSheet}
        onViewHistory={(id) => { setHistoryId(id); }}
      />
      <AuditHistoryModal
        open={!!historyId}
        onClose={() => setHistoryId(null)}
        attendanceId={historyId}
      />
    </DashboardLayout>
  );
}
