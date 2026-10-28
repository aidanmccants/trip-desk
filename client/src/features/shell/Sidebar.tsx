// Left rail: trip list (upcoming / past), search, new trip, inbox, settings, sign out.
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Inbox, LogOut, Plane, Plus, Search, Settings } from 'lucide-react';
import { useSession, useTrips } from '../../lib/queries';
import { Button, ErrorNotice, Skeleton, cx } from '../../components/ui';
import { TripCard } from '../trips/TripCard';
import { TripSheet } from '../trips/TripSheet';
import { splitTrips } from '../trips/tripSort';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const trips = useTrips();
  const session = useSession();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const open = () => setCreating(true);
    window.addEventListener('tripdesk:new-trip', open);
    return () => window.removeEventListener('tripdesk:new-trip', open);
  }, []);

  const { upcoming, past } = useMemo(() => {
    const q = query.trim().toLowerCase();
    return splitTrips((trips.data ?? []).filter((t) => !q || t.name.toLowerCase().includes(q)));
  }, [trips.data, query]);
  const searching = query.trim().length > 0;

  const signOut = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST', headers: { 'X-Requested-With': 'tripsy-web' } });
    } finally {
      window.location.assign('/');
    }
  };

  const link = ({ isActive }: { isActive: boolean }) =>
    cx('flex items-center gap-3 rounded-xl px-3 py-2 text-callout font-medium transition', isActive ? 'bg-accent/15 text-accent' : 'text-label hover:bg-fill/15');

  return (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-5">
        <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-lg" />
        <h1 className="text-title-2 font-bold">Trip Desk</h1>
      </div>
      <div className="space-y-2 px-4 pb-3">
        <Button variant="primary" icon={Plus} className="w-full" onClick={() => setCreating(true)}>New trip</Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3" />
          <input
            id="trip-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              setQuery('');
              e.currentTarget.blur();
            }}
            placeholder="Search trips"
            aria-label="Search trips"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {trips.isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-card" />)}</div>
        ) : trips.error ? (
          <ErrorNotice error={trips.error} />
        ) : !trips.data?.length ? (
          <div className="px-2 py-10 text-center">
            <Plane className="mx-auto mb-2 h-8 w-8 text-label-3" />
            <p className="text-subhead text-label-3">No trips yet. Create your first one.</p>
          </div>
        ) : !upcoming.length && !past.length ? (
          <p className="px-2 py-8 text-center text-subhead text-label-3">No trips match "{query}".</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="space-y-2">
                <h2 className="label">Upcoming</h2>
                {upcoming.map((t) => <TripCard key={t.id} trip={t} variant="compact" onNavigate={onNavigate} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="space-y-2">
                <button
                  type="button"
                  className="label !mb-0 flex w-full items-center gap-1"
                  onClick={() => setShowPast((v) => !v)}
                  aria-expanded={showPast || searching}
                >
                  {showPast || searching ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Past ({past.length})
                </button>
                {(showPast || searching) && past.map((t) => <TripCard key={t.id} trip={t} variant="compact" onNavigate={onNavigate} />)}
              </section>
            )}
          </>
        )}
      </div>

      <div className="space-y-1 border-t border-separator/50 p-3">
        <NavLink to="/inbox" className={link} onClick={onNavigate}><Inbox className="h-5 w-5" />Inbox</NavLink>
        <NavLink to="/settings" className={link} onClick={onNavigate}><Settings className="h-5 w-5" />Settings</NavLink>
        <div className="flex items-center gap-2 px-3 pt-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-subhead font-medium">{session.data?.name}</div>
            {session.data?.email && <div className="truncate text-caption text-label-3">{session.data.email}</div>}
          </div>
          <Button size="sm" icon={LogOut} onClick={signOut}>Sign out</Button>
        </div>
      </div>

      <TripSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(id) => {
          navigate(`/trips/${id}`);
          onNavigate?.();
        }}
      />
    </nav>
  );
}
