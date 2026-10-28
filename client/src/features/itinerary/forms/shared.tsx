// Pieces shared by the three item forms.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { addDays, format, parseISO } from 'date-fns';
import { MapPin, Search, X } from 'lucide-react';
import type { ItemKind, Trip } from '@shared/types';
import { ITEM_PLURAL } from '@shared/types';
import { api, diff } from '../../../lib/api';
import { invalidateTrip } from '../../../lib/queries';
import { browserTimeZone } from '../../../lib/time';
import type { CategoryMeta } from '../../../lib/categories';
import { Button, CategoryBadge, Field, Input, cx } from '../../../components/ui';
import { CurrencyInput } from '../../../components/form';
import { geocode, type GeocodeResult } from '../geocode';

export interface ItemFormProps<T> {
  trip: Trip;
  item?: T;
  defaultDay?: string;
  formId: string;
  onSaved: () => void;
  onPending: (pending: boolean) => void;
}

export const defaultTz = (trip: Trip) => trip.timezone || browserTimeZone();

/** `YYYY-MM-DD` to prefill: the chosen day, else the trip's first day, else today. */
export function baseDay(trip: Trip, defaultDay?: string): string {
  if (defaultDay) return defaultDay;
  if (trip.has_dates && trip.starts_at) return trip.starts_at;
  return format(new Date(), 'yyyy-MM-dd');
}
export const nextDay = (d: string) => format(addDays(parseISO(d), 1), 'yyyy-MM-dd');

export function FormCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      {title && <h3 className="label">{title}</h3>}
      <div className="card space-y-3 p-4">{children}</div>
    </section>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-subhead text-danger">{message}</p> : null;
}

const strip = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== ''));

/** Create: non-empty fields only. Edit: only fields that changed (null clears). Returns null when nothing changed. */
export function buildBody(next: Record<string, unknown>, original: Record<string, unknown> | null) {
  if (!original) return strip(next);
  const d = diff(next, original);
  return Object.keys(d).length ? (d as Record<string, unknown>) : null;
}

export function useSaveItem(trip: Trip, kind: ItemKind, itemId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown> | null) => {
      if (itemId == null) return api.post(`/v1/trip/${trip.id}/${ITEM_PLURAL[kind]}`, body ?? {});
      if (!body) return null;
      return api.patch(`/v1/trip/${trip.id}/${kind}/${itemId}`, body);
    },
    onSuccess: () => invalidateTrip(qc, trip.id),
  });
}

/** Address input with a "Find" button that geocodes through Nominatim and fills coordinates. */
export function GeoField({ form, addressName, latName, lngName, label = 'Address' }: {
  form: UseFormReturn<any>;
  addressName: string;
  latName: string;
  lngName: string;
  label?: string;
}) {
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const lat = form.watch(latName);
  const lng = form.watch(lngName);
  const find = async () => {
    setBusy(true);
    setResults(await geocode(String(form.getValues(addressName) ?? '')));
    setBusy(false);
  };
  const pick = (r: GeocodeResult) => {
    form.setValue(addressName, r.label, { shouldDirty: true });
    form.setValue(latName, r.lat, { shouldDirty: true });
    form.setValue(lngName, r.lng, { shouldDirty: true });
    setResults(null);
  };
  return (
    <div className="space-y-2">
      <Field label={label} error={form.formState.errors[addressName]?.message as string | undefined}>
        <div className="flex gap-2">
          <Input
            {...form.register(addressName)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void find();
              }
            }}
          />
          <Button icon={Search} loading={busy} onClick={find}>Find</Button>
        </div>
      </Field>
      {results && (
        <div className="overflow-hidden rounded-xl bg-card-2">
          {results.length === 0 && <p className="px-3 py-2.5 text-footnote text-label-3">No matches found.</p>}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(r)}
              className="flex w-full items-start gap-2 border-t border-separator/60 px-3 py-2.5 text-left text-footnote first:border-t-0 hover:bg-fill/15"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      )}
      {lat != null && lng != null && (
        <p className="flex items-center gap-1.5 px-1 text-footnote text-label-3">
          <MapPin className="h-3.5 w-3.5 text-success" />
          Location set ({Number(lat).toFixed(4)}, {Number(lng).toFixed(4)})
          <button
            type="button"
            className="ml-1 inline-flex items-center gap-0.5 text-accent"
            onClick={() => {
              form.setValue(latName, null, { shouldDirty: true });
              form.setValue(lngName, null, { shouldDirty: true });
            }}
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </p>
      )}
    </div>
  );
}

export function PriceFields({ form }: { form: UseFormReturn<any> }) {
  return (
    <div className="grid grid-cols-[1fr_6rem] gap-2">
      <Field label="Price" error={form.formState.errors.price?.message as string | undefined}>
        <Input inputMode="decimal" placeholder="0.00" {...form.register('price')} />
      </Field>
      <Field label="Currency" error={form.formState.errors.currency?.message as string | undefined}>
        <CurrencyInput {...form.register('currency')} />
      </Field>
    </div>
  );
}

/** Grid of type buttons with badge icons. */
export function TypePicker({ options, value, onChange, extra }: {
  options: CategoryMeta[];
  value: string;
  onChange: (v: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-caption transition',
            value === o.value ? 'bg-accent/10 ring-2 ring-accent' : 'bg-card-2 hover:bg-fill/15',
          )}
        >
          <CategoryBadge icon={o.icon} color={o.color} />
          <span className="max-w-full truncate px-1">{o.label}</span>
        </button>
      ))}
      {extra}
    </div>
  );
}

export const numStr = (n: number | null | undefined) => (n == null ? '' : String(n));
export const orNull = (s: string | undefined | null) => (s && s.trim() ? s.trim() : null);

export function priceBody(v: { price: string; currency: string }, canSeeExpenses: boolean) {
  if (!canSeeExpenses) return {};
  const n = v.price.trim() === '' || Number.isNaN(Number(v.price)) ? null : Number(v.price);
  return { price: n, currency: n == null ? null : (v.currency.trim().toUpperCase() || null) };
}

/** Zod refinement shared by price strings. */
export const priceOk = (s: string) => s.trim() === '' || !Number.isNaN(Number(s));
