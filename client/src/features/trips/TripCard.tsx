// Cover card for a trip: photo/gradient, dark scrim, bold name and date range.
import { Link, NavLink } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import type { Trip } from '@shared/types';
import { coverBackground } from '../../lib/gradients';
import { tripRange, tripStatus } from '../../lib/time';
import { cx } from '../../components/ui';

/** `compact` is the sidebar row (NavLink with active highlight); `hero` is the big home card. */
export function TripCard({ trip, variant = 'card', onNavigate }: { trip: Trip; variant?: 'compact' | 'card' | 'hero'; onNavigate?: () => void }) {
  const body = (
    <>
      <div className="absolute inset-0" style={{ background: coverBackground(trip) }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
      {trip.hidden && (
        <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white backdrop-blur" title="Hidden trip">
          <EyeOff className="h-4 w-4" />
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
        <h3 className={cx('truncate font-bold', variant === 'hero' ? 'text-large-title' : variant === 'card' ? 'text-title-2' : 'text-headline')}>{trip.name}</h3>
        <p className={cx('truncate text-white/80', variant === 'hero' ? 'text-callout' : 'text-footnote')}>
          {variant === 'hero' ? `${tripRange(trip)} · ${tripStatus(trip)}` : tripRange(trip)}
        </p>
      </div>
    </>
  );
  const size = variant === 'hero' ? 'h-64 sm:h-72' : variant === 'card' ? 'h-44' : 'h-24';
  const base = cx('relative block w-full overflow-hidden rounded-card text-left shadow-card', size);
  if (variant === 'compact') {
    return (
      <NavLink
        to={`/trips/${trip.id}`}
        onClick={onNavigate}
        className={({ isActive }) => cx(base, 'transition', isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-card-2' : 'hover:brightness-110')}
      >
        {body}
      </NavLink>
    );
  }
  return (
    <Link to={`/trips/${trip.id}`} className={cx(base, 'transition hover:brightness-110')}>
      {body}
    </Link>
  );
}
