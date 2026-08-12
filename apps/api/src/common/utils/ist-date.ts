/**
 * IST (Asia/Kolkata, UTC+5:30) date helpers.
 *
 * All monitoring/attendance date queries use IST day boundaries
 * (00:00:00 IST → 23:59:59.999 IST), translated to UTC for Prisma.
 *
 * Rationale: India-based users expect "May 22" to mean midnight-to-midnight
 * IST, not UTC. Without this helper, a screenshot captured at 23:30 IST
 * on May 22 would be filed under May 23 in a UTC-based query.
 */

const IST_OFFSET_MINUTES = 5 * 60 + 30; // +5:30

/**
 * Given an ISO date string (YYYY-MM-DD), return the UTC Date objects
 * that bound the IST day.
 *
 * istDayBoundsUTC('2026-05-22')
 *   -> { start: 2026-05-21T18:30:00.000Z, end: 2026-05-22T18:30:00.000Z }
 */
export function istDayBoundsUTC(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Midnight IST = Date.UTC(y,m,d,0,0,0) - 5:30
  const startUTC =
    Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0) -
    IST_OFFSET_MINUTES * 60 * 1000;
  const endUTC = startUTC + 24 * 60 * 60 * 1000;
  return { start: new Date(startUTC), end: new Date(endUTC) };
}

/**
 * Get the IST hour (0-23) from a Date or ISO string.
 *
 * istHour('2026-05-22T18:30:00.000Z') -> 0  (midnight IST)
 * istHour('2026-05-22T05:30:00.000Z') -> 11
 */
export function istHour(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d;
  const istMs = date.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).getUTCHours();
}

/**
 * Today's date in IST as YYYY-MM-DD.
 */
export function todayIST(): string {
  const now = new Date();
  const istMs = now.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(istMs).toISOString().split('T')[0];
}

/**
 * Convert a YYYY-MM-DD IST date to its UTC-midnight Date (start of day in IST).
 * Useful for legacy timeLog.date column which stores midnight Date.
 */
export function istDateStartUTC(dateStr: string): Date {
  return istDayBoundsUTC(dateStr).start;
}
