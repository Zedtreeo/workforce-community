/**
 * IST (Asia/Kolkata) date helpers for the web client.
 *
 * All monitoring + attendance UI uses these so display is consistent
 * regardless of the admin's browser timezone.
 */

export const IST_TZ = 'Asia/Kolkata';

/** Today as YYYY-MM-DD in IST (use for <input type="date"> defaults). */
export function todayIST(): string {
  // en-CA yields YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TZ });
}

/** Format an ISO timestamp as HH:MM (24h IST). */
export function fmtTimeIST(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: IST_TZ,
  });
}

/** Format an ISO timestamp as a date (locale-friendly IST). */
export function fmtDateIST(
  iso: string | Date,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    ...(opts || {}),
  });
}

/** Format an ISO timestamp as date + time (IST). */
export function fmtDateTimeIST(iso: string | Date): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: IST_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Extract IST hour (0-23) from an ISO timestamp. */
export function istHour(iso: string | Date): number {
  const h = new Date(iso).toLocaleString('en-US', {
    timeZone: IST_TZ,
    hour: '2-digit',
    hour12: false,
  });
  // toLocaleString may return "24" for midnight in some locales; normalize
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}
