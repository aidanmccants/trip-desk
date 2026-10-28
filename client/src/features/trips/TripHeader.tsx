import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BedDouble, Image, MoreHorizontal, Pencil, Plane, Plus, Trash2, MapPin } from 'lucide-react';
import type { ItemKind, Trip } from '@shared/types';
import { api } from '../../lib/api';
import { qk, useMyPermissions } from '../../lib/queries';
import { coverBackground } from '../../lib/gradients';
import { tripRange, tripStatus } from '../../lib/time';
import { ErrorNotice, QuickAction, cx, useConfirm } from '../../components/ui';
import { ItemEditSheet } from '../itinerary/ItemEditSheet';
import { TripSheet } from './TripSheet';
import { CoverSheet } from './CoverPicker';

export function TripHeader({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = useMyPermissions(trip.id);
  const confirm = useConfirm('Delete this trip?', 'The trip and everything in it will be deleted for all guests.');
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cover, setCover] = useState(false);
  const [adding, setAdding] = useState<ItemKind | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const del = useMutation({
    mutationFn: () => api.del(`/v1/trips/${trip.id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.trips });
      qc.removeQueries({ queryKey: qk.tripAll(trip.id) });
      navigate('/');
    },
  });

  const item = (label: string, icon: typeof Pencil, onClick: () => void, danger?: boolean) => {
    const Icon = icon;
    return (
      <button
        key={label}
        type="button"
        onClick={() => { setMenu(false); onClick(); }}
        className={cx('flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-callout hover:bg-fill/15', danger && 'text-danger')}
      >
        <Icon className="h-4 w-4" />{label}
      </button>
    );
  };

  return (
    <header className="relative flex h-[280px] flex-col items-center justify-end overflow-hidden text-white">
      <div className="absolute inset-0" style={{ background: coverBackground(trip) }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />

      {perms.canEdit && (
        <div ref={menuRef} className="absolute right-4 top-4 z-10">
          <button
            type="button"
            aria-label="Trip menu"
            onClick={() => setMenu((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl bg-card text-label shadow-sheet">
              {item('Edit trip', Pencil, () => setEditing(true))}
              {item('Change cover', Image, () => setCover(true))}
              {perms.isOwner && item('Delete trip', Trash2, () => confirm.ask(() => del.mutateAsync()), true)}
            </div>
          )}
        </div>
      )}

      <div className="relative w-full px-6 text-center">
        <h1 className="truncate text-large-title font-bold drop-shadow">{trip.name}</h1>
        <p className="text-callout text-white/85">{tripStatus(trip)}</p>
        <p className="text-subhead text-white/70">{tripRange(trip)}</p>
      </div>

      <div className="relative mt-3 flex items-start justify-center gap-3 pb-4 [&_span]:!text-white/85">
        {perms.canEdit && <QuickAction icon={Plus} label="New Activity" onClick={() => setAdding('activity')} />}
        {perms.canEdit && <QuickAction icon={Plane} label="Flights" onClick={() => setAdding('transportation')} />}
        {perms.canEdit && <QuickAction icon={BedDouble} label="Lodgings" onClick={() => setAdding('hosting')} />}
        <QuickAction icon={MapPin} label="Places" onClick={() => navigate(`/trips/${trip.id}/places`)} />
      </div>

      {del.error && <ErrorNotice className="absolute inset-x-4 top-16" error={del.error} />}
      {confirm.dialog}
      <TripSheet open={editing} onClose={() => setEditing(false)} trip={trip} />
      {cover && <CoverSheet open onClose={() => setCover(false)} trip={trip} />}
      {adding && <ItemEditSheet open onClose={() => setAdding(null)} trip={trip} kind={adding} />}
    </header>
  );
}
