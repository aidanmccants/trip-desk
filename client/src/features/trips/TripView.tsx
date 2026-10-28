// Trip page: cover header, then tabs. Each tab lives in its feature folder and takes `{ trip }`.
import { useEffect, type ComponentType } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import type { Trip } from '@shared/types';
import { useTrip } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { ErrorNotice, Skeleton, cx } from '../../components/ui';
import { TripHeader } from './TripHeader';
import { OverviewTab } from './OverviewTab';
import { ItineraryTab } from '../itinerary/ItineraryTab';
import { PlacesTab } from '../itinerary/PlacesTab';
import { ExpensesTab } from '../expenses/ExpensesTab';
import { DocumentsTab } from '../documents/DocumentsTab';
import { PeopleTab } from '../people/PeopleTab';

export const TABS: { id: string; label: string; Component: ComponentType<{ trip: Trip }> }[] = [
  { id: 'overview', label: 'Overview', Component: OverviewTab },
  { id: 'itinerary', label: 'Itinerary', Component: ItineraryTab },
  { id: 'places', label: 'Places', Component: PlacesTab },
  { id: 'expenses', label: 'Expenses', Component: ExpensesTab },
  { id: 'documents', label: 'Documents', Component: DocumentsTab },
  { id: 'people', label: 'People', Component: PeopleTab },
];

export function TripView() {
  const params = useParams();
  const tripId = Number(params.tripId);
  const tab = TABS.find((t) => t.id === params.tab) ?? TABS[0];
  const trip = useTrip(tripId);
  const navigate = useNavigate();

  // A 404 (deleted or no longer shared) returns to the trip list.
  useEffect(() => {
    if (trip.error instanceof ApiError && trip.error.status === 404) navigate('/', { replace: true });
  }, [trip.error, navigate]);

  if (trip.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  }
  if (!trip.data) return <ErrorNotice className="m-6" error={trip.error} />;

  const Tab = tab.Component;
  return (
    <div className="pb-16">
      <TripHeader trip={trip.data} />
      <nav className="sticky top-0 z-20 border-b border-separator/50 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 scrollbar-none md:px-8">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              to={`/trips/${tripId}/${t.id}`}
              className={cx(
                'whitespace-nowrap border-b-2 px-3 py-3 text-subhead font-semibold transition',
                t.id === tab.id ? 'border-accent text-label' : 'border-transparent text-label-3 hover:text-label',
              )}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <Tab trip={trip.data} />
      </div>
    </div>
  );
}
