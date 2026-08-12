'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Button, Card, Badge, Pagination, PageSkeleton, PageHeader } from '../../components/ui';
import { ScrollText, Upload, Download } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
interface AuditPage { data: AuditLog[]; total: number; page: number; limit: number; totalPages: number }
interface ImportResult { created: number; skipped: number; errors: string[] }

const ACTION_BADGE_MAP: Record<string, 'success' | 'info' | 'danger' | 'default'> = {
  CREATE: 'success',
  IMPORT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  LOGIN: 'default',
  EXPORT: 'default',
};

export default function AuditPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<'logs' | 'import' | 'export'>('logs');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(true);

  const [importJson, setImportJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!session?.session?.token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterEntity) params.set('entity', filterEntity);
      if (filterAction) params.set('action', filterAction);
      const res = await apiFetch<AuditPage>(`/audit/logs?${params}`, { token: session.session.token });
      setLogs(res.data); setTotal(res.total); setTotalPages(res.totalPages);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [session?.session?.token, page, filterEntity, filterAction]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleImport = async () => {
    if (!session?.session?.token || !importJson.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const rows = JSON.parse(importJson);
      if (!Array.isArray(rows)) throw new Error('Input must be a JSON array');
      const res = await apiFetch<ImportResult>('/audit/employees/import', {
        method: 'POST',
        token: session.session.token,
        body: JSON.stringify({ rows }),
      });
      setImportResult(res);
    } catch (e: any) {
      alert(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (f.name.endsWith('.csv')) {
        try {
          const lines = text.trim().split('\n');
          const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
          const rows = lines.slice(1).map((line) => {
            const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''));
            const obj: any = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
            if (obj.salary) obj.salary = Number(obj.salary);
            return obj;
          });
          setImportJson(JSON.stringify(rows, null, 2));
        } catch { setImportJson(text); }
      } else {
        setImportJson(text);
      }
    };
    reader.readAsText(f);
  };

  const handleExport = async () => {
    if (!session?.session?.token) return;
    setExporting(true);
    try {
      const data = await apiFetch<any[]>('/audit/employees/export', { token: session.session.token });
      if (!data.length) { alert('No employees to export'); return; }
      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(','),
        ...data.map((row) => headers.map((h) => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `employees_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getActionBadge = (action: string): 'success' | 'info' | 'danger' | 'default' => {
    if (action.includes('CREATE') || action === 'IMPORT') return 'success';
    if (action.includes('UPDATE')) return 'info';
    if (action.includes('DELETE')) return 'danger';
    return 'default';
  };

  if (loading && logs.length === 0) return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;

  const tabItems = [
    { key: 'logs', label: 'Audit Logs' },
    { key: 'import', label: 'Bulk Import' },
    { key: 'export', label: 'Export Employees' },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Audit Log & Bulk Operations"
          description="Track system changes and manage bulk data operations"
          breadcrumbs={[{ label: 'Audit Log' }]}
        />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-surface-200">
          {tabItems.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Audit Logs */}
        {tab === 'logs' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select className="h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}>
                <option value="">All Entities</option>
                {['Employee', 'Department', 'Client', 'Invoice', 'Leave', 'Attendance', 'Payroll', 'Document', 'Holiday', 'Shift', 'Setting', 'User'].map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <select className="h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500" value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}>
                <option value="">All Actions</option>
                {['CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT', 'LOGIN', 'APPROVE', 'REJECT'].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <span className="text-sm text-content-tertiary self-center ml-auto">{total} total entries</span>
            </div>

            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Timestamp</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Action</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Entity</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Entity ID</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-content-tertiary whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getActionBadge(log.action)}>{log.action}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-content-primary">{log.entity}</td>
                        <td className="px-4 py-3 text-xs text-content-tertiary font-mono">{log.entityId ? log.entityId.slice(0, 8) + '...' : '—'}</td>
                        <td className="px-4 py-3 text-xs text-content-tertiary max-w-xs truncate">
                          {log.changes ? JSON.stringify(log.changes).slice(0, 80) : '—'}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-content-tertiary">No audit logs found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
            )}
          </div>
        )}

        {/* Bulk Import */}
        {tab === 'import' && (
          <div className="max-w-3xl space-y-4">
            <Card>
              <h3 className="font-semibold text-content-primary mb-1">Bulk Import Employees</h3>
              <p className="text-sm text-content-tertiary mb-4">Upload a CSV or paste a JSON array of employees. Required fields: employeeCode, firstName, lastName, email, joinDate, salary</p>

              <div className="mb-4">
                <input ref={fileRef} type="file" accept=".csv,.json" className="w-full h-9 px-3 rounded-lg border border-surface-200 bg-white text-sm text-content-primary file:mr-3 file:border-0 file:bg-brand-50 file:text-brand-700 file:text-xs file:font-medium file:px-3 file:py-1 file:rounded" onChange={handleFileUpload} />
              </div>

              <textarea
                rows={12}
                className="w-full px-3 py-2 rounded-lg border border-surface-200 bg-white text-sm font-mono text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={`[\n  {\n    "employeeCode": "EMP001",\n    "firstName": "John",\n    "lastName": "Doe",\n    "email": "john@example.com",\n    "joinDate": "2024-01-15",\n    "salary": 50000,\n    "designation": "Developer",\n    "departmentCode": "ENG"\n  }\n]`}
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
              />

              <div className="flex items-center gap-3 mt-4">
                <Button icon={<Upload size={14} />} onClick={handleImport} disabled={!importJson.trim()} loading={importing}>
                  Import Employees
                </Button>
                <Button variant="secondary" onClick={() => { setImportJson(''); setImportResult(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  Clear
                </Button>
              </div>

              {importResult && (
                <div className="mt-4 p-4 bg-surface-50 rounded-lg">
                  <p className="text-sm font-medium text-content-primary mb-2">Import Results</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-success-dark font-medium">{importResult.created} created</span>
                    <span className="text-warning-dark font-medium">{importResult.skipped} skipped (duplicates)</span>
                    <span className="text-danger-dark font-medium">{importResult.errors.length} errors</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-danger-dark space-y-1">
                      {importResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-content-primary mb-1">CSV Template</h3>
              <p className="text-sm text-content-tertiary mb-3">Use this header row for your CSV file:</p>
              <code className="block text-xs bg-surface-50 p-3 rounded-lg overflow-x-auto text-content-secondary">
                employeeCode,firstName,lastName,email,phone,designation,departmentCode,joinDate,salary
              </code>
            </Card>
          </div>
        )}

        {/* Export */}
        {tab === 'export' && (
          <div className="max-w-xl">
            <Card>
              <h3 className="font-semibold text-content-primary mb-1">Export All Employees</h3>
              <p className="text-sm text-content-tertiary mb-4">Download all active employees as a CSV file including personal details, department, salary, and compliance fields.</p>
              <Button icon={<Download size={14} />} onClick={handleExport} loading={exporting}>
                Download CSV
              </Button>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
