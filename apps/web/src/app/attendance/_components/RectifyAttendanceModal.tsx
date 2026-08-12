// apps/web/src/app/attendance/_components/RectifyAttendanceModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button, Select, FormField, Input } from '../../../components/ui';
import { History, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../../lib/api';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'WFH';

interface RectifyTarget {
  attendanceId: string;          // existing Attendance row id
  employeeName: string;
  date: string;                   // YYYY-MM-DD
  current: {
    status: AttendanceStatus;
    checkIn: string | null;       // HH:MM
    checkOut: string | null;
    notes: string | null;
    source: string;
  };
}

const STATUSES: AttendanceStatus[] = [
  'PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKEND', 'WFH',
];

export function RectifyAttendanceModal({
  open,
  target,
  onClose,
  onSaved,
  onViewHistory,
}: {
  open: boolean;
  target: RectifyTarget | null;
  onClose: () => void;
  onSaved?: () => void;
  onViewHistory?: (attendanceId: string) => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setStatus(target.current.status);
      setCheckIn(target.current.checkIn ?? '');
      setCheckOut(target.current.checkOut ?? '');
      setNotes(target.current.notes ?? '');
      setReason('');
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  const handleSave = async () => {
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Convert HH:MM (local-day) → full ISO using the row's date
      const toIso = (hhmm: string) =>
        hhmm ? new Date(`${target.date}T${hhmm}:00.000Z`).toISOString() : undefined;

      await apiFetch(`/attendance/${target.attendanceId}/rectify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          checkIn: toIso(checkIn),
          checkOut: toIso(checkOut),
          notes: notes || undefined,
          reason: reason.trim(),
        }),
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rectify attendance"
      description={`${target.employeeName} · ${target.date}`}
      size="lg"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onViewHistory?.(target.attendanceId)}
            className="gap-1.5 mr-auto"
          >
            <History size={14} /> View changes
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={busy} disabled={busy}>
            Save with reason
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="text-xs text-content-tertiary">
          Current source: <code className="px-1.5 py-0.5 bg-surface-100 rounded">{target.current.source}</code>
          {' · saving will mark this row as MANUAL and write to the audit log'}
        </div>

        <FormField label="Status" required>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            options={STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Check-in (HH:MM)">
            <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </FormField>
          <FormField label="Check-out (HH:MM)">
            <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Notes (optional)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </FormField>

        <FormField label="Reason for change" required error={reason.length > 0 && reason.length < 5 ? 'Min 5 characters' : undefined}>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Biometric outage — verified with security log"
            maxLength={500}
          />
        </FormField>
      </div>
    </Modal>
  );
}
