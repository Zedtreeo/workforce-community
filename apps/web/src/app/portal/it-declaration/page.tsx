'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, Button, PageSkeleton, PageHeader } from '../../../components/ui';

const SECTIONS: { key: string; label: string; cap?: string }[] = [
  { key: 'sec80C', label: '80C — PF / ELSS / LIC / PPF', cap: 'max ₹1,50,000' },
  { key: 'sec80CCD1B', label: '80CCD(1B) — NPS', cap: 'max ₹50,000' },
  { key: 'sec80D', label: '80D — Medical insurance', cap: 'max ₹1,00,000' },
  { key: 'homeLoanInterest', label: '24(b) — Home loan interest', cap: 'max ₹2,00,000' },
  { key: 'sec80E', label: '80E — Education loan interest' },
  { key: 'sec80G', label: '80G — Donations' },
  { key: 'sec80TTA', label: '80TTA — Savings interest', cap: 'max ₹10,000' },
  { key: 'otherDeductions', label: 'Other deductions' },
];
const SV: any = { DRAFT: 'default', SUBMITTED: 'info', APPROVED: 'success', REJECTED: 'danger' };

export default function ItDeclarationPage() {
  const { data: session } = useSession();
  const token = session?.session?.token;
  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [remarks, setRemarks] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ regime: 'OLD', metroCity: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!token) return; setLoading(true);
    try {
      const d = await apiFetch<any>('/it-declarations/me', { token });
      setFy(d.financialYear);
      const dec = d.declaration;
      if (dec) {
        setStatus(dec.status); setRemarks(dec.remarks);
        setForm({ regime: dec.regime, metroCity: dec.metroCity, sec80C: dec.sec80C, sec80CCD1B: dec.sec80CCD1B, sec80D: dec.sec80D, sec80E: dec.sec80E, sec80G: dec.sec80G, sec80TTA: dec.sec80TTA, homeLoanInterest: dec.homeLoanInterest, hraRentPaid: dec.hraRentPaid, otherDeductions: dec.otherDeductions });
      } else { setStatus('DRAFT'); }
    } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const locked = status === 'SUBMITTED' || status === 'APPROVED';
  const upd = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const save = async (submit: boolean) => {
    setSaving(true); setMsg('');
    try {
      await apiFetch('/it-declarations/me', { method: 'POST', token, body: JSON.stringify({ ...form, financialYear: fy }) });
      if (submit) await apiFetch('/it-declarations/me/submit', { method: 'POST', token, body: JSON.stringify({ financialYear: fy }) });
      setMsg(submit ? 'Submitted for HR approval.' : 'Saved.'); await load();
    } catch (e: any) { setMsg(e.message || 'Failed'); } finally { setSaving(false); }
  };

  if (loading) return <DashboardLayout><div className="p-6"><PageSkeleton /></div></DashboardLayout>;
  return <DashboardLayout><div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
    <div className="flex items-center justify-between">
      <PageHeader title="Income Tax Declaration" description={`Financial Year ${fy}`} />
      <Badge variant={SV[status] || 'default'} dot>{status}</Badge>
    </div>
    {remarks && status === 'REJECTED' && <div className="p-3 bg-danger-light border border-danger rounded-lg text-sm text-danger-dark">HR remarks: {remarks}</div>}
    {msg && <div className="p-3 bg-success-light/30 border border-success rounded-lg text-sm">{msg}</div>}
    {locked && <div className="p-3 bg-surface-100 rounded-lg text-sm text-content-secondary">Your declaration is {status.toLowerCase()}. Contact HR to make changes.</div>}
    <Card>
      <label className="block text-sm font-medium mb-2">Tax Regime</label>
      <select disabled={locked} value={form.regime} onChange={e => upd('regime', e.target.value)} className="w-full h-10 border border-surface-300 rounded-lg px-3 text-sm bg-white">
        <option value="OLD">Old Regime (claim deductions below)</option>
        <option value="NEW">New Regime (lower slabs, no deductions)</option>
      </select>
      <p className="text-xs text-content-tertiary mt-1">New regime ignores the deductions below; choose Old to claim them.</p>
    </Card>
    {form.regime === 'OLD' && <Card className="space-y-3">
      <h3 className="text-sm font-semibold">Deductions (annual ₹)</h3>
      {SECTIONS.map(s => (
        <div key={s.key} className="flex items-center gap-3">
          <label className="flex-1 text-sm">{s.label} {s.cap && <span className="text-xs text-content-tertiary">({s.cap})</span>}</label>
          <input type="number" disabled={locked} value={form[s.key] ?? ''} onChange={e => upd(s.key, e.target.value)} placeholder="0" className="w-36 h-9 border border-surface-300 rounded-lg px-3 text-sm" />
        </div>
      ))}
      <div className="border-t border-surface-100 pt-3">
        <h4 className="text-sm font-semibold mb-2">HRA exemption — Sec 10(13A)</h4>
        <div className="flex items-center gap-3">
          <label className="flex-1 text-sm">Annual rent paid</label>
          <input type="number" disabled={locked} value={form.hraRentPaid ?? ''} onChange={e => upd('hraRentPaid', e.target.value)} placeholder="0" className="w-36 h-9 border border-surface-300 rounded-lg px-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 mt-2 text-sm"><input type="checkbox" disabled={locked} checked={!!form.metroCity} onChange={e => upd('metroCity', e.target.checked)} /> Metro city (Delhi / Mumbai / Kolkata / Chennai)</label>
        <p className="text-xs text-content-tertiary mt-1">Exemption is auto-computed from rent, basic salary and metro status.</p>
      </div>
    </Card>}
    {!locked && <div className="flex gap-3 justify-end">
      <Button variant="secondary" loading={saving} onClick={() => save(false)}>Save Draft</Button>
      <Button loading={saving} onClick={() => save(true)}>Submit for Approval</Button>
    </div>}
  </div></DashboardLayout>;
}
