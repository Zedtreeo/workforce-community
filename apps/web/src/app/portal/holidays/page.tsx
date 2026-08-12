'use client';

import { useEffect, useState } from 'react';

import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, PageSkeleton, PageHeader } from '../../../components/ui';
import { HolidayCalendar, type HolidayLike } from '../../../components/holiday-calendar';

export default function HolidaysPage() {
  const { data: session } = useSession();
  const [holidays, setHolidays] = useState<HolidayLike[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.session?.token) return;
    setLoading(true);
    apiFetch<HolidayLike[]>(`/portal/holidays?year=${year}`, { token: session.session.token })
      .then(setHolidays)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.session?.token, year]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Holidays"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Holidays' }]}
          actions={
            <select
              className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-surface-0"
              value={year}
              onChange={(e) => setYear(+e.target.value)}
            >
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          }
        />

        {loading ? (
          <PageSkeleton />
        ) : (
          <Card>
            <HolidayCalendar holidays={holidays} year={year} />
            {holidays.length > 0 && (
              <div className="flex gap-4 pt-4 mt-4 border-t border-surface-100">
                <p className="text-sm text-content-tertiary">
                  Total: <span className="font-medium text-content-primary">{holidays.length}</span>
                </p>
                <p className="text-sm text-content-tertiary">
                  Mandatory: <span className="font-medium text-content-primary">{holidays.filter((h) => !h.isOptional).length}</span>
                </p>
                <p className="text-sm text-content-tertiary">
                  Optional: <span className="font-medium text-content-primary">{holidays.filter((h) => h.isOptional).length}</span>
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
