'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch, apiUpload, API_BASE } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton, PageHeader } from '../../../components/ui';
import {
  CheckCircle2, Circle, Lock, FileSpreadsheet, Send, ArrowRight, AlertTriangle,
  Upload, Download, Pencil, Trash2, RotateCcw, Eye,
} from 'lucide-react';

const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const shortMonths = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const REIMBURSEMENT_SUGGESTIONS = ['Travel', 'Conveyance', 'Fuel', 'Internet', 'Mobile / Phone', 'Meal / Food', 'Medical', 'Books & Learning', 'Home Office', 'Reimbursement'];

const STAGES = [
  { key: 'attendance', label: 'Attendance', icon: Circle },
  { key: 'consolidation', label: 'Consolidate', icon: Circle },
  { key: 'rectification', label: 'Rectify & Lock', icon: Circle },
  { key: 'run', label: 'Run Payroll', icon: Circle },
  { key: 'review', label: 'Review', icon: Circle },
  { key: 'freeze', label: 'Freeze & Bank', icon: Lock },
  { key: 'finalize', label: 'Finalize', icon: Send },
];

const statusBadge: Record<string, { variant: any; label: string }> = {
  DRAFT: { variant: 'default', label: 'Draft' },
  PROCESSING: { variant: 'warning', label: 'Processing' },
  COMPLETED: { variant: 'info', label: 'Computed' },
  CONSOLIDATED: { variant: 'info', label: 'Consolidated' },
  RECTIFIED: { variant: 'info', label: 'Rectified' },
  COMPUTED: { variant: 'info', label: 'Computed' },
  REVIEWED: { variant: 'brand', label: 'Reviewed' },
  FROZEN: { variant: 'warning', label: 'Frozen' },
  BANK_GENERATED: { variant: 'brand', label: 'Bank File Ready' },
  FINALIZED: { variant: 'success', label: 'Finalized' },
  PAID: { variant: 'success', label: 'Paid' },
  APPROVED: { variant: 'success', label: 'Approved' },
};

function getActiveStage(status: string, hasConsolidation: boolean): number {
  if (!status && !hasConsolidation) return 0; // attendance
  if (!status && hasConsolidation) return 2;
  switch (status) {
    case 'CONSOLIDATED': return 2;
    case 'RECTIFIED': return 2;
    case 'DRAFT': case 'PROCESSING': return 3;
    case 'COMPLETED': case 'COMPUTED': return 4;
    case 'REVIEWED': return 4;
    case 'FROZEN': return 5;
    case 'BANK_GENERATED': return 6;
    case 'FINALIZED': case 'PAID': return 7;
    default: return 0;
  }
}

export default function PayrollWorkflowPage() {
  const { data: session } = useSession();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [consolidation, setConsolidation] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [attendanceReport, setAttendanceReport] = useState<any>(null);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState<string>('');
  const [uploadedRows, setUploadedRows] = useState<any[]>([]);

  const doUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('month', String(month)); fd.append('year', String(year));
      const res: any = await apiUpload('/payroll/workflow/upload-monthly-attendance', fd, { token });
      setError('');
      const extra = res.skipped ? (', ' + res.skipped + ' skipped (no matching employee)') : '';
      setUploadMsg('\u2713 ' + monthNames[month] + ' ' + year + ' attendance uploaded: ' + res.imported + ' employee' + (res.imported === 1 ? '' : 's') + ' set' + extra + '. Scroll to \u201CRun Payroll\u201D below.');
      await loadData();
      await loadUploaded();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showRunDetail, setShowRunDetail] = useState(false);
  const [runDetail, setRunDetail] = useState<any>(null);
  const [showModify, setShowModify] = useState(false);
  const [modifySlip, setModifySlip] = useState<any>(null);
  const [modifyForm, setModifyForm] = useState<any>({});
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payHeads, setPayHeads] = useState<any[]>([]);
  const [bulkHead, setBulkHead] = useState<any>({ type: 'DEDUCTION', label: '', amount: 0 });

  const token = session?.session?.token;

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cons, runsData, heads] = await Promise.all([
        apiFetch<any>(`/payroll/workflow/consolidation?month=${month}&year=${year}`, { token }).catch(() => null),
        apiFetch<any[]>('/payroll/runs', { token }).catch(() => []),
        apiFetch<any[]>('/pay-structure/heads?isActive=true', { token }).catch(() => []),
      ]);
      setConsolidation(cons);
      setRuns(Array.isArray(runsData) ? runsData : []);
      setPayHeads(Array.isArray(heads) ? heads : []);
      const currentRun = (Array.isArray(runsData) ? runsData : []).find((r: any) => r.month === month && r.year === year);
      setActiveRun(currentRun || null);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [token, month, year]);

  const refreshRunDetail = useCallback(async () => {
    if (!token) return;
    try {
      const runs = await apiFetch<any[]>('/payroll/runs', { token });
      const ar = (runs || []).find((r: any) => r.month === month && r.year === year);
      if (ar?.id) {
        const d = await apiFetch(`/payroll/workflow/run/${ar.id}`, { token });
        setRunDetail(d);
      } else {
        setRunDetail(null);
      }
    } catch (_) {}
  }, [token, month, year]);

  const loadUploaded = useCallback(async () => {
    if (!token) return;
    try {
      const r = await apiFetch<any[]>(`/payroll/workflow/monthly-attendance?month=${month}&year=${year}`, { token });
      setUploadedRows(r || []);
    } catch (_) { setUploadedRows([]); }
  }, [token, month, year]);

  const clearUploaded = useCallback(async () => {
    if (!token) return;
    if (!confirm(`Delete the uploaded attendance for ${monthNames[month]} ${year}? You can re-upload a corrected file after.`)) return;
    try {
      await apiFetch(`/payroll/workflow/monthly-attendance?month=${month}&year=${year}`, { method: 'DELETE', token });
      setUploadedRows([]);
    } catch (_) {}
  }, [token, month, year]);

  const deleteUploadedRow = useCallback(async (id: string) => {
    if (!token || !id) return;
    try {
      await apiFetch(`/payroll/workflow/monthly-attendance/${id}`, { method: 'DELETE', token });
      setUploadedRows((prev) => prev.filter((r: any) => r.id !== id));
    } catch (_) {}
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { refreshRunDetail(); loadUploaded(); }, [refreshRunDetail, loadUploaded, activeRun?.id]);

  const doAction = async (action: string, body?: any) => {
    if (!token) return;
    setBusy(action);
    setError('');
    try {
      let result;
      switch (action) {
        case 'consolidate':
          result = await apiFetch('/payroll/workflow/consolidate', { method: 'POST', token, body: JSON.stringify({ month, year }) });
          break;
        case 'rectify':
          result = await apiFetch('/payroll/workflow/rectify', { method: 'POST', token, body: JSON.stringify({ month, year }) });
          break;
        case 'lock':
          result = await apiFetch('/payroll/workflow/lock-attendance', { method: 'POST', token, body: JSON.stringify({ month, year }) });
          break;
        case 'runPayroll':
          result = await apiFetch('/payroll/run-v2', { method: 'POST', token, body: JSON.stringify({ month, year }) });
          break;
        case 'reopen':
          if (!activeRun) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}/reopen`, { method: 'POST', token });
          break;
        case 'freeze':
          if (!activeRun) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}/freeze`, { method: 'POST', token });
          break;
        case 'bankFile':
          if (!activeRun) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}/bank-file`, { method: 'POST', token });
          break;
        case 'finalize':
          if (!activeRun) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}/finalize`, { method: 'POST', token });
          break;
        case 'deleteRun':
          if (!activeRun || !confirm('Delete this payroll run? This cannot be undone.')) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}`, { method: 'DELETE', token });
          break;
        case 'recalculate':
          if (!activeRun || !confirm('Recalculate this payroll from the current pay structures & attendance? Base pay is refreshed to match any changes; your manually added heads are preserved. (Not allowed after Freeze/Finalize.)')) return;
          result = await apiFetch(`/payroll/workflow/run/${activeRun.id}/recalculate`, { method: 'POST', token });
          break;
      }
      loadData();
      if (action === 'recalculate') await refreshRunDetail();
    } catch (e: any) {
      setError(e.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const loadAttendanceReport = async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`/payroll/workflow/attendance-report?month=${month}&year=${year}`, { token });
      setAttendanceReport(data);
      setShowReport(true);
    } catch { /* */ }
  };

  const loadRunDetail = async () => {
    if (!token || !activeRun) return;
    try {
      const data = await apiFetch(`/payroll/workflow/run/${activeRun.id}`, { token });
      setRunDetail(data);
      setShowRunDetail(true);
    } catch { /* */ }
  };

  const openModify = (slip: any, addEarning = false) => {
    setModifySlip(slip);
    setModifyForm({
      basic: Number(slip.basic), hra: Number(slip.hra), da: Number(slip.da),
      specialAllow: Number(slip.specialAllow), otherAllow: Number(slip.otherAllow),
      pfEmployee: Number(slip.pfEmployee), esiEmployee: Number(slip.esiEmployee),
      profTax: Number(slip.profTax), tds: Number(slip.tds), otherDeductions: Number(slip.otherDeductions),
    });
    const base = Array.isArray(slip.adjustments) ? slip.adjustments : [];
    setAdjustments(addEarning ? [...base, { type: 'EARNING', label: '', amount: 0 }] : base);
    setShowModify(true);
  };

  const saveModify = async () => {
    if (!token || !modifySlip) return;
    setBusy('modify');
    try {
      await apiFetch(`/payroll/workflow/payslip/${modifySlip.id}/modify`, {
        method: 'POST', token, body: JSON.stringify({ ...modifyForm, adjustments }),
      });
      setShowModify(false);
      await refreshRunDetail();
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const applyBulkHead = async () => {
    if (!token || !runDetail?.id) return;
    const label = String(bulkHead.label || '').trim();
    if (!label) { setError('Enter a head name (e.g. Bonus, Advance)'); return; }
    setBusy('bulkHead');
    try {
      await apiFetch(`/payroll/workflow/run/${runDetail.id}/bulk-head`, {
        method: 'POST', token,
        body: JSON.stringify({ type: bulkHead.type, label, amount: Number(bulkHead.amount) || 0 }),
      });
      setBulkHead({ type: bulkHead.type, label: '', amount: 0 });
      await refreshRunDetail();
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const removeBulkHead = async (type: string, label: string) => {
    if (!token || !runDetail?.id) return;
    setBusy(`removeHead:${type}:${label}`);
    try {
      await apiFetch(`/payroll/workflow/run/${runDetail.id}/bulk-head/remove`, {
        method: 'POST', token, body: JSON.stringify({ type, label }),
      });
      await refreshRunDetail();
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  // Distinct heads present across the whole run (union by type + label), for bulk removal
  const runHeads: Array<{ type: string; label: string; count: number; total: number }> = (() => {
    const map = new Map<string, { type: string; label: string; count: number; total: number }>();
    (runDetail?.payslips || []).forEach((s: any) => {
      (Array.isArray(s.adjustments) ? s.adjustments : []).forEach((a: any) => {
        if (!a?.type || !a?.label) return;
        const key = `${a.type}|${a.label}`;
        const e = map.get(key) || { type: a.type, label: a.label, count: 0, total: 0 };
        e.count++; e.total += Number(a.amount || 0);
        map.set(key, e);
      });
    });
    return Array.from(map.values());
  })();

  const downloadTaxFile = async (scope: string) => {
    if (!token || !activeRun) return;
    setBusy(`tax:${scope}`);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/payroll/workflow/run/${activeRun.id}/tax-file?scope=${scope}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate tax payout file');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = m ? m[1] : `tax-payout-${scope.toLowerCase()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Tax file download failed');
    } finally {
      setBusy('');
    }
  };

  const downloadPayrollExport = async () => {
    if (!token || !activeRun) return;
    setBusy('export');
    setError('');
    try {
      const res = await fetch(`${API_BASE}/payroll/workflow/run/${activeRun.id}/payroll-export`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to export payroll summary');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = m ? m[1] : 'payroll-summary.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Export failed');
    } finally {
      setBusy('');
    }
  };

  const fmt = (v: any) => `₹${Number(v).toLocaleString('en-IN')}`;
  const sumAdj = (slip: any, type: string) => Array.isArray(slip.adjustments)
    ? slip.adjustments.filter((a: any) => a?.type === type).reduce((s: number, a: any) => s + Number(a.amount || 0), 0)
    : 0;
  const reimbOf = (slip: any) => sumAdj(slip, 'REIMBURSEMENT');
  const addEarnOf = (slip: any) => sumAdj(slip, 'EARNING');
  const salaryOf = (slip: any) => Number(slip.grossEarnings) - addEarnOf(slip); // base pay-structure earnings
  const otherDedOf = (slip: any) => Number(slip.totalDeductions) - Number(slip.tds); // everything except TDS
  const activeStage = getActiveStage(activeRun?.status, !!consolidation);
  const consStatus = consolidation?.status || 'OPEN';

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={doUpload} />
        {uploadMsg && (
          <div className="rounded-lg bg-success/10 border border-success/30 px-4 py-3 text-sm text-success-dark flex items-center justify-between">
            <span>{uploadMsg}</span>
            <button onClick={() => setUploadMsg('')} className="text-content-tertiary hover:text-content-secondary ml-3">×</button>
          </div>
        )}
        <PageHeader
          title="Payroll Pipeline"
          breadcrumbs={[{ label: 'Payroll', href: '/payroll' }, { label: 'Workflow' }]}
          actions={
            <div className="flex gap-2 items-center">
              <select className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm" value={month} onChange={(e) => setMonth(+e.target.value)}>
                {monthNames.slice(1).map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm" value={year} onChange={(e) => setYear(+e.target.value)}>
                {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          }
        />

        {loading ? <PageSkeleton /> : (
          <>
            {/* Pipeline Stages */}
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between overflow-x-auto gap-2">
                  {STAGES.map((stage, idx) => {
                    const done = idx < activeStage;
                    const current = idx === activeStage;
                    return (
                      <div key={stage.key} className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          done ? 'bg-success-light text-success-dark' :
                          current ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200' :
                          'bg-surface-50 text-content-tertiary'
                        }`}>
                          {done ? <CheckCircle2 size={16} /> : <stage.icon size={16} />}
                          {stage.label}
                        </div>
                        {idx < STAGES.length - 1 && <ArrowRight size={14} className="text-content-tertiary shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {error && (
              <Card className="border-danger-light bg-danger-light/10">
                <div className="p-3 flex items-center gap-2 text-danger text-sm">
                  <AlertTriangle size={16} /> {error}
                </div>
              </Card>
            )}

            {/* Status Cards */}
            <div className="space-y-4">
              {/* Attendance — upload only */}
              <Card>
                <div className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-content-primary">Attendance ({shortMonths[month]} {year})</h3>
                    <p className="text-xs text-content-tertiary mt-0.5">Upload the monthly attendance sheet (Employee ID, Working days, Timeoff, Over Time, Late, Early). It overrides agent/web for this run.</p>
                  </div>
                  <Button variant="primary" size="sm" icon={<Upload />} loading={busy === 'upload'} onClick={() => fileRef.current?.click()}>Upload XLSX</Button>
                </div>
              </Card>

              {uploadedRows.length > 0 && (
                <Card>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-content-primary">Uploaded Attendance ({uploadedRows.length})</h3>
                      <Button variant="ghost" size="xs" icon={<Trash2 size={14} />} className="text-danger" onClick={clearUploaded}>
                        Clear upload
                      </Button>
                    </div>
                    <div className="overflow-x-auto border border-surface-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-surface-50 text-content-secondary">
                            <th className="px-3 py-2 text-left">Employee</th>
                            <th className="px-3 py-2 text-right">Working Days</th>
                            <th className="px-3 py-2 text-right">Timeoff</th>
                            <th className="px-3 py-2 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {uploadedRows.map((r: any) => (
                            <tr key={r.id || r.employeeCode} className="hover:bg-surface-50 group">
                              <td className="px-3 py-2"><span className="font-medium">{r.name || r.employeeCode}</span> <span className="text-content-tertiary">{r.employeeCode}</span></td>
                              <td className="px-3 py-2 text-right font-medium">{r.workingDays}</td>
                              <td className="px-3 py-2 text-right text-content-secondary">{r.timeoff}</td>
                              <td className="px-3 py-2 text-right">
                                <button onClick={() => deleteUploadedRow(r.id)} title="Remove this employee" className="text-content-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}

              {/* Payroll Run */}
              <Card>
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-content-primary mb-3">Payroll Run ({shortMonths[month]} {year})</h3>
                  {activeRun ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={(statusBadge[activeRun.status]?.variant) || 'default'} dot>
                          {statusBadge[activeRun.status]?.label || activeRun.status}
                        </Badge>
                        <span className="text-xs text-content-tertiary">{activeRun.employeeCount} employees</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-surface-50 rounded-lg p-2">
                          <p className="text-sm font-bold text-content-primary">{fmt(activeRun.totalGross)}</p>
                          <p className="text-xs text-content-tertiary">Gross</p>
                        </div>
                        <div className="bg-danger-light/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-danger">{fmt(activeRun.totalDeductions)}</p>
                          <p className="text-xs text-content-tertiary">Deductions</p>
                        </div>
                        <div className="bg-success-light/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-success-dark">{fmt(activeRun.totalNet)}</p>
                          <p className="text-xs text-content-tertiary">Net Pay</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="secondary" size="xs" icon={<Eye />} onClick={loadRunDetail}>Review Payslips</Button>
                        <Button variant="secondary" size="xs" icon={<Download />} loading={busy === 'export'} onClick={downloadPayrollExport}>Export</Button>
                        {!['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(activeRun.status) && (
                          <Button variant="secondary" size="xs" icon={<RotateCcw />} loading={busy === 'recalculate'} onClick={() => doAction('recalculate')}>Recalculate</Button>
                        )}
                        {['FROZEN', 'BANK_GENERATED'].includes(activeRun.status) && (
                          <Button variant="secondary" size="xs" icon={<Lock />} loading={busy === 'reopen'} onClick={() => { if (confirm('Reopen this payroll for editing? It unlocks back to draft so you can add/adjust heads. You can re-freeze afterwards. (Not allowed after Finalize.)')) doAction('reopen'); }}>Reopen for editing</Button>
                        )}
                        {!['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(activeRun.status) && (
                          <>
                            <Button variant="primary" size="xs" icon={<Lock />} loading={busy === 'freeze'} onClick={() => doAction('freeze')}>Freeze</Button>
                            <Button variant="ghost" size="xs" icon={<Trash2 />} className="text-danger" loading={busy === 'deleteRun'} onClick={() => doAction('deleteRun')}>Delete</Button>
                          </>
                        )}
                        {['FROZEN', 'COMPLETED', 'REVIEWED', 'COMPUTED'].includes(activeRun.status) && (
                          <Button variant="primary" size="xs" icon={<FileSpreadsheet />} loading={busy === 'bankFile'} onClick={() => doAction('bankFile')}>
                            Generate Bank File
                          </Button>
                        )}
                        {activeRun.bankFileUrl && (
                          <a href={`${API_BASE.replace('/api/v1', '')}${activeRun.bankFileUrl}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="secondary" size="xs" icon={<Download />}>Download XLSX</Button>
                          </a>
                        )}
                        {['FROZEN', 'COMPLETED', 'REVIEWED', 'COMPUTED', 'BANK_GENERATED'].includes(activeRun.status) && (
                          <Button variant="secondary" size="xs" icon={<FileSpreadsheet />} loading={busy === 'tax:MONTH'} onClick={() => downloadTaxFile('MONTH')}>
                            TDS (this month)
                          </Button>
                        )}
                        {['BANK_GENERATED', 'FROZEN'].includes(activeRun.status) && (
                          <Button variant="success" size="xs" icon={<Send />} loading={busy === 'finalize'} onClick={() => doAction('finalize')}>
                            Finalize & Notify
                          </Button>
                        )}
                      </div>

                      {runDetail && runDetail.payslips && runDetail.payslips.length > 0 && (
                        <div className="overflow-x-auto border border-surface-200 rounded-lg">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-surface-50 text-content-secondary">
                                <th className="px-3 py-2 text-left">Employee</th>
                                <th className="px-3 py-2 text-right text-success-dark">Salary</th>
                                <th className="px-3 py-2 text-right text-success-dark">Add. Earning</th>
                                <th className="px-3 py-2 text-right text-brand-600">Reimburse</th>
                                <th className="px-3 py-2 text-right text-danger">Tax Ded</th>
                                <th className="px-3 py-2 text-right text-danger">Other Deduc</th>
                                <th className="px-3 py-2 text-right">Net Pay</th>
                                <th className="px-3 py-2 text-center">Edit</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {runDetail.payslips.map((slip: any) => (
                                <tr key={slip.id} className="hover:bg-surface-50">
                                  <td className="px-3 py-2"><span className="font-medium">{slip.employee.firstName} {slip.employee.lastName}</span> <span className="text-content-tertiary">{slip.employee.employeeCode}</span></td>
                                  <td className="px-3 py-2 text-right text-success-dark">{fmt(salaryOf(slip))}</td>
                                  <td className="px-3 py-2 text-right text-success-dark">{fmt(addEarnOf(slip))}</td>
                                  <td className="px-3 py-2 text-right text-brand-600">{fmt(reimbOf(slip))}</td>
                                  <td className="px-3 py-2 text-right text-danger">{fmt(slip.tds)}</td>
                                  <td className="px-3 py-2 text-right text-danger">{fmt(otherDedOf(slip))}</td>
                                  <td className="px-3 py-2 text-right font-bold text-success-dark">{fmt(slip.netPay)}</td>
                                  <td className="px-3 py-2 text-center">
                                    {!['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(activeRun.status) && (
                                      <Button variant="ghost" size="xs" icon={<Pencil />} onClick={() => openModify(slip)}>Edit</Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-content-tertiary">No payroll run for this month yet.</p>
                      <Button variant="primary" size="sm" loading={busy === 'runPayroll'} onClick={() => doAction('runPayroll')}>
                        Run Payroll
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Attendance Report Modal */}
      <Modal open={showReport} onClose={() => setShowReport(false)} title={`Attendance Report — ${monthNames[month]} ${year}`} size="xl">
        {attendanceReport && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span><strong>Working Days:</strong> {attendanceReport.workingDays}</span>
              <span><strong>Holidays:</strong> {attendanceReport.holidays}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-surface-50">
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-center">Present</th>
                    <th className="px-3 py-2 text-center">Absent</th>
                    <th className="px-3 py-2 text-center">Half Day</th>
                    <th className="px-3 py-2 text-center">Leave</th>
                    <th className="px-3 py-2 text-center">WFH</th>
                    <th className="px-3 py-2 text-center">Paid Days</th>
                    <th className="px-3 py-2 text-center">LOP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendanceReport.employees?.map((emp: any) => (
                    <tr key={emp.employeeId} className="hover:bg-surface-50">
                      <td className="px-3 py-2">
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-content-tertiary">{emp.employeeCode}</p>
                      </td>
                      <td className="px-3 py-2 text-center text-success-dark font-medium">{emp.present}</td>
                      <td className="px-3 py-2 text-center text-danger font-medium">{emp.absent}</td>
                      <td className="px-3 py-2 text-center">{emp.halfDay}</td>
                      <td className="px-3 py-2 text-center">{emp.leave}</td>
                      <td className="px-3 py-2 text-center">{emp.wfh}</td>
                      <td className="px-3 py-2 text-center font-semibold">{emp.paidDays}</td>
                      <td className="px-3 py-2 text-center text-danger font-medium">{emp.lopDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Payslip Review Modal */}
      <Modal open={showRunDetail} onClose={() => setShowRunDetail(false)} title="Payroll Run — Review Payslips" size="xl">
        {runDetail && (
          <div className="space-y-3">
            {!['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(runDetail.status) && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-surface-200 bg-surface-50 p-3">
                <div className="flex flex-col">
                  <label className="mb-1 text-[11px] font-semibold uppercase text-content-tertiary">
                    Add head to all {runDetail.payslips?.length || 0} payslips
                  </label>
                  <select value={bulkHead.type} onChange={(e) => setBulkHead({ ...bulkHead, type: e.target.value })}
                    className="h-9 rounded-lg border border-surface-200 bg-white px-2 text-xs">
                    <option value="EARNING">Earning (add)</option>
                    <option value="DEDUCTION">Deduction (subtract)</option>
                    <option value="REIMBURSEMENT">Reimbursement (non-taxable)</option>
                  </select>
                </div>
                <input type="text" list={`bulk-heads-${bulkHead.type}`} placeholder="Head name (e.g. Bonus, Advance)"
                  value={bulkHead.label} onChange={(e) => setBulkHead({ ...bulkHead, label: e.target.value })}
                  className="h-9 min-w-[160px] flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm" />
                <datalist id="bulk-heads-EARNING">{payHeads.filter((h: any) => h.type === 'EARNING').map((h: any) => <option key={h.id} value={h.name} />)}</datalist>
                <datalist id="bulk-heads-DEDUCTION">{payHeads.filter((h: any) => h.type === 'DEDUCTION').map((h: any) => <option key={h.id} value={h.name} />)}</datalist>
                <datalist id="bulk-heads-REIMBURSEMENT">{REIMBURSEMENT_SUGGESTIONS.map((r) => <option key={r} value={r} />)}</datalist>
                <input type="number" placeholder="Amount" value={bulkHead.amount || ''}
                  onChange={(e) => setBulkHead({ ...bulkHead, amount: +e.target.value })}
                  className="h-9 w-28 rounded-lg border border-surface-200 bg-white px-3 text-sm" />
                <Button size="sm" loading={busy === 'bulkHead'} onClick={applyBulkHead}>Apply to all</Button>
                {runHeads.length > 0 && (
                  <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-surface-200 pt-2">
                    <span className="text-[11px] font-semibold uppercase text-content-tertiary">Heads on this run:</span>
                    {runHeads.map((h) => (
                      <button key={`${h.type}|${h.label}`} type="button"
                        onClick={() => removeBulkHead(h.type, h.label)}
                        disabled={busy === `removeHead:${h.type}:${h.label}`}
                        title={`Remove "${h.label}" from all ${h.count} payslip${h.count === 1 ? '' : 's'} that have it`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:bg-danger/5 disabled:opacity-50 ${h.type === 'DEDUCTION' ? 'border-danger/30 text-danger' : 'border-success/30 text-success-dark'}`}>
                        {h.type === 'DEDUCTION' ? '−' : '+'}{fmt(h.total)} · {h.label} ({h.count})
                        <Trash2 size={11} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-surface-50">
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-right">Basic</th>
                  <th className="px-3 py-2 text-right">HRA</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">PF</th>
                  <th className="px-3 py-2 text-right">ESI</th>
                  <th className="px-3 py-2 text-right">PT</th>
                  <th className="px-3 py-2 text-right">TDS</th>
                  <th className="px-3 py-2 text-right">Deductions</th>
                  <th className="px-3 py-2 text-right">Net Pay</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runDetail.payslips?.map((slip: any) => (
                  <tr key={slip.id} className="hover:bg-surface-50">
                    <td className="px-3 py-2">
                      <p className="font-medium">{slip.employee.firstName} {slip.employee.lastName}</p>
                      <p className="text-content-tertiary">{slip.employee.employeeCode}</p>
                      {Array.isArray(slip.adjustments) && slip.adjustments.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {slip.adjustments.map((a: any, i: number) => (
                            <span key={i}
                              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${a.type === 'DEDUCTION' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success-dark'}`}
                              title={a.type === 'REIMBURSEMENT' ? 'Non-taxable reimbursement' : a.type}>
                              {a.type === 'DEDUCTION' ? '−' : '+'}{fmt(a.amount)} · {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-success-dark">{fmt(slip.basic)}</td>
                    <td className="px-3 py-2 text-right text-success-dark">{fmt(slip.hra)}</td>
                    <td className="px-3 py-2 text-right font-medium text-success-dark">{fmt(slip.grossEarnings)}</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(slip.pfEmployee)}</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(slip.esiEmployee)}</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(slip.profTax)}</td>
                    <td className="px-3 py-2 text-right text-danger">{fmt(slip.tds)}</td>
                    <td className="px-3 py-2 text-right text-danger font-medium">{fmt(slip.totalDeductions)}</td>
                    <td className="px-3 py-2 text-right font-bold text-success-dark">{fmt(slip.netPay)}</td>
                    <td className="px-3 py-2 text-center">
                      {!['FROZEN', 'BANK_GENERATED', 'FINALIZED', 'PAID'].includes(runDetail.status) && (
                        <Button variant="ghost" size="xs" icon={<Pencil />} onClick={() => openModify(slip)}>Edit</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modify Payslip Modal */}
      <Modal open={showModify} onClose={() => setShowModify(false)} title={`Modify Payslip — ${modifySlip?.employee?.firstName} ${modifySlip?.employee?.lastName}`} size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowModify(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={busy === 'modify'} onClick={saveModify}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-content-tertiary uppercase">Earnings</h4>
          <div className="grid grid-cols-2 gap-3">
            {['basic', 'hra', 'da', 'specialAllow'].map((f) => (
              <div key={f}>
                <label className="block text-xs text-content-secondary mb-1 capitalize">{f.replace(/([A-Z])/g, ' $1')}</label>
                <input type="number" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm font-medium text-success-dark" value={modifyForm[f] || 0} onChange={(e) => setModifyForm({ ...modifyForm, [f]: +e.target.value })} />
              </div>
            ))}
          </div>
          <h4 className="text-xs font-semibold text-content-tertiary uppercase pt-2">Deductions</h4>
          <div className="grid grid-cols-2 gap-3">
            {['pfEmployee', 'esiEmployee', 'profTax', 'tds'].map((f) => (
              <div key={f}>
                <label className="block text-xs text-content-secondary mb-1 capitalize">{f.replace(/([A-Z])/g, ' $1')}</label>
                <input type="number" className="w-full h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm font-medium text-danger" value={modifyForm[f] || 0} onChange={(e) => setModifyForm({ ...modifyForm, [f]: +e.target.value })} />
              </div>
            ))}
          </div>

          {/* Additional heads — this payslip only (NOT pay structure) */}
          <div className="pt-3 border-t border-surface-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-content-tertiary uppercase">Additional Heads (this payslip only)</h4>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustments([...adjustments, { type: 'EARNING', label: '', amount: 0 }])} className="text-xs font-medium text-success-dark hover:underline">+ Earning</button>
                <button type="button" onClick={() => setAdjustments([...adjustments, { type: 'DEDUCTION', label: '', amount: 0 }])} className="text-xs font-medium text-danger hover:underline">+ Deduction</button>
                <button type="button" onClick={() => setAdjustments([...adjustments, { type: 'REIMBURSEMENT', label: '', amount: 0 }])} className="text-xs font-medium text-brand-600 hover:underline">+ Reimbursement</button>
              </div>
            </div>
            <datalist id="heads-EARNING">{payHeads.filter((h) => h.type === 'EARNING').map((h) => (<option key={h.id} value={h.name} />))}</datalist>
            <datalist id="heads-DEDUCTION">{payHeads.filter((h) => h.type === 'DEDUCTION').map((h) => (<option key={h.id} value={h.name} />))}</datalist>
            <datalist id="heads-REIMBURSEMENT">{REIMBURSEMENT_SUGGESTIONS.map((r) => (<option key={r} value={r} />))}</datalist>
            {adjustments.length === 0 && <p className="text-xs text-content-tertiary">No extra heads. Add one-off earnings/deductions for this payslip without changing the pay structure.</p>}
            <div className="space-y-2">
              {adjustments.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={a.type} onChange={(e) => { const n = [...adjustments]; n[i] = { ...n[i], type: e.target.value }; setAdjustments(n); }} className="h-9 rounded-lg border border-surface-200 bg-white px-2 text-xs">
                    <option value="EARNING">Earning</option>
                    <option value="DEDUCTION">Deduction</option>
                    <option value="REIMBURSEMENT">Reimbursement</option>
                  </select>
                  <input type="text" list={`heads-${a.type}`} placeholder="Pick a pay head or type one" value={a.label} onChange={(e) => { const n = [...adjustments]; n[i] = { ...n[i], label: e.target.value }; setAdjustments(n); }} className="flex-1 h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm" />
                  <input type="number" placeholder="0" value={a.amount} onChange={(e) => { const n = [...adjustments]; n[i] = { ...n[i], amount: +e.target.value }; setAdjustments(n); }} className={`w-28 h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm font-medium ${a.type === 'DEDUCTION' ? 'text-danger' : 'text-success-dark'}`} />
                  <button type="button" onClick={() => setAdjustments(adjustments.filter((_, j) => j !== i))} className="text-danger hover:text-danger-dark p-1" title="Remove head"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
