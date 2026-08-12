'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch, API_BASE } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Button, PageSkeleton, PageHeader } from '../../../components/ui';
import { Download } from 'lucide-react';

function recentFYs(): string[] {
  const d = new Date(); const m = d.getMonth() + 1; const y = d.getFullYear();
  const start = m >= 4 ? y : y - 1;
  return [0, 1, 2].map((i) => { const s = start - i; return `${s}-${String((s + 1) % 100).padStart(2, '0')}`; });
}
const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export default function TaxDocumentsPage() {
  const { data: session } = useSession();
  const token = session?.session?.token;
  const fys = recentFYs();
  const [fy, setFy] = useState(fys[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (f: string) => {
    if (!token) return; setLoading(true);
    try { const r = await apiFetch<any>(`/tax-forms/my-form16?fy=${f}`, { token }); setData(r); }
    catch { setData(null); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(fy); }, [fy, load]);

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/tax-forms/my-form16/pdf?fy=${fy}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Form16-${fy}.pdf`; a.click(); URL.revokeObjectURL(url);
    } catch { alert('Download failed'); } finally { setBusy(false); }
  };

  return <DashboardLayout><div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <PageHeader title="Tax Documents" description="Your annual TDS certificate (Form 16 Part B / Form 16A)" />
      <select value={fy} onChange={(e) => setFy(e.target.value)} className="h-10 border border-surface-300 rounded-lg px-3 text-sm bg-white">
        {fys.map((y) => <option key={y} value={y}>FY {y}</option>)}
      </select>
    </div>
    {loading ? <PageSkeleton /> : !data || data.payslipCount === 0 ? (
      <Card><p className="text-sm text-content-secondary">No payslips on record for FY {fy}.</p></Card>
    ) : (
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Form {data.form} — FY {data.financialYear}</p>
            <p className="text-xs text-content-tertiary">Assessment Year {data.assessmentYear} · {data.payslipCount} month(s)</p>
          </div>
          <Button loading={busy} onClick={download}><Download size={14} /> Download</Button>
        </div>
        <div className="space-y-1 text-sm border-t border-surface-100 pt-3">
          <div className="flex justify-between"><span>Gross salary paid</span><span>{fmt(data.grossSalaryPaid)}</span></div>
          <div className="flex justify-between"><span>Total TDS deducted</span><span className="text-danger-dark">{fmt(data.totalTdsDeducted)}</span></div>
        </div>
        <p className="text-xs text-content-tertiary">Part A (challan/TRACES details) is issued separately by the Income Tax Department after return filing.</p>
      </Card>
    )}
  </div></DashboardLayout>;
}
