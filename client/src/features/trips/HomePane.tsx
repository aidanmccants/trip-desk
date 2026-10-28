// Landing pane when no trip is selected: featured next trip plus a grid of the rest.
import { useMemo } from 'react';
import { Plane, Plus } from 'lucide-react';
import { useTrips } from '../../lib/queries';
import { Button, EmptyState, ErrorNotice, Skeleton } from '../../components/ui';
import { TripCard } from './TripCard';
import { splitTrips } from './tripSort';

const newTrip = () => window.dispatchEvent(new CustomEvent('tripdesk:new-trip'));

export function HomePane() {
  const trips = useTrips();
  const { upcoming, past } = useMemo(() => splitTrips(trips.data ?? []), [trips.data]);
  const [featured, ...others] = upcoming;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-large-title font-bold">Trips</h1>
        <Button variant="primary" icon={Plus} onClick={newTrip}>New trip</Button>
      </header>

      {trips.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-card" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-card" />)}
          </div>
        </div>
      ) : trips.error ? (
        <ErrorNotice error={trips.error} />
      ) : !trips.data?.length ? (
        <EmptyState
          icon={Plane}
          title="No trips yet"
          message="Plan your first trip: add flights, stays and things to do."
          action={<Button variant="primary" icon={Plus} onClick={newTrip}>New trip</Button>}
        />
      ) : (
        <div className="space-y-8">
          {featured ? (
            <section>
              <h2 className="label">Next up</h2>
              <TripCard trip={featured} variant="hero" />
            </section>
          ) : null}
          {others.length > 0 && (
            <section>
              <h2 className="label">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((t) => <TripCard key={t.id} trip={t} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="label">Past</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((t) => <TripCard key={t.id} trip={t} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
