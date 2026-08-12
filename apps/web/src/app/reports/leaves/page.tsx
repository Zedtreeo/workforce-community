'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { downloadCSV } from '../../../lib/csv-export';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, PageHeader } from '../../../components/ui';

interface LeaveTypeBalance {
  leaveType: { name: string; code: string; isPaid: boolean };
  entitled: number;
  used: number;
  available: number;
}

interface EmpLeave {
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
  types: LeaveTypeBalance[];
  totalEntitled: number;
  totalUsed: number;
  totalAvailable: number;
}

interface RecentReq {
  id: string; employeeName: string; employeeCode: string; leaveType: string; leaveCode: string;
  startDate: string; endDate: string; days: number; status: string; reason: string | null;
}

interface LeaveSummaryData {
  year: number;
  employees: EmpLeave[];
  recentRequests: RecentReq[];
}

const statusBadgeVariant: Record<string, 'warning' | 'success' | 'danger' | 'default'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'default',
};

export default function LeaveSummaryReportPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<LeaveSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchReport = useCallback(async () => {
    if (!session?.session?.id) return;
    setLoading(true);
    try {
      const result = await apiFetch<LeaveSummaryData>(`/reports/leaves?year=${year}`);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    if (!data) return;
    const rows: any[] = [];
    data.employees.forEach((emp) => {
      emp.types.forEach((t) => {
        rows.push({
          Employee: `${emp.employee.firstName} ${emp.employee.lastName}`,
          Code: emp.employee.employeeCode,
          LeaveType: t.leaveType.name,
          LeaveCode: t.leaveType.code,
          Entitled: t.entitled,
          Used: t.used,
          Available: t.available,
        });
      });
    });
    downloadCSV(rows, `leave-summary-${year}`);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Leave Summary"
          breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Leaves' }]}
          actions={
            <div className="flex items-center gap-3">
              <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <Button onClick={fetchReport}>Generate</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={!data || data.employees.length === 0}>Export CSV</Button>
            </div>
          }
        />

        {loading ? (
          <div className="text-center py-12 text-content-tertiary">Generating report...</div>
        ) : !data || data.employees.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary">No leave data for {year}. Initialize balances first.</div>
        ) : (
          <>
            {/* Balance Summary per Employee */}
            <div className="space-y-4">
              {data.employees.map((emp) => (
                <Card key={emp.employee.id} padding="none" className="overflow-hidden">
                  <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-content-primary">{emp.employee.firstName} {emp.employee.lastName}</span>
                      <span className="text-xs text-content-tertiary ml-2">{emp.employee.employeeCode}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span>Entitled: <strong>{emp.totalEntitled}</strong></span>
                      <span>Used: <strong className="text-warning-dark">{emp.totalUsed}</strong></span>
                      <span>Available: <strong className={emp.totalAvailable > 5 ? 'text-success-dark' : 'text-danger-dark'}>{emp.totalAvailable}</strong></span>
                    </div>
                  </div>
                  <div className="flex divide-x divide-surface-100">
                    {emp.types.map((t) => (
                      <div key={t.leaveType.code} className="flex-1 p-4 text-center">
                        <p className="text-xs text-content-tertiary">{t.leaveType.name} ({t.leaveType.code})</p>
                        <p className="text-lg font-bold mt-1">{t.available}<span className="text-xs text-content-tertiary font-normal">/{t.entitled}</span></p>
                        <p className="text-xs text-content-tertiary mt-0.5">{t.used} used</p>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>

            {/* Recent Requests */}
            {data.recentRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-content-primary mb-3">Recent Requests</h2>
                <Card padding="none" className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-50 border-b border-surface-200">
                        <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Type</th>
                        <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Period</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Days</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentRequests.map((r) => (
                        <tr key={r.id} className="border-b border-surface-100">
                          <td className="px-5 py-3">
                            <span className="font-medium">{r.employeeName}</span>
                            <span className="text-xs text-content-tertiary ml-1">{r.employeeCode}</span>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant="brand">{r.leaveCode}</Badge>
                          </td>
                          <td className="px-5 py-3 text-xs text-content-secondary">{formatDate(r.startDate)} — {formatDate(r.endDate)}</td>
                          <td className="px-5 py-3 text-center font-medium">{r.days}</td>
                          <td className="px-5 py-3 text-center">
                            <Badge variant={statusBadgeVariant[r.status] || 'default'}>{r.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
