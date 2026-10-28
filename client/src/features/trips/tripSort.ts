// Upcoming/past grouping shared by the sidebar and home pane.
import type { Trip } from '@shared/types';
import { isPastTrip } from '../../lib/time';

/** Current + future trips soonest first (undated last), past trips most recent first. */
export function splitTrips(trips: Trip[]): { upcoming: Trip[]; past: Trip[] } {
  const start = (t: Trip) => (t.has_dates && t.starts_at ? t.starts_at : null);
  const upcoming = trips
    .filter((t) => !isPastTrip(t))
    .sort((a, b) => {
      const x = start(a);
      const y = start(b);
      if (x && y) return x.localeCompare(y);
      return x ? -1 : y ? 1 : a.name.localeCompare(b.name);
    });
  const past = trips
    .filter(isPastTrip)
    .sort((a, b) => (b.ends_at ?? b.starts_at ?? '').localeCompare(a.ends_at ?? a.starts_at ?? ''));
  return { upcoming, past };
}
