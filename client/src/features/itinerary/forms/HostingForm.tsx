import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Hosting } from '@shared/types';
import { HOSTING_FIELDS } from '@shared/fields';
import { Field, Input, TextArea, Toggle } from '../../../components/ui';
import { TimeZoneInput, applyApiErrors } from '../../../components/form';
import { localInputToUtc, utcToLocalInput } from '../../../lib/time';
import { useMe, useMyPermissions } from '../../../lib/queries';
import {
  FormCard, FormError, GeoField, PriceFields, baseDay, buildBody, defaultTz, nextDay, numStr, orNull,
  priceBody, priceOk, useSaveItem, type ItemFormProps,
} from './shared';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string(),
  room_type: z.string(),
  room_number: z.string(),
  phone: z.string(),
  website: z.string(),
  provider_reservation_code: z.string(),
  notes: z.string(),
  price: z.string().refine(priceOk, 'Enter a number'),
  currency: z.string().max(3),
  hidden: z.boolean(),
});
type Values = z.infer<typeof schema>;

function body(v: Values, canSeeExpenses: boolean): Record<string, unknown> {
  const tz = v.timezone.trim() || null;
  return {
    name: v.name.trim(),
    address: orNull(v.address),
    latitude: v.latitude,
    longitude: v.longitude,
    starts_at: localInputToUtc(v.starts_at, tz),
    ends_at: localInputToUtc(v.ends_at, tz),
    timezone: tz,
    room_type: orNull(v.room_type),
    room_number: orNull(v.room_number),
    phone: orNull(v.phone),
    website: orNull(v.website),
    provider_reservation_code: orNull(v.provider_reservation_code),
    notes: orNull(v.notes),
    hidden: v.hidden,
    ...priceBody(v, canSeeExpenses),
  };
}

export function HostingForm({ trip, item, defaultDay, formId, onSaved, onPending }: ItemFormProps<Hosting>) {
  const { canSeeExpenses } = useMyPermissions(trip.id);
  const me = useMe();
  const save = useSaveItem(trip, 'hosting', item?.id);
  const [notice, setNotice] = useState<string | null>(null);

  const initial = useMemo<Values>(() => {
    if (item) {
      const tz = item.timezone || defaultTz(trip);
      return {
        name: item.name, address: item.address ?? '', latitude: item.latitude ?? null, longitude: item.longitude ?? null,
        starts_at: utcToLocalInput(item.starts_at, tz), ends_at: utcToLocalInput(item.ends_at, tz), timezone: item.timezone ?? tz,
        room_type: item.room_type ?? '', room_number: item.room_number ?? '', phone: item.phone ?? '', website: item.website ?? '',
        provider_reservation_code: item.provider_reservation_code ?? '', notes: item.notes ?? '',
        price: numStr(item.price), currency: item.currency ?? me.data?.default_currency ?? '', hidden: item.hidden,
      };
    }
    const day = baseDay(trip, defaultDay);
    return {
      name: '', address: '', latitude: null, longitude: null,
      starts_at: `${day}T15:00`, ends_at: `${nextDay(day)}T11:00`, timezone: defaultTz(trip),
      room_type: '', room_number: '', phone: '', website: '', provider_reservation_code: '', notes: '',
      price: '', currency: me.data?.default_currency ?? '', hidden: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { register, handleSubmit, setError, formState: { errors } } = form;

  useEffect(() => {
    if (!form.getValues('currency') && me.data?.default_currency) form.setValue('currency', me.data.default_currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data?.default_currency]);
  useEffect(() => onPending(save.isPending), [save.isPending, onPending]);

  const submit = handleSubmit(async (v) => {
    setNotice(null);
    const next = body(v, canSeeExpenses);
    const original = item ? body(initial, canSeeExpenses) : null;
    try {
      await save.mutateAsync(buildBody(next, original));
      onSaved();
    } catch (e) {
      setNotice(applyApiErrors(e, setError, HOSTING_FIELDS));
    }
  });

  return (
    <form id={formId} onSubmit={submit} noValidate>
      <FormCard>
        <Field label="Name" error={errors.name?.message}>
          <Input autoFocus placeholder="Hotel name" {...register('name')} />
        </Field>
        <GeoField form={form} addressName="address" latName="latitude" lngName="longitude" />
      </FormCard>

      <FormCard title="Dates">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Check-in" error={errors.starts_at?.message}>
            <Input type="datetime-local" {...register('starts_at')} />
          </Field>
          <Field label="Check-out" error={errors.ends_at?.message}>
            <Input type="datetime-local" {...register('ends_at')} />
          </Field>
        </div>
        <Field label="Time zone" error={errors.timezone?.message}>
          <TimeZoneInput {...register('timezone')} />
        </Field>
      </FormCard>

      <FormCard title="Room">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Room type" error={errors.room_type?.message}><Input {...register('room_type')} /></Field>
          <Field label="Room number" error={errors.room_number?.message}><Input {...register('room_number')} /></Field>
        </div>
      </FormCard>

      <FormCard title="Contact & booking">
        <Field label="Phone" error={errors.phone?.message}><Input type="tel" {...register('phone')} /></Field>
        <Field label="Website" error={errors.website?.message}><Input type="url" placeholder="https://" {...register('website')} /></Field>
        <Field label="Reservation code" error={errors.provider_reservation_code?.message}>
          <Input {...register('provider_reservation_code')} />
        </Field>
        {canSeeExpenses && <PriceFields form={form} />}
      </FormCard>

      <FormCard title="Notes">
        <TextArea {...register('notes')} />
        <Toggle
          checked={form.watch('hidden')}
          onChange={(v) => form.setValue('hidden', v, { shouldDirty: true })}
          label="Hidden"
          description="Hide from collaborators' itineraries"
        />
      </FormCard>
      <FormError message={notice} />
    </form>
  );
}
