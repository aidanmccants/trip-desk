// Overview: boarding-pass card, today's itinerary, expenses, description and counts.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Plane, Sparkles, Users } from 'lucide-react';
import type { Trip, Transportation } from '@shared/types';
import { useCategories, useItinerary } from '../../lib/queries';
import { buildTimeline, entryTitle, groupByDay, type TimelineEntry } from '../../lib/itinerary';
import { ITINERARY_META, itemMeta, transportationMeta } from '../../lib/categories';
import { fmtDay, fmtIn, todayDay } from '../../lib/time';
import { CategoryBadge, ErrorNotice, SectionCard, Skeleton } from '../../components/ui';
import { ExpenseSummaryCard } from '../expenses/ExpenseSummaryCard';
import { ItemDetailSheet } from '../itinerary/ItemDetailSheet';

export function OverviewTab({ trip }: { trip: Trip }) {
  const it = useItinerary(trip.id);
  const categories = useCategories();
  const [open, setOpen] = useState<TimelineEntry | null>(null);

  const entries = useMemo(
    () => buildTimeline(it.hostings, it.activities, it.transportations, trip.timezone),
    [it.hostings, it.activities, it.transportations, trip.timezone],
  );

  // Today if it is a trip day; otherwise the first day (not started) or last day (ended).
  const dayEntries = useMemo(() => {
    const { days } = groupByDay(entries, trip);
    if (!days.length) return null;
    const today = todayDay();
    const day = days.find((d) => d.day === today)
      ?? (today < days[0].day ? days[0] : today > days[days.length - 1].day ? days[days.length - 1] : days.find((d) => d.day > today) ?? days[0]);
    return day;
  }, [entries, trip]);

  const nextTransport = useMemo(() => {
    const list = [...it.transportations].filter((t) => t.departure_at).sort((a, b) => a.departure_at!.localeCompare(b.departure_at!));
    const now = new Date().toISOString();
    return list.find((t) => t.departure_at! >= now) ?? list[0] ?? null;
  }, [it.transportations]);

  const counts = [
    { label: 'Lodgings', n: it.hostings.length, icon: BedDouble },
    { label: 'Activities', n: it.activities.length, icon: Sparkles },
    { label: 'Flights', n: it.transportations.length, icon: Plane },
    { label: 'Guests', n: trip.collaborators, icon: Users },
  ];

  if (it.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-28 rounded-card lg:col-span-2" />
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <ErrorNotice error={it.error} className="lg:col-span-2" />
      {nextTransport && <BoardingPass t={nextTransport} />}

      <SectionCard
        className="lg:col-start-1"
        title="Itinerary"
        icon={<CategoryBadge icon={ITINERARY_META.icon} color={ITINERARY_META.color} size="sm" />}
        action={dayEntries && <span className="text-subhead text-label-3">{fmtDay(dayEntries.day, 'EEEE, MMM d')}</span>}
      >
        {dayEntries?.entries.length ? (
          <ul className="px-1 pb-1">
            {dayEntries.entries.map((e) => {
              const meta = itemMeta(e.kind, e.item, categories.data);
              return (
                <li key={e.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(e)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-fill/10"
                  >
                    <CategoryBadge icon={meta.icon} color={meta.color} />
                    <span className="min-w-0 flex-1 truncate text-callout">{entryTitle(e)}</span>
                    <span className="shrink-0 text-callout text-label-3">
                      {e.allDay || !e.at ? 'All day' : fmtIn(e.at, e.tz, 'h:mm a')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 pb-3 text-subhead text-label-3">Nothing planned for this day.</p>
        )}
        <Link to={`/trips/${trip.id}/itinerary`} className="block border-t border-separator/50 px-4 py-3 text-callout font-semibold text-accent hover:bg-accent/5">
          View All Days
        </Link>
      </SectionCard>

      <div className="space-y-4">
        <ExpenseSummaryCard trip={trip} />
        {trip.description && (
          <SectionCard title="About this trip">
            <p className="whitespace-pre-wrap px-4 pb-4 text-callout text-label-2">{trip.description}</p>
          </SectionCard>
        )}
        <div className="card grid grid-cols-4 divide-x divide-separator/50 py-3">
          {counts.map(({ label, n, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 px-1">
              <Icon className="h-4 w-4 text-label-3" />
              <span className="text-title-3 font-bold">{n}</span>
              <span className="text-caption text-label-3">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {open && <ItemDetailSheet open onClose={() => setOpen(null)} trip={trip} kind={open.kind} item={open.item} />}
    </div>
  );
}

/** Boarding-pass style summary of the next (or first) transportation. */
function BoardingPass({ t }: { t: Transportation }) {
  const meta = transportationMeta(t.transportation_type);
  const Icon = meta.icon;
  const end = (desc: string | null | undefined, at: string | null, tz: string | null) => (
    <div className="min-w-0">
      <div className="truncate text-title-1 font-bold">{desc || '—'}</div>
      <div className="text-callout text-label-3">{at ? fmtIn(at, tz, 'h:mm a') : ''}</div>
    </div>
  );
  return (
    <section className="card flex items-center gap-3 p-4 lg:col-span-2">
      {end(t.departure_description, t.departure_at, t.departure_timezone)}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
        <span className="text-subhead text-label-3">{t.transport_number ?? ''}</span>
        <div className="flex w-full items-center gap-2" style={{ color: meta.color }}>
          <span className="h-0.5 flex-1 rounded-full bg-current opacity-30" />
          <Icon className="h-5 w-5" />
          <span className="h-0.5 flex-1 rounded-full bg-current opacity-30" />
        </div>
        <span className="text-subhead text-label-3">{t.departure_at ? fmtIn(t.departure_at, t.departure_timezone, 'EEE, MMM d') : ''}</span>
      </div>
      <div className="min-w-0 text-right">
        <div className="truncate text-title-1 font-bold">{t.arrival_description || '—'}</div>
        <div className="text-callout text-label-3">{t.arrival_at ? fmtIn(t.arrival_at, t.arrival_timezone, 'h:mm a') : ''}</div>
      </div>
    </section>
  );
}
