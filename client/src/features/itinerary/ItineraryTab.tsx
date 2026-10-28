import { Fragment, useMemo, useState } from 'react';
import { BedDouble, CalendarDays, Plus, Plane, Ticket } from 'lucide-react';
import type { ItemKind, Trip } from '@shared/types';
import { useCategories, useItinerary, useMyPermissions } from '../../lib/queries';
import { buildTimeline, groupByDay, type TimelineEntry } from '../../lib/itinerary';
import { fmtDay, todayDay } from '../../lib/time';
import { Button, EmptyState, ErrorNotice, ListSkeleton, SectionCard } from '../../components/ui';
import { DayPicker, type DaySelection } from './DayPicker';
import { TimelineRow, TzDivider } from './TimelineRow';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemEditSheet } from './ItemEditSheet';

const ADD_OPTIONS: { kind: ItemKind; label: string; icon: typeof Ticket }[] = [
  { kind: 'activity', label: 'Activity', icon: Ticket },
  { kind: 'transportation', label: 'Transportation', icon: Plane },
  { kind: 'hosting', label: 'Lodging', icon: BedDouble },
];

export function ItineraryTab({ trip }: { trip: Trip }) {
  const { hostings, activities, transportations, isLoading, error } = useItinerary(trip.id);
  const categories = useCategories().data ?? [];
  const { canEdit } = useMyPermissions(trip.id);

  const entries = useMemo(
    () => buildTimeline(hostings, activities, transportations, trip.timezone),
    [hostings, activities, transportations, trip.timezone],
  );
  const { days, unscheduled } = useMemo(() => groupByDay(entries, trip), [entries, trip]);

  const [picked, setPicked] = useState<DaySelection | null>(null);
  const today = todayDay();
  const selected: DaySelection = picked ?? (days.some((d) => d.day === today) ? today : 'all');

  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState<{ kind: ItemKind; day?: string } | null>(null);
  const [viewing, setViewing] = useState<TimelineEntry | null>(null);

  // Previous scheduled entry for each entry, to spot time zone changes across days.
  const prevTz = useMemo(() => {
    const m = new Map<string, string | null>();
    let last: string | null = null;
    for (const e of entries) {
      if (!e.at) continue;
      m.set(e.key, last);
      last = e.tz;
    }
    return m;
  }, [entries]);

  const defaultDay = selected !== 'all' && selected !== 'unscheduled' ? selected : undefined;
  const shown =
    selected === 'all' ? days.filter((d) => d.entries.length > 0)
      : selected === 'unscheduled' ? []
        : days.filter((d) => d.day === selected);
  const showUnscheduled = (selected === 'all' || selected === 'unscheduled') && unscheduled.length > 0;

  const addButton = (
    <Button variant="primary" icon={Plus} onClick={() => setMenu((m) => !m)}>Add</Button>
  );

  const renderEntries = (list: TimelineEntry[]) =>
    list.map((e, i) => {
      const before = prevTz.get(e.key);
      const changed = e.at && e.tz && before !== undefined && before !== null && before !== e.tz;
      return (
        <Fragment key={e.key}>
          {changed && <TzDivider entry={e} />}
          <TimelineRow entry={e} categories={categories} first={i === 0} last={i === list.length - 1} onClick={() => setViewing(e)} />
        </Fragment>
      );
    });

  const addPrompt = (day?: string) =>
    canEdit && (
      <Button variant="primary" icon={Plus} onClick={() => setAdding({ kind: 'activity', day })}>Add activity</Button>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <DayPicker days={days.map((d) => d.day)} value={selected} onChange={setPicked} hasUnscheduled={unscheduled.length > 0} />
        </div>
        {canEdit && (
          <div className="relative shrink-0">
            {addButton}
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-12 z-40 w-52 overflow-hidden rounded-2xl bg-card shadow-sheet">
                  {ADD_OPTIONS.map(({ kind, label, icon: Icon }) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => { setMenu(false); setAdding({ kind, day: defaultDay }); }}
                      className="flex w-full items-center gap-3 border-t border-separator/60 px-4 py-3 text-left text-callout first:border-t-0 hover:bg-fill/10"
                    >
                      <Icon className="h-5 w-5 text-accent" /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <ErrorNotice error={error} />
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          {shown.map(({ day, entries: list }) => (
            <SectionCard
              key={day}
              title={fmtDay(day, 'EEEE, MMM d')}
              action={day === today ? <span className="chip bg-accent/10 py-0.5 text-footnote text-accent">Today</span> : undefined}
            >
              {list.length ? (
                <div className="pb-1">{renderEntries(list)}</div>
              ) : (
                <EmptyState icon={CalendarDays} title="Nothing planned" message="Add an activity, transportation or lodging for this day." action={addPrompt(day)} />
              )}
            </SectionCard>
          ))}
          {showUnscheduled && <SectionCard title="Unscheduled"><div className="pb-1">{renderEntries(unscheduled)}</div></SectionCard>}
          {selected === 'unscheduled' && unscheduled.length === 0 && (
            <EmptyState icon={CalendarDays} title="Nothing unscheduled" />
          )}
          {selected === 'all' && !shown.length && !showUnscheduled && (
            <div className="card">
              <EmptyState icon={CalendarDays} title="No plans yet" message="Add flights, stays and activities to build your itinerary." action={addPrompt()} />
            </div>
          )}
        </>
      )}

      {adding && <ItemEditSheet open onClose={() => setAdding(null)} trip={trip} kind={adding.kind} defaultDay={adding.day} />}
      {viewing && (
        <ItemDetailSheet open onClose={() => setViewing(null)} trip={trip} kind={viewing.kind} item={viewing.item} />
      )}
    </div>
  );
}
