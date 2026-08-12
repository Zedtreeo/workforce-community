'use client';

import { useState } from 'react';
import { useSession } from '../../../lib/auth-client';
import { API_BASE } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader } from '../../../components/ui';
import { Download } from 'lucide-react';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUARTERS = [
  { q: 1, label: 'Q1 · Apr–Jun' },
  { q: 2, label: 'Q2 · Jul–Sep' },
  { q: 3, label: 'Q3 · Oct–Dec' },
  { q: 4, label: 'Q4 · Jan–Mar' },
];

export default function TaxReportPage() {
  const { data: session } = useSession();
  const token = (session as any)?.session?.token;
  const today = new Date();
  const curYear = today.getFullYear();
  const curFy = today.getMonth() + 1 >= 4 ? curYear : curYear - 1;

  const [scope, setScope] = useState('MONTH');
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(curYear);
  const [quarter, setQuarter] = useState(1);
  const [fy, setFy] = useState(curFy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const years = [curYear + 1, curYear, curYear - 1, curYear - 2];
  const fyYears = [curFy + 1, curFy, curFy - 1, curFy - 2];

  const download = async () => {
    if (!token) { setError('Not signed in'); return; }
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (scope === 'MONTH') { params.set('month', String(month)); params.set('year', String(year)); }
      else if (scope === 'QUARTER') { params.set('quarter', String(quarter)); params.set('fy', String(fy)); }
      else { params.set('fy', String(fy)); }
      const res = await fetch(`${API_BASE}/payroll/workflow/tax-file?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate the TDS report');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = m ? m[1] : 'tds-report.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'h-10 rounded-lg border border-surface-300 bg-white px-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none';

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
        <PageHeader
          title="Tax / TDS Reports"
          description="Download TDS payout reports for deposit & return filing"
          breadcrumbs={[{ label: 'Payroll' }, { label: 'Tax / TDS' }]}
        />
        <Card>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Report period</label>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className={`${inputCls} w-full`}>
                <option value="MONTH">Monthly</option>
                <option value="QUARTER">Quarterly (TDS return)</option>
                <option value="YEAR">Annual (financial year)</option>
              </select>
            </div>

            {scope === 'MONTH' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-content-secondary mb-1">Month</label>
                  <select value={month} onChange={(e) => setMonth(+e.target.value)} className={`${inputCls} w-full`}>
                    {MONTHS.slice(1).map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-content-secondary mb-1">Year</label>
                  <select value={year} onChange={(e) => setYear(+e.target.value)} className={`${inputCls} w-full`}>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {scope === 'QUARTER' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-content-secondary mb-1">Quarter</label>
                  <select value={quarter} onChange={(e) => setQuarter(+e.target.value)} className={`${inputCls} w-full`}>
                    {QUARTERS.map((q) => <option key={q.q} value={q.q}>{q.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-content-secondary mb-1">Financial year (start)</label>
                  <select value={fy} onChange={(e) => setFy(+e.target.value)} className={`${inputCls} w-full`}>
                    {fyYears.map((y) => <option key={y} value={y}>FY {y}-{String((y + 1) % 100).padStart(2, '0')}</option>)}
                  </select>
                </div>
              </div>
            )}

            {scope === 'YEAR' && (
              <div>
                <label className="block text-xs text-content-secondary mb-1">Financial year</label>
                <select value={fy} onChange={(e) => setFy(+e.target.value)} className={`${inputCls} w-full`}>
                  {fyYears.map((y) => <option key={y} value={y}>FY {y}-{String((y + 1) % 100).padStart(2, '0')}</option>)}
                </select>
              </div>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button icon={<Download size={16} />} loading={busy} onClick={download}>
              Download TDS Report (XLSX)
            </Button>

            <p className="text-xs text-content-tertiary pt-1">
              Splits TDS into <span className="font-medium">Salaried — Section 192 (Form 24Q)</span> and{' '}
              <span className="font-medium">Contract / Professional — Section 194 (Form 26Q)</span>, with subtotals and
              total TDS payable. Quarterly follows the Indian TDS quarters (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar).
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
