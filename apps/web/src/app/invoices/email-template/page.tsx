'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, PageHeader, Card, Badge, Modal } from '../../../components/ui';
import { Save, Building2, Plus, Pencil, Trash2, Star, Mail } from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
}

interface TemplatesResponse {
  templates: EmailTemplate[];
  variables: string[];
  defaults: { subject: string; body: string };
}

interface PdfSettings {
  paymentInstructions: string;
  variables: string[];
  defaults: { paymentInstructions: string };
}

// sample values for the live preview
const SAMPLE: Record<string, string> = {
  clientName: 'HyperCube Motors',
  invoiceNumber: 'LSLLP/ZT/26-27/001',
  period: "13th Jul-12th Aug'26",
  total: '1,100.00',
  currency: 'USD',
  dueDate: '10 Jun 2026',
  paymentTerms: 'Due on Receipt',
  payoneerLink: 'https://payoneer.com/pay/abc123',
};

const fill = (tpl: string) => tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in SAMPLE ? SAMPLE[k] : ''));

// plain text → simple HTML preview (mirrors the server's textToHtml)
const textToHtml = (text: string) => {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text.replace(/\r\n/g, '\n').split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${esc(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('');
};

export default function InvoiceEmailSettingsPage() {
  const { data: session } = useSession();

  // PDF payment instructions
  const [payInstr, setPayInstr] = useState('');
  const [savingPdf, setSavingPdf] = useState(false);

  // Email templates
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [variables, setVariables] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Template editor
  const [editor, setEditor] = useState<'new' | EmailTemplate | null>(null);
  const [form, setForm] = useState({ name: '', subject: '', body: '', isDefault: false });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [pdf, tpls] = await Promise.all([
        apiFetch<PdfSettings>('/invoices/email-template'),
        apiFetch<TemplatesResponse>('/invoices/email-templates'),
      ]);
      setPayInstr(pdf.paymentInstructions ?? '');
      setData(tpls);
      setVariables(tpls.variables);
      setDefaults(tpls.defaults);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load settings');
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const savePdf = async () => {
    setSavingPdf(true); setMsg(null); setError(null);
    try {
      await apiFetch('/invoices/email-template', { method: 'PUT', body: JSON.stringify({ paymentInstructions: payInstr }) });
      setMsg('Payment instructions saved. New invoice PDFs will use this text.');
    } catch (e: any) { setError(e?.message ?? 'Failed to save'); }
    finally { setSavingPdf(false); }
  };

  const openEditor = (t: 'new' | EmailTemplate) => {
    setEditor(t); setFormErr('');
    if (t === 'new') setForm({ name: '', subject: defaults.subject, body: defaults.body, isDefault: false });
    else setForm({ name: t.name, subject: t.subject, body: t.body, isDefault: t.isDefault });
  };

  const saveTemplate = async () => {
    if (!form.name.trim()) { setFormErr('Template name is required.'); return; }
    if (!form.subject.trim()) { setFormErr('Subject is required.'); return; }
    if (!form.body.trim()) { setFormErr('Body is required.'); return; }
    setSaving(true); setFormErr('');
    try {
      const body = JSON.stringify(form);
      if (editor === 'new') await apiFetch('/invoices/email-templates', { method: 'POST', body });
      else if (editor) await apiFetch(`/invoices/email-templates/${editor.id}`, { method: 'PATCH', body });
      setEditor(null);
      await load();
    } catch (e: any) { setFormErr(e?.message ?? 'Failed to save template'); }
    finally { setSaving(false); }
  };

  const deleteTemplate = async (t: EmailTemplate) => {
    if (!confirm(`Delete the "${t.name}" template?`)) return;
    try {
      await apiFetch(`/invoices/email-templates/${t.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) { alert(e?.message ?? 'Failed to delete'); }
  };

  const setDefault = async (t: EmailTemplate) => {
    try {
      await apiFetch(`/invoices/email-templates/${t.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: true }) });
      load();
    } catch (e: any) { alert(e?.message ?? 'Failed'); }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
        <PageHeader
          title="Invoice Email & PDF Settings"
          description="Manage the email templates sent to clients and the payment instructions printed on the PDF."
          breadcrumbs={[{ label: 'Invoices', href: '/invoices' }, { label: 'Email & PDF Settings' }]}
          actions={<a href="/invoices/billing-entities"><Button variant="secondary" icon={<Building2 size={15} />}>Billing Entities</Button></a>}
        />

        {error && <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>}
        {msg && <div className="p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-success">{msg}</div>}

        {/* Email Templates */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-content-primary flex items-center gap-2"><Mail size={16} /> Email Templates</h3>
              <p className="text-xs text-content-tertiary mt-0.5">Plain text — no HTML needed. Type normally; use {'{{'}variables{'}}'} for invoice details.</p>
            </div>
            <Button size="sm" icon={<Plus size={15} />} onClick={() => openEditor('new')}>New Template</Button>
          </div>

          <div className="space-y-2">
            {data?.templates.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-surface-200">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-content-primary">{t.name}</p>
                    {t.isDefault && <Badge variant="brand"><Star size={11} className="inline mr-0.5" />Default</Badge>}
                  </div>
                  <p className="text-xs text-content-tertiary mt-0.5 truncate">Subject: {t.subject}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!t.isDefault && <button onClick={() => setDefault(t)} className="text-xs text-brand-600 hover:text-brand-700 font-medium mr-1">Set default</button>}
                  <button onClick={() => openEditor(t)} className="p-2 text-content-tertiary hover:text-brand-600 rounded-lg hover:bg-brand-50" title="Edit"><Pencil size={15} /></button>
                  <button onClick={() => deleteTemplate(t)} className="p-2 text-content-tertiary hover:text-danger rounded-lg hover:bg-danger-light" title="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
            {data && data.templates.length === 0 && <p className="text-sm text-content-tertiary text-center py-6">No templates yet.</p>}
          </div>
        </Card>

        {/* PDF Payment Instructions */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-content-primary">PDF Payment Instructions</h3>
              <p className="text-xs text-content-tertiary mt-0.5">Printed under “Payment Instructions” on every invoice PDF. Reference &amp; amount due are added automatically.</p>
            </div>
            <Button size="sm" icon={<Save size={15} />} onClick={savePdf} loading={savingPdf}>Save</Button>
          </div>
          <textarea
            value={payInstr}
            onChange={(e) => setPayInstr(e.target.value)}
            rows={4}
            placeholder={'e.g.\nPlease remit payment via Payoneer to billing@legelp.com.\nBank transfer details available on request.'}
            className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </Card>

        {/* Template editor */}
        <Modal
          open={!!editor}
          onClose={() => setEditor(null)}
          title={editor === 'new' ? 'New Email Template' : `Edit — ${form.name}`}
          size="lg"
          footer={<>
            <Button variant="secondary" size="sm" onClick={() => setEditor(null)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={saveTemplate}>Save</Button>
          </>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Template name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Reminder" className="w-full h-9 px-3 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer sm:mt-6">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                Use as the default template
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Subject *</label>
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="w-full h-9 px-3 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="rounded-lg border border-surface-200 bg-surface-50 p-2.5">
              <p className="text-[11px] text-content-secondary mb-1.5">Click to insert a variable:</p>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button key={v} type="button"
                    onClick={() => setForm((f) => ({ ...f, body: `${f.body}{{${v}}}` }))}
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Body (plain text)</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={10}
                placeholder={'Dear {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}}...'}
                className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[11px] text-content-tertiary mt-1">Just type normally. Leave a blank line between paragraphs. A “Pay via Payoneer” button is added automatically when a payment link is set.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Preview (sample data)</label>
              <div className="rounded-lg border border-surface-200 p-3 bg-white">
                <p className="text-xs text-content-tertiary mb-1">Subject: <span className="font-medium text-content-primary">{fill(form.subject)}</span></p>
                <div className="text-sm text-content-secondary" dangerouslySetInnerHTML={{ __html: textToHtml(fill(form.body)) }} />
              </div>
            </div>

            {formErr && <p className="text-sm text-danger-dark">{formErr}</p>}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
