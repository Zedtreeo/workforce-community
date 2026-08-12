// apps/web/src/components/invoicing/SendInvoiceEmailDialog.tsx
'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button, FormField, Input } from '../../components/ui';
import { AlertCircle, Mail } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  defaultRecipient?: string;
  defaultPayoneerLink?: string;
  onSent?: () => void;
}

interface EmailTemplate { id: string; name: string; subject: string; body: string; isDefault: boolean }

export function SendInvoiceEmailDialog({
  open, onClose, invoiceId, invoiceNumber, defaultRecipient, defaultPayoneerLink, onSent,
}: Props) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber}`);
  const [body, setBody] = useState('');
  const [payoneerLink, setPayoneerLink] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && defaultRecipient) setTo(defaultRecipient);
  }, [open, defaultRecipient]);

  useEffect(() => {
    if (open) setPayoneerLink(defaultPayoneerLink ?? '');
  }, [open, defaultPayoneerLink]);

  // Load templates and preload the default one into the editable fields.
  useEffect(() => {
    if (!open) return;
    apiFetch<{ templates: EmailTemplate[] }>('/invoices/email-templates')
      .then(({ templates }) => {
        setTemplates(templates);
        const def = templates.find((t) => t.isDefault) ?? templates[0];
        if (def) { setTemplateId(def.id); setSubject(def.subject); setBody(def.body); }
      })
      .catch(() => {});
  }, [open, invoiceNumber]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) { setSubject(t.subject); setBody(t.body); }
  };

  const handleSend = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/invoices/${invoiceId}/send-email`, {
        method: 'POST',
        body: JSON.stringify({
          to, cc: cc || undefined, subject: subject || undefined,
          body: body || undefined,
          templateId: templateId || undefined,
          payoneerLink: payoneerLink.trim() || undefined,
        }),
      });
      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to send email');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      open={open} onClose={onClose}
      title="Email invoice to client"
      description={`PDF of ${invoiceNumber} will be attached`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} loading={busy} disabled={!to || busy} className="gap-1.5">
            <Mail size={14} /> Send
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="space-y-3">
        <FormField label="To" required>
          <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="finance@client.com" />
        </FormField>
        <FormField label="CC (optional — comma-separated for multiple)">
          <Input
            type="text"
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="cc1@example.com, cc2@example.com"
          />
          <p className="text-xs text-content-tertiary mt-1">billing@legelp.com is always CC'd automatically.</p>
        </FormField>
        {templates.length > 0 && (
          <FormField label="Template">
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full h-10 rounded-lg border border-surface-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
              ))}
            </select>
            <p className="text-xs text-content-tertiary mt-1">Pick a template, then tweak the subject/body below if needed. Manage templates in Email &amp; PDF Settings.</p>
          </FormField>
        )}
        <FormField label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </FormField>
        <FormField label="Payoneer payment link (optional)">
          <Input
            type="url"
            value={payoneerLink}
            onChange={(e) => setPayoneerLink(e.target.value)}
            maxLength={1000}
            placeholder="https://payoneer.com/pay/…  (renders a 'Pay via Payoneer' button)"
          />
        </FormField>
        <FormField label="Message (plain text)">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Dear {{clientName}}, please find attached invoice…"
          />
          <p className="text-xs text-content-tertiary mt-1">Plain text — no HTML needed. {'{{'}variables{'}}'} are filled in automatically.</p>
        </FormField>
      </div>
      <p className="text-xs text-content-tertiary mt-3">
        After successful send, the invoice status flips DRAFT → SENT and the recipient is recorded.
      </p>
    </Modal>
  );
}
