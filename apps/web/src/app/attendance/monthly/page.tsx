'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, CalendarClock, X } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, PageHeader, EmptyState } from '../../../components/ui';
import { EmployeeMonthlyAttendance } from '../../../components/attendance/employee-monthly-attendance';

interface Emp { id: string; employeeCode: string; firstName: string; lastName: string }

export default function MonthlyAttendancePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Emp[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Emp | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q); setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!q.trim()) { setResults([]); return; }
      try {
        const res = await apiFetch<{ data: Emp[] }>(`/employees?search=${encodeURIComponent(q)}&limit=20&page=1`);
        setResults(res.data || []);
      } catch { setResults([]); }
    }, 250);
  }, []);

  const pick = (e: Emp) => { setPicked(e); setOpen(false); setQuery(''); };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Monthly Attendance"
          description="Search an employee to view their monthly attendance calendar and records."
        />

        {/* Employee picker */}
        <Card>
          <div className="relative max-w-md">
            {picked ? (
              <div className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg bg-surface-50 border border-surface-200">
                <span className="text-sm text-content-primary">
                  {picked.firstName} {picked.lastName} <span className="text-content-tertiary">· {picked.employeeCode}</span>
                </span>
                <button onClick={() => setPicked(null)} title="Change" className="text-content-tertiary hover:text-content-secondary">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary" />
                <input
                  autoFocus value={query} onChange={(e) => search(e.target.value)} onFocus={() => setOpen(true)}
                  placeholder="Search employee by name or code…"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-surface-50 border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {open && results.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto bg-white border border-surface-200 rounded-lg shadow-overlay">
                    {results.map((e) => (
                      <button key={e.id} onClick={() => pick(e)} className="w-full text-left px-3 py-2 hover:bg-surface-50">
                        <p className="text-sm text-content-primary">{e.firstName} {e.lastName}</p>
                        <p className="text-[11px] text-content-tertiary">{e.employeeCode}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {picked ? (
          <EmployeeMonthlyAttendance employeeId={picked.id} />
        ) : (
          <EmptyState icon={<CalendarClock size={28} />} title="No employee selected" description="Search and pick an employee above to see their monthly attendance." />
        )}
      </div>
    </DashboardLayout>
  );
}
