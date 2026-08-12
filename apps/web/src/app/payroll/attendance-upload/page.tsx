'use client';

import { useState } from 'react';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader, Badge } from '../../../components/ui';
import { apiUpload } from '../../../lib/api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

interface UploadResult {
  month: number; year: number;
  imported: number; skipped: number;
  errors: string[]; matched: string[];
  totalEmployeesInSystem: number;
}

export default function AttendanceUploadPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file) { setError('Please choose a file (.xlsx).'); return; }
    setError(null); setResult(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('month', String(month));
      fd.append('year', String(year));
      const res = await apiUpload<UploadResult>('/payroll/workflow/upload-monthly-attendance', fd);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="Monthly Attendance Upload"
          description="Upload a monthly attendance summary. This overrides agent/web-marked attendance for payroll."
          breadcrumbs={[{ label: 'Payroll' }, { label: 'Attendance Upload' }]}
        />

        <Card>
          <div className="space-y-4">
            <div className="rounded-lg bg-info/10 border border-info/30 px-4 py-3 text-sm text-content-secondary">
              <p className="font-medium text-content-primary mb-1">Expected columns</p>
              <code className="text-xs">Employee ID, Working days, Timeoff, Over Time, Late Count, Early Count</code>
              <p className="mt-2 text-xs">Matched by Employee ID = employee code. <strong>Working days</strong> drives paid days for payroll;
                pay = salary × (Working days ÷ standard working days that month). Over Time / Late / Early are stored for reference only.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Month</label>
                <select value={month} onChange={(e) => setMonth(+e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  {monthNames.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">Year</label>
                <select value={year} onChange={(e) => setYear(+e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-content-secondary mb-1">Attendance file (.xlsx)</label>
              <input type="file" accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-content-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 file:font-medium hover:file:bg-brand-100" />
              {file && <p className="mt-1 text-xs text-content-tertiary flex items-center gap-1"><FileSpreadsheet size={12} /> {file.name}</p>}
            </div>

            {error && <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-2 text-sm text-danger">{error}</div>}

            <Button onClick={submit} disabled={busy || !file} icon={<Upload size={16} />}>
              {busy ? 'Uploading…' : `Upload for ${monthNames[month]} ${year}`}
            </Button>
          </div>
        </Card>

        {result && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} className="text-success" />
              <h2 className="text-sm font-semibold text-content-primary">
                Uploaded for {monthNames[result.month]} {result.year}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-surface-50 p-3 text-center">
                <div className="text-2xl font-bold text-success">{result.imported}</div>
                <div className="text-xs text-content-tertiary">Imported / overridden</div>
              </div>
              <div className="rounded-lg bg-surface-50 p-3 text-center">
                <div className="text-2xl font-bold text-content-secondary">{result.skipped}</div>
                <div className="text-xs text-content-tertiary">Skipped</div>
              </div>
              <div className="rounded-lg bg-surface-50 p-3 text-center">
                <div className="text-2xl font-bold text-content-secondary">{result.totalEmployeesInSystem}</div>
                <div className="text-xs text-content-tertiary">Employees in system</div>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 px-4 py-3">
                <p className="text-sm font-medium text-content-primary flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={14} className="text-warning" /> {result.errors.length} row(s) not matched
                </p>
                <ul className="text-xs text-content-secondary list-disc pl-5 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 50).map((er, i) => <li key={i}>{er}</li>)}
                </ul>
                <p className="text-xs text-content-tertiary mt-2">Unmatched codes have no matching employee in HRMS yet — add those employees (with the same code) and re-upload.</p>
              </div>
            )}
            <p className="text-xs text-content-tertiary mt-3">Now run payroll for {monthNames[result.month]} {result.year} — it will use these working days, overriding agent/web data.</p>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
