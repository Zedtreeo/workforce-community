// apps/web/src/app/attendance/_components/AuditHistoryModal.tsx
'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button, Badge } from '../../../components/ui';
import { apiFetch } from '../../../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  userId: string | null;
  changes: any;
  ipAddress: string | null;
  createdAt: string;
}

export function AuditHistoryModal({
  open,
  onClose,
  attendanceId,
}: {
  open: boolean;
  onClose: () => void;
  attendanceId: string | null;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !attendanceId) return;
    setLoading(true);
    apiFetch<AuditEntry[]>(`/attendance/${attendanceId}/audit`)
      .then(setEntries)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [open, attendanceId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change history"
      description={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {loading && <div className="text-sm text-content-tertiary">Loading…</div>}
      {!loading && entries.length === 0 && (
        <div className="text-sm text-content-tertiary text-center py-6">
          No change history yet.
        </div>
      )}
      <div className="space-y-3">
        {entries.map((e) => {
          const before = e.changes?.before;
          const after = e.changes?.after;
          const reason = e.changes?.reason;
          const fieldsChanged: string[] = [];
          if (before && after) {
            for (const k of Object.keys(after)) {
              if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) fieldsChanged.push(k);
            }
          }
          return (
            <div key={e.id} className="rounded-lg border border-surface-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <Badge variant={e.action === 'UPDATE' ? 'warning' : 'info'} dot>
                  {e.action}
                </Badge>
                <span className="text-xs text-content-tertiary">
                  {new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
              </div>
              {reason && (
                <div className="text-sm mb-2">
                  <span className="text-content-tertiary">Reason:</span> {reason}
                </div>
              )}
              {fieldsChanged.length > 0 && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-content-tertiary">
                      <th className="text-left py-1 pr-2">Field</th>
                      <th className="text-left py-1 pr-2">Before</th>
                      <th className="text-left py-1">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldsChanged.map((f) => (
                      <tr key={f} className="border-t border-surface-100">
                        <td className="py-1 pr-2 font-medium">{f}</td>
                        <td className="py-1 pr-2 text-content-tertiary">
                          {JSON.stringify(before[f]) ?? '—'}
                        </td>
                        <td className="py-1">{JSON.stringify(after[f]) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="text-xs text-content-tertiary mt-2">
                By {e.userId ?? 'system'}{e.ipAddress ? ` · ${e.ipAddress}` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
