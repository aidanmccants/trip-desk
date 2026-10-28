import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import type { Activity } from '@shared/types';
import { ACTIVITY_FIELDS } from '@shared/fields';
import { Field, Input, TextArea, Toggle, cx } from '../../../components/ui';
import { TimeZoneInput, applyApiErrors } from '../../../components/form';
import { activityTypeOptions } from '../../../lib/categories';
import { localInputToUtc, utcToLocalInput } from '../../../lib/time';
import { useCategories, useItems, useMe, useMyPermissions } from '../../../lib/queries';
import {
  FormCard, FormError, GeoField, PriceFields, TypePicker, baseDay, buildBody, defaultTz, numStr, orNull,
  priceBody, priceOk, useSaveItem, type ItemFormProps,
} from './shared';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  activity_type: z.string().trim().min(1, 'Choose a type'),
  all_day: z.boolean(),
  starts_at: z.string(),
  ends_at: z.string(),
  timezone: z.string(),
  address: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  phone: z.string(),
  website: z.string(),
  provider_reservation_code: z.string(),
  notes: z.string(),
  price: z.string().refine(priceOk, 'Enter a number'),
  currency: z.string().max(3),
  checked: z.boolean(),
  hidden: z.boolean(),
});
type Values = z.infer<typeof schema>;

function body(v: Values, canSeeExpenses: boolean): Record<string, unknown> {
  const tz = v.timezone.trim() || null;
  const conv = (s: string) => {
    if (!s) return null;
    return localInputToUtc(v.all_day ? `${s.slice(0, 10)}T00:00` : s, tz);
  };
  return {
    name: v.name.trim(),
    activity_type: v.activity_type.trim(),
    all_day: v.all_day,
    starts_at: conv(v.starts_at),
    ends_at: conv(v.ends_at),
    timezone: tz,
    address: orNull(v.address),
    latitude: v.latitude,
    longitude: v.longitude,
    phone: orNull(v.phone),
    website: orNull(v.website),
    provider_reservation_code: orNull(v.provider_reservation_code),
    notes: orNull(v.notes),
    checked: v.checked,
    hidden: v.hidden,
    ...priceBody(v, canSeeExpenses),
  };
}

export function ActivityForm({ trip, item, defaultDay, formId, onSaved, onPending }: ItemFormProps<Activity>) {
  const { canSeeExpenses } = useMyPermissions(trip.id);
  const me = useMe();
  const categories = useCategories();
  const siblings = useItems(trip.id, 'activity');
  const save = useSaveItem(trip, 'activity', item?.id);
  const [notice, setNotice] = useState<string | null>(null);
  const [other, setOther] = useState(false);

  const initial = useMemo<Values>(() => {
    if (item) {
      const tz = item.timezone || defaultTz(trip);
      return {
        name: item.name, activity_type: item.activity_type, all_day: item.all_day,
        starts_at: utcToLocalInput(item.starts_at, tz), ends_at: utcToLocalInput(item.ends_at, tz), timezone: item.timezone ?? tz,
        address: item.address ?? '', latitude: item.latitude ?? null, longitude: item.longitude ?? null,
        phone: item.phone ?? '', website: item.website ?? '', provider_reservation_code: item.provider_reservation_code ?? '',
        notes: item.notes ?? '', price: numStr(item.price), currency: item.currency ?? me.data?.default_currency ?? '',
        checked: item.checked, hidden: item.hidden,
      };
    }
    const day = baseDay(trip, defaultDay);
    return {
      name: '', activity_type: 'place', all_day: false, starts_at: `${day}T09:00`, ends_at: '', timezone: defaultTz(trip),
      address: '', latitude: null, longitude: null, phone: '', website: '', provider_reservation_code: '', notes: '',
      price: '', currency: me.data?.default_currency ?? '', checked: false, hidden: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const { register, handleSubmit, setError, watch, setValue, formState: { errors } } = form;
  const allDay = watch('all_day');
  const type = watch('activity_type');

  useEffect(() => {
    if (!form.getValues('currency') && me.data?.default_currency) setValue('currency', me.data.default_currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data?.default_currency]);
  useEffect(() => onPending(save.isPending), [save.isPending, onPending]);

  const options = useMemo(
    () => activityTypeOptions(categories.data ?? [], [...(siblings.data ?? []).map((a) => a.activity_type), initial.activity_type]),
    [categories.data, siblings.data, initial.activity_type],
  );

  const toggleAllDay = (on: boolean) => {
    setValue('all_day', on, { shouldDirty: true });
    const s = form.getValues('starts_at');
    const e = form.getValues('ends_at');
    setValue('starts_at', on ? s.slice(0, 10) : s.length === 10 ? `${s}T09:00` : s);
    setValue('ends_at', on ? e.slice(0, 10) : e.length === 10 ? `${e}T10:00` : e);
  };

  const submit = handleSubmit(async (v) => {
    setNotice(null);
    const next = body(v, canSeeExpenses);
    const original = item ? body(initial, canSeeExpenses) : null;
    try {
      await save.mutateAsync(buildBody(next, original));
      onSaved();
    } catch (e) {
      setNotice(applyApiErrors(e, setError, ACTIVITY_FIELDS));
    }
  });

  const kind = allDay ? 'date' : 'datetime-local';
  return (
    <form id={formId} onSubmit={submit} noValidate>
      <FormCard title="Type">
        <TypePicker
          options={options}
          value={other ? '' : type}
          onChange={(v) => { setOther(false); setValue('activity_type', v, { shouldDirty: true }); }}
          extra={
            <button
              type="button"
              onClick={() => { setOther(true); setValue('activity_type', ''); }}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-xl px-1 py-2.5 text-caption transition',
                other ? 'bg-accent/10 ring-2 ring-accent' : 'bg-card-2 hover:bg-fill/15',
              )}
            >
              <span className="grid h-9 w-9 place-items-center rounded-badge bg-fill/20"><Pencil className="h-4 w-4" /></span>
              Other…
            </button>
          }
        />
        {other && <Input placeholder="Custom type" autoFocus {...register('activity_type')} />}
        {errors.activity_type && <p className="px-1 text-footnote text-danger">{errors.activity_type.message}</p>}
      </FormCard>

      <FormCard title="Details">
        <Field label="Name" error={errors.name?.message}>
          <Input autoFocus={!other} placeholder="Activity name" {...register('name')} />
        </Field>
        <GeoField form={form} addressName="address" latName="latitude" lngName="longitude" />
      </FormCard>

      <FormCard title="When">
        <Toggle checked={allDay} onChange={toggleAllDay} label="All day" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={allDay ? 'Date' : 'Starts'} error={errors.starts_at?.message}>
            <Input key={`s-${kind}`} type={kind} {...register('starts_at')} />
          </Field>
          <Field label={allDay ? 'End date' : 'Ends'} error={errors.ends_at?.message}>
            <Input key={`e-${kind}`} type={kind} {...register('ends_at')} />
          </Field>
        </div>
        <Field label="Time zone" error={errors.timezone?.message}>
          <TimeZoneInput {...register('timezone')} />
        </Field>
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
        <Toggle checked={watch('checked')} onChange={(v) => setValue('checked', v, { shouldDirty: true })} label="Done" />
        <Toggle checked={watch('hidden')} onChange={(v) => setValue('hidden', v, { shouldDirty: true })} label="Hidden" description="Hide from collaborators' itineraries" />
      </FormCard>
      <FormError message={notice} />
    </form>
  );
}
