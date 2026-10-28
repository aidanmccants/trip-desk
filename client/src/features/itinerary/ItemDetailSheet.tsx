import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInMinutes } from 'date-fns';
import { getTimezoneOffset } from 'date-fns-tz';
import { Check, CheckCircle2, ExternalLink, Globe, Pencil, Phone } from 'lucide-react';
import type { Activity, AnyItem, Hosting, ItemKind, Transportation, Trip } from '@shared/types';
import { api } from '../../lib/api';
import { invalidateTrip, useCategories, useItems, useMyPermissions } from '../../lib/queries';
import { fmtIn, zoneAbbr } from '../../lib/time';
import { itemMeta } from '../../lib/categories';
import { Button, CategoryBadge, ErrorNotice, Sheet } from '../../components/ui';
import { money } from '../../components/form';
import { LazyMap, type MapMarker } from './LazyMap';
import { googleMapsUrl } from './geocode';
import { ItemEditSheet } from './ItemEditSheet';
import { AttachmentsSection } from '../documents/AttachmentsSection';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="w-32 shrink-0 text-subhead text-label-3">{label}</span>
      <span className="min-w-0 flex-1 break-words text-callout">{children}</span>
    </div>
  );
}

function duration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ') || '0m';
}

function Leg({ code, at, tz, address, terminal, gate, align }: {
  code?: string | null; at: string | null; tz: string | null; address?: string | null;
  terminal?: string | null; gate?: string | null; align: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-large-title font-bold leading-none">{code || '—'}</div>
      {at && (
        <>
          <div className="mt-2 text-title-3 font-semibold text-accent">{fmtIn(at, tz, 'h:mm a')}</div>
          <div className="text-footnote text-label-3">{fmtIn(at, tz, 'EEE, MMM d')} · {zoneAbbr(at, tz)}</div>
        </>
      )}
      {(terminal || gate) && (
        <div className="mt-1 text-footnote text-label-2">
          {[terminal && `Terminal ${terminal}`, gate && `Gate ${gate}`].filter(Boolean).join(' · ')}
        </div>
      )}
      {address && <div className="mt-1 text-footnote text-label-3">{address}</div>}
    </div>
  );
}

export function ItemDetailSheet({ open, onClose, trip, kind, item: initialItem }: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  kind: ItemKind;
  item: AnyItem;
}) {
  const qc = useQueryClient();
  const { canEdit, canSeeExpenses } = useMyPermissions(trip.id);
  const categories = useCategories();
  const list = useItems(trip.id, kind);
  const [editing, setEditing] = useState(false);

  const all = list.data as AnyItem[] | undefined;
  const latest = all?.find((i) => i.id === initialItem.id);
  const item = latest ?? initialItem;
  // The item vanished from the cache (deleted or moved from the edit sheet): close.
  useEffect(() => {
    if (open && list.isSuccess && !list.isFetching && all && !latest) onClose();
  }, [open, list.isSuccess, list.isFetching, all, latest, onClose]);

  const toggleDone = useMutation({
    mutationFn: () => api.patch(`/v1/trip/${trip.id}/activity/${item.id}`, { checked: !(item as Activity).checked }),
    onSuccess: () => invalidateTrip(qc, trip.id),
  });

  if (!open) return null;
  const meta = itemMeta(kind, item, categories.data ?? []);
  const Icon = meta.icon;

  const markers: MapMarker[] = [];
  const lines: [[number, number], [number, number]][] = [];
  let mapUrl: string | null = null;
  let t: Transportation | undefined;
  if (kind === 'transportation') {
    t = item as Transportation;
    if (t.departure_latitude != null && t.departure_longitude != null)
      markers.push({ id: 'dep', lat: t.departure_latitude, lng: t.departure_longitude, color: meta.color, label: 'A' });
    if (t.arrival_latitude != null && t.arrival_longitude != null)
      markers.push({ id: 'arr', lat: t.arrival_latitude, lng: t.arrival_longitude, color: meta.color, label: 'B' });
    if (markers.length === 2) lines.push([[markers[0].lng, markers[0].lat], [markers[1].lng, markers[1].lat]]);
    mapUrl = googleMapsUrl(t.departure_latitude, t.departure_longitude, t.departure_address)
      ?? googleMapsUrl(t.arrival_latitude, t.arrival_longitude, t.arrival_address);
  } else {
    const p = item as Hosting | Activity;
    if (p.latitude != null && p.longitude != null) markers.push({ id: 'p', lat: p.latitude, lng: p.longitude, color: meta.color });
    mapUrl = googleMapsUrl(p.latitude, p.longitude, p.address);
  }

  const hosting = kind === 'hosting' ? (item as Hosting) : null;
  const activity = kind === 'activity' ? (item as Activity) : null;
  const phone = item.phone;
  const website = item.website;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        width="lg"
        title={meta.label}
        footer={
          canEdit ? (
            <>
              {activity && (
                <Button
                  className="mr-auto"
                  icon={activity.checked ? CheckCircle2 : Check}
                  loading={toggleDone.isPending}
                  onClick={() => toggleDone.mutate()}
                >
                  {activity.checked ? 'Done' : 'Mark done'}
                </Button>
              )}
              <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <CategoryBadge icon={Icon} color={meta.color} size="lg" />
            <div className="min-w-0">
              <h3 className="break-words text-title-2 font-bold">{item.name || meta.label}</h3>
              {t && (t.company || t.transport_number) && (
                <p className="text-subhead text-label-3">{[t.company, t.transport_number].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <ErrorNotice error={toggleDone.error} />

          {t && (
            <div className="card p-4">
              <div className="grid grid-cols-2 gap-4">
                <Leg code={t.departure_description} at={t.departure_at} tz={t.departure_timezone || trip.timezone} address={t.departure_address} terminal={t.departure_terminal} gate={t.departure_gate} align="left" />
                <Leg code={t.arrival_description} at={t.arrival_at} tz={t.arrival_timezone || trip.timezone} address={t.arrival_address} terminal={t.arrival_terminal} gate={t.arrival_gate} align="right" />
              </div>
              {t.departure_at && t.arrival_at && (() => {
                const mins = differenceInMinutes(new Date(t.arrival_at), new Date(t.departure_at));
                const dz = t.departure_timezone || trip.timezone || 'UTC';
                const az = t.arrival_timezone || trip.timezone || 'UTC';
                const hours = (getTimezoneOffset(az, new Date(t.arrival_at)) - getTimezoneOffset(dz, new Date(t.departure_at))) / 3_600_000;
                return (
                  <div className="-mx-4 -mb-4 mt-4 border-t border-separator/60">
                    {mins > 0 && <Row label="Duration">{duration(mins)}</Row>}
                    <Row label="Time difference">{hours === 0 ? 'Same time zone' : `${hours > 0 ? '+' : ''}${hours} h`}</Row>
                  </div>
                );
              })()}
            </div>
          )}

          {(hosting || activity) && (
            <div className="card">
              {hosting && (
                <>
                  {hosting.starts_at && <Row label="Check-in">{fmtIn(hosting.starts_at, hosting.timezone || trip.timezone, 'EEE, MMM d · h:mm a')}</Row>}
                  {hosting.ends_at && <Row label="Check-out">{fmtIn(hosting.ends_at, hosting.timezone || trip.timezone, 'EEE, MMM d · h:mm a')}</Row>}
                  {hosting.room_type && <Row label="Room type">{hosting.room_type}</Row>}
                  {hosting.room_number && <Row label="Room">{hosting.room_number}</Row>}
                </>
              )}
              {activity && (
                <>
                  {activity.starts_at && (
                    <Row label={activity.all_day ? 'Date' : 'Starts'}>
                      {fmtIn(activity.starts_at, activity.timezone || trip.timezone, activity.all_day ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a')}
                      {activity.all_day && ' · All day'}
                    </Row>
                  )}
                  {activity.ends_at && !activity.all_day && <Row label="Ends">{fmtIn(activity.ends_at, activity.timezone || trip.timezone, 'EEE, MMM d · h:mm a')}</Row>}
                  <Row label="Type">{meta.label}</Row>
                </>
              )}
              {(hosting?.address || activity?.address) && <Row label="Address">{hosting?.address ?? activity?.address}</Row>}
            </div>
          )}

          {(t?.seat_number || t?.seat_class || t?.arrival_bags) && (
            <div className="card">
              {t.seat_number && <Row label="Seat">{t.seat_number}</Row>}
              {t.seat_class && <Row label="Class">{t.seat_class}</Row>}
              {t.arrival_bags && <Row label="Baggage claim">{t.arrival_bags}</Row>}
            </div>
          )}

          {(phone || website || item.provider_reservation_code || (canSeeExpenses && item.price != null)) && (
            <div className="card">
              {phone && (
                <Row label="Phone">
                  <a className="inline-flex items-center gap-1.5 text-accent" href={`tel:${phone}`}><Phone className="h-4 w-4" />{phone}</a>
                </Row>
              )}
              {website && (
                <Row label="Website">
                  <a className="inline-flex items-center gap-1.5 break-all text-accent" href={/^https?:\/\//i.test(website) ? website : `https://${website}`} target="_blank" rel="noreferrer">
                    <Globe className="h-4 w-4 shrink-0" />{website}
                  </a>
                </Row>
              )}
              {item.provider_reservation_code && <Row label="Reservation"><span className="font-mono">{item.provider_reservation_code}</span></Row>}
              {canSeeExpenses && item.price != null && <Row label="Price">{money(item.price, item.currency)}</Row>}
            </div>
          )}

          {item.notes && (
            <div className="card p-4">
              <h4 className="label !px-0">Notes</h4>
              <p className="whitespace-pre-wrap text-callout">{item.notes}</p>
            </div>
          )}

          {markers.length > 0 && (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-card">
                <LazyMap markers={markers} lines={lines} interactive={false} className="h-[180px] w-full" />
              </div>
              {mapUrl && (
                <a className="inline-flex items-center gap-1.5 text-subhead font-medium text-accent" href={mapUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open in Google Maps
                </a>
              )}
            </div>
          )}

          <AttachmentsSection trip={trip} kind={kind} itemId={item.id} />
        </div>
      </Sheet>
      {canEdit && <ItemEditSheet open={editing} onClose={() => setEditing(false)} trip={trip} kind={kind} item={item} />}
    </>
  );
}
