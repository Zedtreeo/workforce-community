'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { downloadCSV } from '../../../lib/csv-export';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader } from '../../../components/ui';

interface EmpProductivity {
  employee: { id: string; name: string; employeeCode: string; designation: string | null; clientName: string | null };
  avgActivity: number;
  totalSnapshots: number;
  totalKeystrokes: number;
  totalClicks: number;
  totalWorkHours: number;
}

interface ProdData {
  period: { startDate: string; endDate: string };
  employees: EmpProductivity[];
  teamAvgActivity: number;
}

export default function ProductivityReportPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ProdData | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [startDate, setStartDate] = useState(weekAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchReport = useCallback(async () => {
    if (!session?.session?.id || !startDate || !endDate) return;
    setLoading(true);
    try {
      const result = await apiFetch<ProdData>(`/reports/productivity?startDate=${startDate}&endDate=${endDate}`);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    if (!data) return;
    downloadCSV(
      data.employees.map((e) => ({
        Employee: e.employee.name,
        Code: e.employee.employeeCode,
        Client: e.employee.clientName || '',
        'Avg Activity %': e.avgActivity,
        'Work Hours': e.totalWorkHours,
        Snapshots: e.totalSnapshots,
        Keystrokes: e.totalKeystrokes,
        Clicks: e.totalClicks,
      })),
      `productivity-${startDate}-to-${endDate}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Productivity Report"
          breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Productivity' }]}
          actions={
            <div className="flex items-center gap-3">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <span className="text-content-tertiary">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <Button onClick={fetchReport}>Generate</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={!data || data.employees.length === 0}>Export CSV</Button>
            </div>
          }
        />

        {data && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-sm text-content-tertiary">Team Avg Activity</p>
              <p className={`text-2xl font-bold mt-1 ${data.teamAvgActivity >= 60 ? 'text-success-dark' : 'text-warning-dark'}`}>{data.teamAvgActivity}%</p>
            </Card>
            <Card>
              <p className="text-sm text-content-tertiary">Employees Tracked</p>
              <p className="text-2xl font-bold mt-1 text-content-primary">{data.employees.length}</p>
            </Card>
            <Card>
              <p className="text-sm text-content-tertiary">Total Snapshots</p>
              <p className="text-2xl font-bold mt-1 text-content-primary">{data.employees.reduce((s, e) => s + e.totalSnapshots, 0).toLocaleString()}</p>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-content-tertiary">Generating report...</div>
        ) : !data || data.employees.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary">No productivity data for this period</div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Rank</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Client</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Activity %</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Work Hours</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Snapshots</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Keystrokes</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e, i) => (
                  <tr key={e.employee.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-5 py-3 text-content-tertiary font-medium">#{i + 1}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-content-primary">{e.employee.name}</p>
                      <p className="text-xs text-content-tertiary">{e.employee.employeeCode} · {e.employee.designation || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-3 text-content-secondary">{e.employee.clientName || '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-2 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${e.avgActivity >= 70 ? 'bg-success' : e.avgActivity >= 40 ? 'bg-warning' : 'bg-danger'}`}
                            style={{ width: `${Math.min(e.avgActivity, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold">{e.avgActivity}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center font-medium">{e.totalWorkHours}h</td>
                    <td className="px-5 py-3 text-center text-content-secondary">{e.totalSnapshots}</td>
                    <td className="px-5 py-3 text-center text-content-secondary">{e.totalKeystrokes.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center text-content-secondary">{e.totalClicks.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
