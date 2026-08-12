'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { downloadCSV } from '../../../lib/csv-export';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, PageHeader } from '../../../components/ui';

interface EmpSummary {
  employee: { id: string; firstName: string; lastName: string; employeeCode: string; designation: string | null; department: { name: string } | null };
  present: number; absent: number; halfDay: number; leave: number; wfh: number; totalDays: number;
}

interface Record_ {
  date: string; employeeId: string; employeeName: string; employeeCode: string; department: string | null;
  status: string; checkIn: string | null; checkOut: string | null; workHours: number | null;
}

export default function AttendanceReportPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<EmpSummary[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchReport = useCallback(async () => {
    if (!session?.session?.id || !startDate || !endDate) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ summary: EmpSummary[]; records: Record_[] }>(
        `/reports/attendance?startDate=${startDate}&endDate=${endDate}`,
      );
      setSummary(data.summary);
      setRecords(data.records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [session, startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCSV = () => {
    downloadCSV(
      summary.map((s) => ({
        Employee: `${s.employee.firstName} ${s.employee.lastName}`,
        Code: s.employee.employeeCode,
        Department: s.employee.department?.name || '',
        Present: s.present,
        Absent: s.absent,
        HalfDay: s.halfDay,
        Leave: s.leave,
        WFH: s.wfh,
        TotalDays: s.totalDays,
      })),
      `attendance-report-${startDate}-to-${endDate}`,
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Attendance Report"
          breadcrumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Attendance' }]}
          actions={
            <div className="flex items-center gap-3">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <span className="text-content-tertiary">to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-surface-200 rounded-lg text-sm text-content-primary focus:ring-brand-500 focus:outline-none" />
              <Button onClick={fetchReport}>Generate</Button>
              <Button variant="secondary" onClick={exportCSV} disabled={summary.length === 0}>Export CSV</Button>
            </div>
          }
        />

        {loading ? (
          <div className="text-center py-12 text-content-tertiary">Generating report...</div>
        ) : summary.length === 0 ? (
          <div className="text-center py-12 text-content-tertiary">No attendance data for this period</div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Department</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Present</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Absent</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Half Day</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Leave</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">WFH</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Total</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => {
                  const pct = s.totalDays > 0 ? Math.round(((s.present + s.wfh + s.halfDay * 0.5) / s.totalDays) * 100) : 0;
                  return (
                    <tr key={s.employee.id} className="border-b border-surface-100 hover:bg-surface-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-content-primary">{s.employee.firstName} {s.employee.lastName}</p>
                        <p className="text-xs text-content-tertiary">{s.employee.employeeCode}</p>
                      </td>
                      <td className="px-5 py-3 text-content-secondary">{s.employee.department?.name || '—'}</td>
                      <td className="px-5 py-3 text-center text-success-dark font-medium">{s.present}</td>
                      <td className="px-5 py-3 text-center text-danger-dark font-medium">{s.absent}</td>
                      <td className="px-5 py-3 text-center text-warning-dark">{s.halfDay}</td>
                      <td className="px-5 py-3 text-center text-brand-600">{s.leave}</td>
                      <td className="px-5 py-3 text-center text-brand-600">{s.wfh}</td>
                      <td className="px-5 py-3 text-center font-medium">{s.totalDays}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`font-bold ${pct >= 90 ? 'text-success-dark' : pct >= 75 ? 'text-warning-dark' : 'text-danger-dark'}`}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
