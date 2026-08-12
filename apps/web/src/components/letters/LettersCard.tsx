// apps/web/src/components/letters/LettersCard.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Badge } from '../../components/ui';
import { FileText, Plus, Download, Mail, ChevronDown, Upload, Eye, Trash2, FileSignature } from 'lucide-react';
import { API_BASE, apiFetch, apiUpload } from '../../lib/api';
import { LetterGenerateDialog } from './LetterGenerateDialog';

type LetterType = 'OFFER_LETTER' | 'APPOINTMENT_LETTER' | 'EXPERIENCE_LETTER' | 'CLIENT_AGREEMENT';

interface GeneratedRow {
  id: string;
  type: LetterType;
  referenceNo?: string | null;
  fileName: string;
  pdfPath?: string | null;
  hasSignedCopy?: boolean;
  status: string;
  generatedAt: string;
  sentAt?: string | null;
  sentTo?: string | null;
  template?: { name: string };
}

const TYPE_LABEL: Record<LetterType, string> = {
  OFFER_LETTER:       'Offer Letter',
  APPOINTMENT_LETTER: 'Appointment Letter',
  EXPERIENCE_LETTER:  'Experience & Relieving',
  CLIENT_AGREEMENT:   'Service Agreement',
};

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  DRAFT: 'default', SENT: 'info', ACCEPTED: 'success', REJECTED: 'danger', VOIDED: 'warning',
};

interface Props {
  /** "employee" page → enable Offer/Appointment/Experience based on state.
   *  "client" page → enable Agreement only. */
  scope: 'employee' | 'client';
  employeeId?: string;
  clientId?: string;
  assignmentId?: string;
  /** Used to gate Appointment/Experience buttons. */
  state?: {
    onboardingStatus?: string;
    hasPortalAccess?: boolean;
    exitDate?: string | null;
    hasActiveAssignment?: boolean;
  };
}

export function LettersCard({ scope, employeeId, clientId, assignmentId, state }: Props) {
  const [rows, setRows] = useState<GeneratedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogType, setDialogType] = useState<LetterType | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (employeeId) qs.set('employeeId', employeeId);
      if (clientId)   qs.set('clientId', clientId);
      const res = await apiFetch<GeneratedRow[]>(`/letters/history?${qs.toString()}`);
      setRows(res);
    } finally { setLoading(false); }
  }, [employeeId, clientId]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSend = async (r: GeneratedRow) => {
    const to = window.prompt('Send agreement to which email?', r.sentTo || '');
    if (!to) return;
    setBusyId(r.id);
    try {
      await apiFetch(`/letters/${r.id}/send`, { method: 'POST', body: JSON.stringify({ to, attachAs: 'pdf' }) });
      await fetchRows();
      alert(`Sent to ${to}.`);
    } catch (e: any) {
      alert(e.message || 'Send failed');
    } finally { setBusyId(null); }
  };

  const handleDelete = async (r: GeneratedRow) => {
    if (r.status === 'ACCEPTED') {
      alert('This agreement has a counter-signed copy and cannot be deleted. Mark it Voided instead.');
      return;
    }
    if (!window.confirm(
      `Delete ${TYPE_LABEL[r.type]} ${r.referenceNo ?? ''}?\n\nThis removes the document so you can generate a fresh one if the client needs changes. This cannot be undone.`
    )) return;
    setBusyId(r.id);
    try {
      await apiFetch(`/letters/${r.id}`, { method: 'DELETE' });
      await fetchRows();
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    } finally { setBusyId(null); }
  };

  const handleUploadSigned = async (r: GeneratedRow, file: File) => {
    setBusyId(r.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await apiUpload(`/letters/${r.id}/upload-signed`, fd);
      await fetchRows();
      alert('Signed copy uploaded — marked Accepted.');
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    } finally { setBusyId(null); }
  };

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const canOffer       = scope === 'employee';
  const canAppointment = scope === 'employee' && state?.onboardingStatus === 'COMPLETED' && state?.hasPortalAccess === true;
  const canExperience  = scope === 'employee' && Boolean(state?.exitDate);
  const canAgreement   = scope === 'client' || (scope === 'employee' && state?.hasActiveAssignment === true);

  const buttons: Array<{ type: LetterType; label: string; enabled: boolean; reason?: string }> = scope === 'employee'
    ? [
        { type: 'OFFER_LETTER',       label: 'Offer Letter',         enabled: canOffer },
        { type: 'APPOINTMENT_LETTER', label: 'Appointment Letter',   enabled: canAppointment, reason: 'Requires onboarding completed + portal access' },
        { type: 'EXPERIENCE_LETTER',  label: 'Experience & Relieving', enabled: canExperience, reason: 'Requires exit date set' },
        { type: 'CLIENT_AGREEMENT',   label: 'Service Agreement',    enabled: canAgreement,  reason: 'Requires active assignment' },
      ]
    : [
        { type: 'CLIENT_AGREEMENT',   label: 'Service Agreement',    enabled: canAgreement },
      ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-content-primary flex items-center gap-2">
            <FileText size={16} /> Documents
          </h3>
          <p className="text-xs text-content-tertiary">Generate and track letters for this {scope}</p>
        </div>
        <div className="relative">
          <Button onClick={() => setMenuOpen(!menuOpen)} className="gap-1.5">
            <Plus size={14} /> Generate <ChevronDown size={14} />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-64 rounded-lg border border-surface-200 bg-white shadow-overlay z-40">
              {buttons.map((b) => (
                <button
                  key={b.type}
                  disabled={!b.enabled}
                  onClick={() => { setMenuOpen(false); setDialogType(b.type); }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between
                    ${b.enabled ? 'hover:bg-surface-50 text-content-primary' : 'text-content-tertiary cursor-not-allowed'}`}
                  title={!b.enabled ? b.reason : undefined}
                >
                  <span>{b.label}</span>
                  {!b.enabled && <span className="text-[10px]">locked</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-content-tertiary py-4 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-content-tertiary py-6 text-center">
          No letters generated yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-content-tertiary border-b border-surface-100">
            <tr>
              <th className="text-left py-1.5">Type</th>
              <th className="text-left py-1.5">Reference</th>
              <th className="text-left py-1.5">Generated</th>
              <th className="text-left py-1.5">Status</th>
              <th className="text-right py-1.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0">
                <td className="py-2">{TYPE_LABEL[r.type]}</td>
                <td className="py-2"><code className="text-xs">{r.referenceNo ?? '—'}</code></td>
                <td className="py-2 text-content-tertiary">
                  {new Date(r.generatedAt).toLocaleDateString()}
                  {r.sentTo && <div className="text-[10px]">→ {r.sentTo}</div>}
                </td>
                <td className="py-2"><Badge variant={STATUS_VARIANT[r.status] || 'default'} dot>{r.status}</Badge></td>
                <td className="py-2 text-right">
                  <a
                    href={`${API_BASE}/letters/${r.id}/download?format=pdf&disposition=inline`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Preview PDF (opens in new tab)"
                    className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary"
                  >
                    <Eye size={14} />
                  </a>
                  <a
                    href={`${API_BASE}/letters/${r.id}/download?format=pdf`}
                    title="Download PDF"
                    className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary ml-1"
                  >
                    <Download size={14} />
                  </a>
                  <a
                    href={`${API_BASE}/letters/${r.id}/download?format=docx`}
                    title="Download DOCX"
                    className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary ml-1"
                  >
                    <FileText size={14} />
                  </a>
                  {r.hasSignedCopy && (
                    <a
                      href={`${API_BASE}/letters/${r.id}/download?format=signed`}
                      title="Download signed copy"
                      className="inline-flex p-1.5 rounded hover:bg-green-50 text-green-600 ml-1"
                    >
                      <FileSignature size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => handleSend(r)}
                    disabled={busyId === r.id}
                    title="Send to client"
                    className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary ml-1 disabled:opacity-40"
                  >
                    <Mail size={14} />
                  </button>
                  <label
                    title="Upload client-signed copy"
                    className="inline-flex p-1.5 rounded hover:bg-surface-50 text-content-secondary ml-1 cursor-pointer"
                  >
                    <Upload size={14} />
                    <input
                      type="file"
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                      className="hidden"
                      disabled={busyId === r.id}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadSigned(r, f); e.currentTarget.value = ''; }}
                    />
                  </label>
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={busyId === r.id || r.status === 'ACCEPTED'}
                    title={r.status === 'ACCEPTED' ? 'Signed agreements cannot be deleted — Void instead' : 'Delete'}
                    className="inline-flex p-1.5 rounded hover:bg-danger-light text-content-secondary hover:text-danger-dark ml-1 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-content-secondary"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogType && (
        <LetterGenerateDialog
          open={!!dialogType}
          onClose={() => setDialogType(null)}
          type={dialogType}
          employeeId={employeeId}
          clientId={clientId}
          assignmentId={assignmentId}
          onGenerated={() => fetchRows()}
        />
      )}
    </Card>
  );
}
