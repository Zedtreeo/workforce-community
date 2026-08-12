'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { downloadCSV } from '../../../lib/csv-export';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader } from '../../../components/ui';

interface EmpHours {
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; designation: string | null };
  daysWorked: number;
  totalHours: number;
  avgHoursPerDay: number;
  dailyBreakdown: { date: string; hours: number; sessions: number }[];
}

export default function WorkHoursReportPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<EmpHours[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchReport = useCallback(async () => {
    if (!session?.session?.id || !startDate || !endDate) return;
    setLoading(true);
    try {
      const result = await apiFetch<{ summary: EmpHours[] }>(`/reports/work-hours?startDate=${startDate}&endDate=${endDate}`);
      setData(result.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    const rows: any[] = [];
    data.forEach((e) => {
      e.dailyBreakdown.forEach((d) => {
        rows.push({
          Employee: `${e.employee.firstName} ${e.employee.lastName}`,
          Code: e.employee.employeeCode,
          Date: d.date,
          Hours: d.hours,
          Sessions: d.sessions,
        });
      });
    });
    downloadCSV(rows, `work-hours-${startDate}-to-${endDate}`);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Work Hours Report"
          breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Work Hours' }]}
          actions={
            <div className="flex items-center gap-3">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <span className="text-content-tertiary">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <Button onClick={fetchReport}>Generate</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={data.length === 0}>Export CSV</Button>
            </div>
          }
        />

        {loading ? (
          <div className="text-center py-12 text-content-tertiary">Generating report...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary">No work hours data for this period</div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Days Worked</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Total Hours</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Avg Hours/Day</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <>
                    <tr key={e.employee.id} className="border-b border-surface-100 hover:bg-surface-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-content-primary">{e.employee.firstName} {e.employee.lastName}</p>
                        <p className="text-xs text-content-tertiary">{e.employee.employeeCode} · {e.employee.designation || 'N/A'}</p>
                      </td>
                      <td className="px-5 py-3 text-center font-medium">{e.daysWorked}</td>
                      <td className="px-5 py-3 text-center font-bold text-brand-600">{e.totalHours}h</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-medium ${e.avgHoursPerDay >= 7 ? 'text-success-dark' : e.avgHoursPerDay >= 5 ? 'text-warning-dark' : 'text-danger-dark'}`}>
                          {e.avgHoursPerDay}h
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setExpanded(expanded === e.employee.id ? null : e.employee.id)}
                          className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                        >
                          {expanded === e.employee.id ? 'Hide' : 'Show Daily'}
                        </button>
                      </td>
                    </tr>
                    {expanded === e.employee.id && e.dailyBreakdown.map((d) => (
                      <tr key={`${e.employee.id}-${d.date}`} className="bg-surface-50 border-b border-surface-100">
                        <td className="px-5 py-2 pl-12 text-xs text-content-tertiary">{d.date}</td>
                        <td className="px-5 py-2 text-center text-xs text-content-tertiary">{d.sessions} sessions</td>
                        <td className="px-5 py-2 text-center text-xs font-medium">{d.hours}h</td>
                        <td colSpan={2}></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
