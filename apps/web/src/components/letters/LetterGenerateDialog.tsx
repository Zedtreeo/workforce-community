// apps/web/src/components/letters/LetterGenerateDialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button, FormField, Input, Select } from '../../components/ui';
import { Loader2, AlertCircle, Download, Mail, FileText, CheckCircle2, Eye } from 'lucide-react';
import { API_BASE, apiFetch } from '../../lib/api';

type LetterType = 'OFFER_LETTER' | 'APPOINTMENT_LETTER' | 'EXPERIENCE_LETTER' | 'CLIENT_AGREEMENT';

interface EditableField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

interface PreviewResp {
  template: { id: string; name: string; type: LetterType };
  data: any;
  editableFields: EditableField[];
}

interface GeneratedRow {
  id: string;
  type: LetterType;
  referenceNo?: string | null;
  fileName: string;
  pdfPath?: string | null;
  status: string;
  generatedAt: string;
}

const TYPE_LABEL: Record<LetterType, string> = {
  OFFER_LETTER:       'Offer Letter',
  APPOINTMENT_LETTER: 'Appointment Letter',
  EXPERIENCE_LETTER:  'Experience & Relieving Letter',
  CLIENT_AGREEMENT:   'Service Agreement',
};

interface Props {
  open: boolean;
  onClose: () => void;
  type: LetterType;
  employeeId?: string;
  clientId?: string;
  assignmentId?: string;
  onGenerated?: (row: GeneratedRow) => void;
}

export function LetterGenerateDialog(props: Props) {
  const { open, onClose, type, employeeId, clientId, assignmentId } = props;
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedRow | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState('');
  const [sendBusy, setSendBusy] = useState(false);

  // Load templates for this type
  useEffect(() => {
    if (!open) return;
    apiFetch<any[]>(`/letters/templates?type=${type}`).then((res) => {
      setTemplates(res);
      const def = res.find((t) => t.isDefault) ?? res[0];
      if (def) setTemplateId(def.id);
    });
    setGenerated(null);
    setError(null);
  }, [open, type]);

  // Preview when template selected
  useEffect(() => {
    if (!open || !templateId) return;
    setLoading(true);
    apiFetch<PreviewResp>('/letters/preview', {
      method: 'POST',
      body: JSON.stringify({ type, templateId, employeeId, clientId, assignmentId }),
    })
      .then((res) => {
        setPreview(res);
        // Seed overrides with current data values
        const seeded: Record<string, any> = {};
        for (const f of res.editableFields) seeded[f.key] = getByPath(res.data, f.key) ?? '';
        setOverrides(seeded);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, templateId, type, employeeId, clientId, assignmentId]);

  // View the actual rendered document before committing to a numbered copy.
  const handlePreviewRender = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/letters/preview-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, templateId, employeeId, clientId, assignmentId, overrides }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(e.message || 'Preview failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setError(e.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const row = await apiFetch<GeneratedRow>('/letters/generate', {
        method: 'POST',
        body: JSON.stringify({
          type, templateId, employeeId, clientId, assignmentId,
          overrides, generatePdf: true,
        }),
      });
      setGenerated(row);
      // Default email-to populated from data
      const defaultEmail =
        preview?.data?.employee?.email
        ?? preview?.data?.client?.email
        ?? '';
      setSendTo(defaultEmail);
      props.onGenerated?.(row);
    } catch (e: any) {
      setError(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadUrl = (id: string, format: 'docx' | 'pdf') =>
    `${API_BASE}/letters/${id}/download?format=${format}`;

  const handleSend = async () => {
    if (!generated || !sendTo) return;
    setSendBusy(true);
    setError(null);
    try {
      await apiFetch(`/letters/${generated.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ to: sendTo, attachAs: 'pdf' }),
      });
      setSendOpen(false);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendBusy(false);
    }
  };

  // Helpers
  function getByPath(obj: any, dotted: string): any {
    return dotted.split('.').reduce((cur, k) => (cur == null ? cur : cur[k]), obj);
  }

  return (
    <>
      <Modal
        open={open && !generated}
        onClose={onClose}
        title={`Generate ${TYPE_LABEL[type]}`}
        description={preview?.template?.name ?? 'Loading template…'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={handlePreviewRender}
              disabled={!preview || previewing || generating}
              loading={previewing}
              className="gap-1.5"
            >
              <Eye size={14} /> {previewing ? 'Rendering…' : 'Preview'}
            </Button>
            <Button onClick={handleGenerate} disabled={!preview || generating || previewing} loading={generating}>
              {generating ? 'Generating…' : 'Generate'}
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Template picker (if more than one) */}
        {templates.length > 1 && (
          <FormField label="Template">
            <Select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              options={templates.map((t) => ({ value: t.id, label: t.name }))}
            />
          </FormField>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-content-tertiary py-4">
            <Loader2 className="animate-spin" size={16} /> Loading variables…
          </div>
        )}

        {!loading && preview && (
          <>
            <p className="text-xs text-content-tertiary mb-3 mt-2">
              Fields are pre-filled from system data. Edit any field below to override for this generation.
              Click <span className="font-medium">Preview</span> to view the actual document (opens in a new tab) before generating — preview does not save or assign a reference number.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {preview.editableFields.map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                  <FormField label={f.label} required={f.required}>
                    {f.type === 'textarea' ? (
                      <textarea
                        value={overrides[f.key] ?? ''}
                        onChange={(e) => setOverrides({ ...overrides, [f.key]: e.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    ) : f.type === 'select' ? (
                      <Select
                        value={overrides[f.key] ?? ''}
                        onChange={(e) => setOverrides({ ...overrides, [f.key]: e.target.value })}
                        options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
                      />
                    ) : (
                      <Input
                        type={f.type === 'date' ? 'text' : f.type}
                        value={overrides[f.key] ?? ''}
                        onChange={(e) => setOverrides({ ...overrides, [f.key]: e.target.value })}
                      />
                    )}
                  </FormField>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* After generate — show actions */}
      <Modal
        open={open && !!generated}
        onClose={onClose}
        title="Letter generated"
        description={generated?.referenceNo ?? ''}
        size="md"
        footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
      >
        <div className="text-center py-4">
          <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
          <p className="font-medium text-content-primary">{generated?.fileName}</p>
          <p className="text-xs text-content-tertiary mt-1">
            Reference: <code className="font-mono">{generated?.referenceNo}</code>
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {generated && (
            <>
              <a
                href={downloadUrl(generated.id, 'docx')}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-surface-200 hover:bg-surface-50 text-sm font-medium"
              >
                <FileText size={14} /> DOCX
              </a>
              <a
                href={downloadUrl(generated.id, 'pdf')}
                className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-surface-200 hover:bg-surface-50 text-sm font-medium"
              >
                <Download size={14} /> PDF
              </a>
              <Button onClick={() => setSendOpen(true)} className="gap-1.5">
                <Mail size={14} /> Email
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Send dialog */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Email the letter"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={!sendTo || sendBusy} loading={sendBusy}>
              Send PDF
            </Button>
          </>
        }
      >
        <FormField label="Recipient email" required>
          <Input type="email" value={sendTo} onChange={(e) => setSendTo(e.target.value)} />
        </FormField>
        <p className="text-xs text-content-tertiary mt-2">
          The PDF copy will be attached. Status will be set to SENT.
        </p>
      </Modal>
    </>
  );
}
