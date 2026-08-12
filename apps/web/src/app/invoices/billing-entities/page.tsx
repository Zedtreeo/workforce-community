'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Badge, Card, PageHeader, Modal, EmptyState } from '../../../components/ui';
import { Building2, Plus, Pencil, Trash2, Star } from 'lucide-react';

interface BillingEntity {
  id: string;
  name: string;
  registeredAddress: string | null;
  taxLine: string | null;
  paymentInstructions: string | null;
  invoicePrefix: string;
  isDefault: boolean;
  isActive: boolean;
  _count?: { invoices: number };
}

const blankForm = {
  name: '', invoicePrefix: '', registeredAddress: '', taxLine: '',
  paymentInstructions: '', isDefault: false, isActive: true,
};

export default function BillingEntitiesPage() {
  const { data: session } = useSession();
  const [entities, setEntities] = useState<BillingEntity[] | null>(null);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<'new' | BillingEntity | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setError('');
    try {
      setEntities(await apiFetch<BillingEntity[]>('/invoices/billing-entities'));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load billing entities');
      setEntities([]);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const openEditor = (e: 'new' | BillingEntity) => {
    setEditor(e);
    setFormErr('');
    if (e === 'new') setForm(blankForm);
    else setForm({
      name: e.name, invoicePrefix: e.invoicePrefix,
      registeredAddress: e.registeredAddress ?? '', taxLine: e.taxLine ?? '',
      paymentInstructions: e.paymentInstructions ?? '', isDefault: e.isDefault, isActive: e.isActive,
    });
  };

  const save = async () => {
    if (!form.name.trim()) { setFormErr('Company name is required.'); return; }
    if (!form.invoicePrefix.trim()) { setFormErr('Invoice number prefix is required (e.g. LSLLP/ZT).'); return; }
    setSaving(true); setFormErr('');
    try {
      const body = JSON.stringify(form);
      if (editor === 'new') {
        await apiFetch('/invoices/billing-entities', { method: 'POST', body });
      } else if (editor) {
        await apiFetch(`/invoices/billing-entities/${editor.id}`, { method: 'PATCH', body });
      }
      setEditor(null);
      await load();
    } catch (e: any) {
      setFormErr(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: BillingEntity) => {
    if (!confirm(`Delete "${e.name}"?`)) return;
    try {
      await apiFetch(`/invoices/billing-entities/${e.id}`, { method: 'DELETE' });
      load();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-6">
        <PageHeader
          title="Billing Entities"
          description="The legal companies you invoice under. Each has its own name, address, payment instructions and invoice-number series."
          breadcrumbs={[{ label: 'Invoices', href: '/invoices' }, { label: 'Billing Entities' }]}
          actions={<Button icon={<Plus size={16} />} onClick={() => openEditor('new')}>New Entity</Button>}
        />

        {error && <Card><p className="text-sm text-danger-dark">{error}</p></Card>}

        {entities && entities.length === 0 && !error && (
          <EmptyState icon={<Building2 />} title="No billing entities" description="Add a company to issue invoices under." />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {entities?.map((e) => (
            <Card key={e.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-content-primary">{e.name}</h3>
                    {e.isDefault && <Badge variant="brand"><Star size={11} className="inline mr-0.5" />Default</Badge>}
                    {!e.isActive && <Badge variant="default">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-content-tertiary mt-1">Series: <span className="font-mono">{e.invoicePrefix}/{'{FY}'}/NNN</span></p>
                  {e.registeredAddress && <p className="text-xs text-content-tertiary mt-1 whitespace-pre-line">{e.registeredAddress}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditor(e)} className="p-2 text-content-tertiary hover:text-brand-600 rounded-lg hover:bg-brand-50" title="Edit"><Pencil size={15} /></button>
                  {!e.isDefault && (
                    <button onClick={() => remove(e)} className="p-2 text-content-tertiary hover:text-danger rounded-lg hover:bg-danger-light" title="Delete"><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-content-tertiary mt-2">{e._count?.invoices ?? 0} invoice(s) issued</p>
            </Card>
          ))}
        </div>

        <Modal
          open={!!editor}
          onClose={() => setEditor(null)}
          title={editor === 'new' ? 'New Billing Entity' : `Edit — ${form.name}`}
          footer={<>
            <Button variant="secondary" size="sm" onClick={() => setEditor(null)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>Save</Button>
          </>}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Company name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Example Services LLC" className="w-full h-9 px-3 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Invoice number prefix *</label>
                <input value={form.invoicePrefix} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))} placeholder="LSLLP/ZT" className="w-full h-9 px-3 rounded-lg border border-surface-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Registered address</label>
              <textarea value={form.registeredAddress} onChange={(e) => setForm((f) => ({ ...f, registeredAddress: e.target.value }))} rows={2} placeholder="Printed under the company name on the PDF" className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Tax line (optional)</label>
              <input value={form.taxLine} onChange={(e) => setForm((f) => ({ ...f, taxLine: e.target.value }))} placeholder="e.g. Tax ID / EIN — leave blank if none" className="w-full h-9 px-3 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-content-secondary mb-1">Payment instructions</label>
              <textarea value={form.paymentInstructions} onChange={(e) => setForm((f) => ({ ...f, paymentInstructions: e.target.value }))} rows={3} placeholder="Overrides the global payment instructions for this company. Leave blank to use the global text." className="w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                Default for new invoices
              </label>
              <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="h-3.5 w-3.5 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                Active
              </label>
            </div>
            {formErr && <p className="text-sm text-danger-dark">{formErr}</p>}
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
}
