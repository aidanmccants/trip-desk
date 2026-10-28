import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Transportation } from '@shared/types';
import { TRANSPORTATION_FIELDS } from '@shared/fields';
import { Field, Input, TextArea, Toggle } from '../../../components/ui';
import { TimeZoneInput, applyApiErrors } from '../../../components/form';
import { transportationTypeOptions } from '../../../lib/categories';
import { localInputToUtc, utcToLocalInput } from '../../../lib/time';
import { useItems, useMe, useMyPermissions } from '../../../lib/queries';
import {
  FormCard, FormError, GeoField, PriceFields, TypePicker, baseDay, buildBody, defaultTz, numStr, orNull,
  priceBody, priceOk, useSaveItem, type ItemFormProps,
} from './shared';

const s = z.string();
const schema = z.object({
  transportation_type: z.string().min(1),
  name: s,
  company: s,
  transport_number: s,
  departure_description: s,
  departure_address: s,
  departure_latitude: z.number().nullable(),
  departure_longitude: z.number().nullable(),
  departure_at: s,
  departure_timezone: s,
  departure_terminal: s,
  departure_gate: s,
  arrival_description: s,
  arrival_address: s,
  arrival_latitude: z.number().nullable(),
  arrival_longitude: z.number().nullable(),
  arrival_at: s,
  arrival_timezone: s,
  arrival_terminal: s,
  arrival_gate: s,
  arrival_bags: s,
  seat_number: s,
  seat_class: s,
  provider_reservation_code: s,
  notes: s,
  price: s.refine(priceOk, 'Enter a number'),
  currency: s.max(3),
  hidden: z.boolean(),
});
type Values = z.infer<typeof schema>;

function body(v: Values, canSeeExpenses: boolean): Record<string, unknown> {
  const dtz = v.departure_timezone.trim() || null;
  const atz = v.arrival_timezone.trim() || null;
  return {
    transportation_type: v.transportation_type,
    name: orNull(v.name) ?? '',
    company: orNull(v.company),
    transport_number: orNull(v.transport_number),
    departure_description: orNull(v.departure_description),
    departure_address: orNull(v.departure_address),
    departure_latitude: v.departure_latitude,
    departure_longitude: v.departure_longitude,
    departure_at: localInputToUtc(v.departure_at, dtz),
    departure_timezone: dtz,
    departure_terminal: orNull(v.departure_terminal),
    departure_gate: orNull(v.departure_gate),
    arrival_description: orNull(v.arrival_description),
    arrival_address: orNull(v.arrival_address),
    arrival_latitude: v.arrival_latitude,
    arrival_longitude: v.arrival_longitude,
    arrival_at: localInputToUtc(v.arrival_at, atz),
    arrival_timezone: atz,
    arrival_terminal: orNull(v.arrival_terminal),
    arrival_gate: orNull(v.arrival_gate),
    arrival_bags: orNull(v.arrival_bags),
    seat_number: orNull(v.seat_number),
    seat_class: orNull(v.seat_class),
    provider_reservation_code: orNull(v.provider_reservation_code),
    notes: orNull(v.notes),
    hidden: v.hidden,
    ...priceBody(v, canSeeExpenses),
  };
}

export function TransportationForm({ trip, item, defaultDay, formId, onSaved, onPending }: ItemFormProps<Transportation>) {
  const { canSeeExpenses } = useMyPermissions(trip.id);
  const me = useMe();
  const siblings = useItems(trip.id, 'transportation');
  const save = useSaveItem(trip, 'transportation', item?.id);
  const [notice, setNotice] = useState<string | null>(null);

  const initial = useMemo<Values>(() => {
    if (item) {
      const dtz = item.departure_timezone || defaultTz(trip);
      const atz = item.arrival_timezone || dtz;
      return {
        transportation_type: item.transportation_type, name: item.name ?? '', company: item.company ?? '',
        transport_number: item.transport_number ?? '',
        departure_description: item.departure_description ?? '', departure_address: item.departure_address ?? '',
        departure_latitude: item.departure_latitude ?? null, departure_longitude: item.departure_longitude ?? null,
        departure_at: utcToLocalInput(item.departure_at, dtz), departure_timezone: item.departure_timezone ?? dtz,
        departure_terminal: item.departure_terminal ?? '', departure_gate: item.departure_gate ?? '',
        arrival_description: item.arrival_description ?? '', arrival_address: item.arrival_address ?? '',
        arrival_latitude: item.arrival_latitude ?? null, arrival_longitude: item.arrival_longitude ?? null,
        arrival_at: utcToLocalInput(item.arrival_at, atz), arrival_timezone: item.arrival_timezone ?? atz,
        arrival_terminal: item.arrival_terminal ?? '', arrival_gate: item.arrival_gate ?? '', arrival_bags: item.arrival_bags ?? '',
        seat_number: item.seat_number ?? '', seat_class: item.seat_class ?? '',
        provider_reservation_code: item.provider_reservation_code ?? '', notes: item.notes ?? '',
        price: numStr(item.price), currency: item.currency ?? me.data?.default_currency ?? '', hidden: item.hidden,
      };
    }
    const day = baseDay(trip, defaultDay);
    const tz = defaultTz(trip);
    return {
      transportation_type: 'airplane', name: '', company: '', transport_number: '',
      departure_description: '', departure_address: '', departure_latitude: null, departure_longitude: null,
      departure_at: `${day}T09:00`, departure_timezone: tz, departure_terminal: '', departure_gate: '',
      arrival_description: '', arrival_address: '', arrival_latitude: null, arrival_longitude: null,
      arrival_at: `${day}T12:00`, arrival_timezone: tz, arrival_terminal: '', arrival_gate: '', arrival_bags: '',
      seat_number: '', seat_class: '', provider_reservation_code: '', notes: '',
      price: '', currency: me.data?.default_currency ?? '', hidden: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { register, handleSubmit, setError, watch, setValue, formState: { errors } } = form;

  useEffect(() => {
    if (!form.getValues('currency') && me.data?.default_currency) setValue('currency', me.data.default_currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data?.default_currency]);
  useEffect(() => onPending(save.isPending), [save.isPending, onPending]);

  const options = useMemo(
    () => transportationTypeOptions([...(siblings.data ?? []).map((t) => t.transportation_type), initial.transportation_type]),
    [siblings.data, initial.transportation_type],
  );

  const submit = handleSubmit(async (v) => {
    setNotice(null);
    const next = body(v, canSeeExpenses);
    const original = item ? body(initial, canSeeExpenses) : null;
    try {
      await save.mutateAsync(buildBody(next, original));
      onSaved();
    } catch (e) {
      setNotice(applyApiErrors(e, setError, TRANSPORTATION_FIELDS));
    }
  });

  return (
    <form id={formId} onSubmit={submit} noValidate>
      <FormCard title="Type">
        <TypePicker options={options} value={watch('transportation_type')} onChange={(v) => setValue('transportation_type', v, { shouldDirty: true })} />
        <Field label="Name" error={errors.name?.message}><Input placeholder="Optional, e.g. Flight to Rome" {...register('name')} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company" error={errors.company?.message}><Input {...register('company')} /></Field>
          <Field label="Number" error={errors.transport_number?.message}><Input placeholder="AA 123" {...register('transport_number')} /></Field>
        </div>
      </FormCard>

      <FormCard title="Departure">
        <Field label="Place / code" error={errors.departure_description?.message}><Input placeholder="LAX" {...register('departure_description')} /></Field>
        <GeoField form={form} addressName="departure_address" latName="departure_latitude" lngName="departure_longitude" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date & time" error={errors.departure_at?.message}><Input type="datetime-local" {...register('departure_at')} /></Field>
          <Field label="Time zone" error={errors.departure_timezone?.message}><TimeZoneInput {...register('departure_timezone')} /></Field>
          <Field label="Terminal" error={errors.departure_terminal?.message}><Input {...register('departure_terminal')} /></Field>
          <Field label="Gate" error={errors.departure_gate?.message}><Input {...register('departure_gate')} /></Field>
        </div>
      </FormCard>

      <FormCard title="Arrival">
        <Field label="Place / code" error={errors.arrival_description?.message}><Input placeholder="FCO" {...register('arrival_description')} /></Field>
        <GeoField form={form} addressName="arrival_address" latName="arrival_latitude" lngName="arrival_longitude" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date & time" error={errors.arrival_at?.message}><Input type="datetime-local" {...register('arrival_at')} /></Field>
          <Field label="Time zone" error={errors.arrival_timezone?.message}><TimeZoneInput {...register('arrival_timezone')} /></Field>
          <Field label="Terminal" error={errors.arrival_terminal?.message}><Input {...register('arrival_terminal')} /></Field>
          <Field label="Gate" error={errors.arrival_gate?.message}><Input {...register('arrival_gate')} /></Field>
          <Field label="Baggage claim" error={errors.arrival_bags?.message}><Input {...register('arrival_bags')} /></Field>
        </div>
      </FormCard>

      <FormCard title="Booking">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seat" error={errors.seat_number?.message}><Input {...register('seat_number')} /></Field>
          <Field label="Class" error={errors.seat_class?.message}><Input {...register('seat_class')} /></Field>
        </div>
        <Field label="Reservation code" error={errors.provider_reservation_code?.message}><Input {...register('provider_reservation_code')} /></Field>
        {canSeeExpenses && <PriceFields form={form} />}
      </FormCard>

      <FormCard title="Notes">
        <TextArea {...register('notes')} />
        <Toggle checked={watch('hidden')} onChange={(v) => setValue('hidden', v, { shouldDirty: true })} label="Hidden" description="Hide from collaborators' itineraries" />
      </FormCard>
      <FormError message={notice} />
    </form>
  );
}
