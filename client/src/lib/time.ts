// Itinerary datetimes are UTC ISO-8601 with a separate IANA timezone. Forms edit
// local wall time in that timezone; these helpers convert both ways with date-fns-tz.
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function allTimeZones(): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  return fn ? fn('timeZone') : [browserTimeZone(), 'UTC'];
}

/** UTC ISO → `YYYY-MM-DDTHH:mm` in `tz`, for <input type="datetime-local">. */
export function utcToLocalInput(iso: string | null | undefined, tz: string | null | undefined): string {
  if (!iso) return '';
  return formatInTimeZone(iso, tz || 'UTC', "yyyy-MM-dd'T'HH:mm");
}

/** `YYYY-MM-DDTHH:mm` wall time in `tz` → UTC ISO (`2026-06-03T09:00:00Z`), or null. */
export function localInputToUtc(local: string, tz: string | null | undefined): string | null {
  if (!local) return null;
  return fromZonedTime(local, tz || 'UTC').toISOString().replace('.000Z', 'Z');
}

/** Local calendar day (`YYYY-MM-DD`) of a UTC instant in `tz`. */
export function localDay(iso: string, tz: string | null | undefined): string {
  return formatInTimeZone(iso, tz || 'UTC', 'yyyy-MM-dd');
}

/** Format a UTC instant in `tz`, e.g. fmtIn(iso, tz, 'h:mm a'). */
export function fmtIn(iso: string, tz: string | null | undefined, pattern: string): string {
  return formatInTimeZone(iso, tz || 'UTC', pattern);
}

/** Short zone label for a time, e.g. "EDT" or "GMT+2". */
export function zoneAbbr(iso: string, tz: string | null | undefined): string {
  return formatInTimeZone(iso, tz || 'UTC', 'zzz');
}

/** Parse a plain trip date `YYYY-MM-DD` as a local calendar date. */
export const parseDay = (d: string) => parseISO(d);
export const fmtDay = (d: string, pattern = 'EEE, MMM d') => format(parseISO(d), pattern);

/** Inclusive list of `YYYY-MM-DD` days between two plain dates. */
export function daysBetween(start: string, end: string): string[] {
  const s = parseISO(start);
  const n = Math.max(0, differenceInCalendarDays(parseISO(end), s));
  return Array.from({ length: n + 1 }, (_, i) => format(addDays(s, i), 'yyyy-MM-dd'));
}

export const todayDay = () => format(new Date(), 'yyyy-MM-dd');

/** Time-of-day bucket for the small glyph next to item times. */
export function timeOfDay(iso: string, tz: string | null | undefined): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = Number(formatInTimeZone(iso, tz || 'UTC', 'H'));
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** "Sep 15 → Sep 21", or "7 days" for undated trips. */
export function tripRange(trip: { has_dates: boolean; starts_at: string | null; ends_at: string | null; number_of_days: number }): string {
  if (!trip.has_dates || !trip.starts_at) {
    return trip.number_of_days ? `${trip.number_of_days} day${trip.number_of_days === 1 ? '' : 's'}` : 'No dates';
  }
  const s = parseISO(trip.starts_at);
  const e = trip.ends_at ? parseISO(trip.ends_at) : s;
  const sameYear = s.getFullYear() === e.getFullYear();
  const thisYear = s.getFullYear() === new Date().getFullYear();
  return `${format(s, sameYear && thisYear ? 'MMM d' : 'MMM d, yyyy')} → ${format(e, thisYear ? 'MMM d' : 'MMM d, yyyy')}`;
}

/** "Starts in 3 days · 7-day trip" style status line. */
export function tripStatus(trip: { has_dates: boolean; starts_at: string | null; ends_at: string | null; number_of_days: number }): string {
  if (!trip.has_dates || !trip.starts_at) return tripRange(trip);
  const start = parseISO(trip.starts_at);
  const end = trip.ends_at ? parseISO(trip.ends_at) : start;
  const length = differenceInCalendarDays(end, start) + 1;
  const toStart = differenceInCalendarDays(start, new Date());
  const toEnd = differenceInCalendarDays(end, new Date());
  const lenText = `${length}-day trip`;
  if (toStart > 1) return `Starts in ${toStart} days · ${lenText}`;
  if (toStart === 1) return `Starts tomorrow · ${lenText}`;
  if (toStart === 0) return `Starts today · ${lenText}`;
  if (toEnd >= 0) return `Day ${-toStart + 1} of ${length}`;
  return `Ended · ${lenText}`;
}

/** True when the trip's last day is before today. */
export function isPastTrip(trip: { has_dates: boolean; starts_at: string | null; ends_at: string | null }): boolean {
  if (!trip.has_dates || !trip.starts_at) return false;
  return differenceInCalendarDays(parseISO(trip.ends_at ?? trip.starts_at), new Date()) < 0;
}
