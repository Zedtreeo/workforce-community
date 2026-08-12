'use client';

import { CalendarDays } from 'lucide-react';

export interface HolidayLike {
  id: string;
  date: string;          // ISO; only the YYYY-MM-DD portion is used
  name: string;
  isOptional: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A 12-month year calendar that highlights holidays. Mandatory holidays are
 * filled brand, optional ones amber; today gets a ring. Hovering a day shows
 * the holiday name. Read-only — used on the employee, admin and client views.
 */
export function HolidayCalendar({ holidays, year }: { holidays: HolidayLike[]; year: number }) {
  const byDate = new Map<string, HolidayLike>();
  for (const h of holidays) byDate.set(h.date.slice(0, 10), h);

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-content-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-brand-500" /> Holiday
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-200 ring-1 ring-amber-400" /> Optional
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded ring-1 ring-brand-500" /> Today
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {MONTHS.map((monthName, m) => {
          const firstWeekday = new Date(year, m, 1).getDay();
          const daysInMonth = new Date(year, m + 1, 0).getDate();
          const cells: (number | null)[] = [
            ...Array(firstWeekday).fill(null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];
          const monthHasHoliday = cells.some(
            (d) => d !== null && byDate.has(`${year}-${pad(m + 1)}-${pad(d)}`),
          );

          return (
            <div
              key={monthName}
              className={`rounded-xl border p-3 ${monthHasHoliday ? 'border-surface-200' : 'border-surface-100'}`}
            >
              <div className="text-sm font-semibold text-content-primary mb-2">{monthName}</div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-medium text-content-tertiary">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const key = `${year}-${pad(m + 1)}-${pad(d)}`;
                  const hol = byDate.get(key);
                  const isToday = key === todayKey;
                  let cls = 'text-content-secondary';
                  if (hol && !hol.isOptional) cls = 'bg-brand-500 text-white font-semibold';
                  else if (hol && hol.isOptional) cls = 'bg-amber-100 text-amber-800 ring-1 ring-amber-300 font-medium';
                  if (isToday) cls += ' ring-2 ring-brand-500';
                  return (
                    <div
                      key={i}
                      title={hol ? `${hol.name}${hol.isOptional ? ' (Optional)' : ''}` : undefined}
                      className={`h-6 flex items-center justify-center rounded text-[11px] ${cls} ${hol ? 'cursor-default' : ''}`}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {holidays.length > 0 && (
        <div className="pt-4 mt-2 border-t border-surface-100">
          <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-3">
            Holiday List ({year})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {[...holidays]
              .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))
              .map((h) => {
                const [y, m, d] = h.date.slice(0, 10).split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                const label = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
                return (
                  <div key={h.id} className="flex items-baseline gap-2 text-sm">
                    <span className="w-24 shrink-0 text-xs text-content-tertiary tabular-nums">{label}</span>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.isOptional ? 'bg-amber-400' : 'bg-brand-500'}`} />
                    <span className="text-content-primary">
                      {h.name}
                      {h.isOptional && <span className="ml-1 text-[10px] text-amber-600">(Optional)</span>}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {holidays.length === 0 && (
        <div className="text-center py-8 text-content-tertiary">
          <CalendarDays size={36} className="mx-auto mb-2" />
          No holidays found for {year}.
        </div>
      )}
    </div>
  );
}
