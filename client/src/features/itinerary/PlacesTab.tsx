import { useMemo, useState } from 'react';
import { MapPin, Pencil, Ruler } from 'lucide-react';
import type { AnyItem, Hosting, ItemKind, Transportation, Trip } from '@shared/types';
import { useCategories, useItinerary, useMyPermissions } from '../../lib/queries';
import { itemMeta, type CategoryMeta } from '../../lib/categories';
import { fmtIn } from '../../lib/time';
import { Button, CategoryBadge, EmptyState, ErrorNotice, IconButton, ListSkeleton, Segmented, Select, cx } from '../../components/ui';
import { LazyMap, type MapMarker } from './LazyMap';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemEditSheet } from './ItemEditSheet';

interface Place {
  id: string;
  kind: ItemKind;
  item: AnyItem;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  at: string | null;
  tz: string | null;
  meta: CategoryMeta;
}

const R = 6371;
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const usesMiles = () => /^en-(US|GB|LR|MM)$/i.test(navigator.language) || navigator.language === 'en';
function fmtDistance(km: number): string {
  const miles = usesMiles();
  const v = miles ? km * 0.621371 : km;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${miles ? 'mi' : 'km'}`;
}

export function PlacesTab({ trip }: { trip: Trip }) {
  const { hostings, activities, transportations, isLoading, error } = useItinerary(trip.id);
  const categories = useCategories().data ?? [];
  const { canEdit } = useMyPermissions(trip.id);

  const [filter, setFilter] = useState('all');
  const [showDistance, setShowDistance] = useState(false);
  const [lodgingId, setLodgingId] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Place | null>(null);
  const [editing, setEditing] = useState<Place | null>(null);

  const places = useMemo<Place[]>(() => {
    const out: Place[] = [];
    for (const h of hostings) {
      out.push({
        id: `h${h.id}`, kind: 'hosting', item: h, name: h.name, address: h.address ?? null,
        lat: h.latitude ?? null, lng: h.longitude ?? null, at: h.starts_at, tz: h.timezone || trip.timezone,
        meta: itemMeta('hosting', h, categories),
      });
    }
    for (const a of activities) {
      out.push({
        id: `a${a.id}`, kind: 'activity', item: a, name: a.name, address: a.address ?? null,
        lat: a.latitude ?? null, lng: a.longitude ?? null, at: a.starts_at, tz: a.timezone || trip.timezone,
        meta: itemMeta('activity', a, categories),
      });
    }
    for (const t of transportations as Transportation[]) {
      const meta = itemMeta('transportation', t, categories);
      if (t.departure_latitude != null && t.departure_longitude != null) {
        out.push({
          id: `t${t.id}-dep`, kind: 'transportation', item: t,
          name: t.departure_description || t.name || 'Departure', address: t.departure_address ?? null,
          lat: t.departure_latitude, lng: t.departure_longitude, at: t.departure_at, tz: t.departure_timezone || trip.timezone, meta,
        });
      }
      if (t.arrival_latitude != null && t.arrival_longitude != null) {
        out.push({
          id: `t${t.id}-arr`, kind: 'transportation', item: t,
          name: t.arrival_description || t.name || 'Arrival', address: t.arrival_address ?? null,
          lat: t.arrival_latitude, lng: t.arrival_longitude, at: t.arrival_at, tz: t.arrival_timezone || trip.timezone, meta,
        });
      }
    }
    return out;
  }, [hostings, activities, transportations, categories, trip.timezone]);

  const filterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of places) if (!seen.has(p.meta.value)) seen.set(p.meta.value, p.meta.label);
    return [{ value: 'all', label: 'All' }, ...[...seen].map(([value, label]) => ({ value, label }))];
  }, [places]);
  const activeFilter = filterOptions.some((o) => o.value === filter) ? filter : 'all';

  const lodgings = hostings.filter((h: Hosting) => h.latitude != null && h.longitude != null);
  const origin = useMemo(() => {
    if (!showDistance) return null;
    const h = lodgings.find((l) => l.id === lodgingId) ?? lodgings[0];
    return h ? { lat: h.latitude as number, lng: h.longitude as number } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDistance, lodgingId, hostings]);

  const filtered = places.filter((p) => activeFilter === 'all' || p.meta.value === activeFilter);
  const located = useMemo(() => {
    const list = filtered
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ p, km: origin ? haversineKm(origin, { lat: p.lat as number, lng: p.lng as number }) : null }));
    if (origin) list.sort((a, b) => (a.km as number) - (b.km as number));
    return list;
  }, [filtered, origin]);
  const unlocated = filtered.filter((p) => p.lat == null || p.lng == null);

  const markers: MapMarker[] = located.map(({ p }, i) => ({
    id: p.id, lat: p.lat as number, lng: p.lng as number, color: p.meta.color, label: String(i + 1),
    onClick: () => { setFocus(p.id); setViewing(p); },
  }));

  if (isLoading) return <ListSkeleton rows={5} />;

  const open = (p: Place) => {
    setFocus(p.id);
    setViewing(p);
  };

  const row = (p: Place, n: number | null, km: number | null) => (
    <div key={p.id} className="row">
      <button type="button" onClick={() => open(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="relative">
          <CategoryBadge icon={p.meta.icon} color={p.meta.color} />
          {n != null && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-label px-1 text-[10px] font-bold text-bg">{n}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-callout font-medium">{p.name || 'Untitled'}</div>
          {km != null && <div className="text-footnote font-medium text-accent">{fmtDistance(km)} away</div>}
          {p.address && <div className="truncate text-footnote text-label-3">{p.address}</div>}
        </div>
        {p.at && (
          <div className="shrink-0 text-right text-footnote text-label-3">
            <div>{fmtIn(p.at, p.tz, 'MMM d')}</div>
            <div>{fmtIn(p.at, p.tz, 'h:mm a')}</div>
          </div>
        )}
      </button>
      {n == null && canEdit && <IconButton icon={Pencil} label="Add a location" onClick={() => setEditing(p)} />}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented className="max-w-full" value={activeFilter} onChange={setFilter} options={filterOptions} />
        {lodgings.length > 0 && (
          <Button size="sm" variant={showDistance ? 'primary' : 'secondary'} icon={Ruler} onClick={() => setShowDistance((s) => !s)}>
            Show distance
          </Button>
        )}
        {showDistance && lodgings.length > 0 && (
          <Select
            aria-label="Lodging"
            className="!w-auto max-w-[14rem] !py-1.5 text-subhead"
            value={String(lodgingId ?? lodgings[0].id)}
            onChange={(e) => setLodgingId(Number(e.target.value))}
          >
            {lodgings.map((l) => <option key={l.id} value={l.id}>From {l.name}</option>)}
          </Select>
        )}
      </div>
      <ErrorNotice error={error} />

      {places.length === 0 ? (
        <div className="card">
          <EmptyState icon={MapPin} title="No places yet" message="Add an address to a lodging, activity or transportation and it will appear here." />
        </div>
      ) : (
        <div className={cx('grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start')}>
          <div className="overflow-hidden rounded-card shadow-card lg:sticky lg:top-16">
            {markers.length ? (
              <LazyMap markers={markers} interactive focusId={focus} className="h-[55vh] w-full" />
            ) : (
              <div className="grid h-[30vh] place-items-center bg-card text-subhead text-label-3">No located places to show</div>
            )}
          </div>
          <div className="space-y-4">
            {located.length > 0 && (
              <div className="card overflow-hidden">{located.map(({ p, km }, i) => row(p, i + 1, km))}</div>
            )}
            {unlocated.length > 0 && (
              <section>
                <h3 className="label">No location</h3>
                <div className="card overflow-hidden">{unlocated.map((p) => row(p, null, null))}</div>
              </section>
            )}
          </div>
        </div>
      )}

      {viewing && <ItemDetailSheet open onClose={() => setViewing(null)} trip={trip} kind={viewing.kind} item={viewing.item} />}
      {editing && <ItemEditSheet open onClose={() => setEditing(null)} trip={trip} kind={editing.kind} item={editing.item} />}
    </div>
  );
}
