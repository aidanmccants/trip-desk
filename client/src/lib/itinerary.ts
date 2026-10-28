// Builds Tripsy's day-by-day timeline from the three itinerary lists. A hosting yields
// two entries (check-in and check-out); activities and transportations yield one.
import type { Activity, AnyItem, Hosting, ItemKind, Transportation, Trip } from '@shared/types';
import { daysBetween, localDay } from './time';

export interface TimelineEntry {
  /** Stable React key. */
  key: string;
  kind: ItemKind;
  item: AnyItem;
  /** UTC instant the entry sits at, or null for unscheduled items. */
  at: string | null;
  /** IANA zone the time is displayed in. */
  tz: string | null;
  /** Local day `YYYY-MM-DD` in `tz`, or null for unscheduled. */
  day: string | null;
  role: 'checkin' | 'checkout' | 'start' | 'departure';
  allDay: boolean;
}

export function buildTimeline(
  hostings: Hosting[],
  activities: Activity[],
  transportations: Transportation[],
  fallbackTz: string | null,
): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const push = (e: Omit<TimelineEntry, 'day'>) =>
    out.push({ ...e, day: e.at ? localDay(e.at, e.tz) : null });

  for (const h of hostings) {
    const tz = h.timezone || fallbackTz;
    push({ key: `h${h.id}-in`, kind: 'hosting', item: h, at: h.starts_at, tz, role: 'checkin', allDay: false });
    if (h.ends_at) push({ key: `h${h.id}-out`, kind: 'hosting', item: h, at: h.ends_at, tz, role: 'checkout', allDay: false });
  }
  for (const a of activities) {
    const tz = a.timezone || fallbackTz;
    push({ key: `a${a.id}`, kind: 'activity', item: a, at: a.starts_at, tz, role: 'start', allDay: a.all_day });
  }
  for (const t of transportations) {
    const tz = t.departure_timezone || fallbackTz;
    push({ key: `t${t.id}`, kind: 'transportation', item: t, at: t.departure_at, tz, role: 'departure', allDay: false });
  }
  // All-day entries first within a day, then by instant.
  return out.sort((a, b) => {
    if (!a.at || !b.at) return a.at ? -1 : b.at ? 1 : 0;
    if (a.day === b.day && a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.at.localeCompare(b.at);
  });
}

export interface TimelineDay {
  day: string;
  entries: TimelineEntry[];
}

/**
 * Days for the day picker: every trip day when the trip has dates, plus any day an
 * entry falls on outside that range. Unscheduled entries are returned separately.
 */
export function groupByDay(entries: TimelineEntry[], trip: Pick<Trip, 'has_dates' | 'starts_at' | 'ends_at'>): {
  days: TimelineDay[];
  unscheduled: TimelineEntry[];
} {
  const map = new Map<string, TimelineEntry[]>();
  if (trip.has_dates && trip.starts_at) {
    for (const d of daysBetween(trip.starts_at, trip.ends_at ?? trip.starts_at)) map.set(d, []);
  }
  const unscheduled: TimelineEntry[] = [];
  for (const e of entries) {
    if (!e.day) {
      unscheduled.push(e);
      continue;
    }
    if (!map.has(e.day)) map.set(e.day, []);
    map.get(e.day)!.push(e);
  }
  const days = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, es]) => ({ day, entries: es }));
  return { days, unscheduled };
}

/** One detail line for a row: flight number, address, room… */
export function detailLine(entry: TimelineEntry): string {
  const { kind, item, role } = entry;
  if (kind === 'hosting') {
    const h = item as Hosting;
    const room = [h.room_type, h.room_number && `Room ${h.room_number}`].filter(Boolean).join(' · ');
    return [role === 'checkin' ? 'Check-in' : 'Check-out', room || h.address].filter(Boolean).join(' · ');
  }
  if (kind === 'transportation') {
    const t = item as Transportation;
    const route = [t.departure_description, t.arrival_description].filter(Boolean).join(' → ');
    return [t.transport_number, route, t.company].filter(Boolean).join(' · ');
  }
  const a = item as Activity;
  return a.address ?? a.description ?? '';
}

/** Title for a row: transport shows "LAX → JFK" when both ends are known. */
export function entryTitle(entry: TimelineEntry): string {
  if (entry.kind === 'transportation') {
    const t = entry.item as Transportation;
    if (t.departure_description && t.arrival_description && !t.name) return `${t.departure_description} → ${t.arrival_description}`;
  }
  return entry.item.name || 'Untitled';
}
