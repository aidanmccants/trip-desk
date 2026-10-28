import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@shared/types';
import { api, diff } from '../../lib/api';
import { invalidateTrip, qk } from '../../lib/queries';
import { browserTimeZone } from '../../lib/time';
import { Button, ErrorNotice, Field, Input, Sheet, TextArea, Toggle } from '../../components/ui';
import { TimeZoneInput, applyApiErrors } from '../../components/form';
import { CoverPicker, type CoverValue } from './CoverPicker';

const schema = z
  .object({
    name: z.string().trim().min(1, 'Give the trip a name.').max(255),
    description: z.string(),
    timezone: z.string().trim(),
    has_dates: z.boolean(),
    starts_at: z.string(),
    ends_at: z.string(),
    number_of_days: z.coerce.number().int().min(1, 'At least 1 day.').max(365, 'At most 365 days.'),
    hidden: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.has_dates) return;
    if (!v.starts_at) ctx.addIssue({ code: 'custom', path: ['starts_at'], message: 'Pick a start date.' });
    if (!v.ends_at) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'Pick an end date.' });
    if (v.starts_at && v.ends_at && v.ends_at < v.starts_at) {
      ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'End date must be on or after the start date.' });
    }
  });
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const FIELDS = ['name', 'description', 'timezone', 'has_dates', 'starts_at', 'ends_at', 'number_of_days', 'hidden', 'cover_gradient', 'cover_image_url'] as const;

const defaultsFor = (trip?: Trip): FormInput => ({
  name: trip?.name ?? '',
  description: trip?.description ?? '',
  timezone: trip?.timezone ?? browserTimeZone(),
  has_dates: trip?.has_dates ?? true,
  starts_at: trip?.starts_at ?? '',
  ends_at: trip?.ends_at ?? '',
  number_of_days: trip?.number_of_days || 7,
  hidden: trip?.hidden ?? false,
});

/** Create (no trip) or edit a trip. onSaved gets the saved trip id. */
export function TripSheet({ open, onClose, trip, onSaved }: { open: boolean; onClose: () => void; trip?: Trip; onSaved?: (id: number) => void }) {
  const qc = useQueryClient();
  const [cover, setCover] = useState<CoverValue>({ cover_gradient: trip?.cover_gradient ?? null, cover_image_url: trip?.cover_image_url ?? null });
  const [formError, setFormError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset, setError, watch, formState: { errors } } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(trip),
  });
  const hasDates = watch('has_dates');

  // Re-seed each time the sheet opens so a cancelled edit doesn't linger.
  useEffect(() => {
    if (!open) return;
    reset(defaultsFor(trip));
    setCover({ cover_gradient: trip?.cover_gradient ?? null, cover_image_url: trip?.cover_image_url ?? null });
    setFormError(null);
  }, [open, trip, reset]);

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const next: Record<string, unknown> = {
        name: v.name,
        description: v.description.trim() || null,
        timezone: v.timezone || null,
        has_dates: v.has_dates,
        hidden: v.hidden,
        ...cover,
      };
      if (v.has_dates) {
        next.starts_at = v.starts_at;
        next.ends_at = v.ends_at;
      } else {
        next.number_of_days = v.number_of_days;
      }
      if (trip) {
        const body = diff(next, trip as unknown as Record<string, unknown>);
        if (Object.keys(body).length) await api.patch(`/v1/trips/${trip.id}`, body);
        return trip.id;
      }
      // An empty 200 means Tripsy treated this as a duplicate; there is no id to return.
      if (next.cover_gradient == null) delete next.cover_gradient;
      if (next.cover_image_url == null) delete next.cover_image_url;
      const created = await api.post<Trip | null>('/v1/trips', next);
      return created?.id ?? null;
    },
    onSuccess: async (id) => {
      if (trip) await invalidateTrip(qc, trip.id);
      else await qc.invalidateQueries({ queryKey: qk.trips });
      onClose();
      if (id != null) onSaved?.(id);
    },
    onError: (e) => setFormError(applyApiErrors<FormInput>(e, setError, FIELDS)),
  });

  const submit = handleSubmit((v) => {
    setFormError(null);
    save.mutate(v);
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={trip ? 'Edit trip' : 'New trip'}
      width="lg"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={submit}>{trip ? 'Save' : 'Create trip'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" error={errors.name?.message}>
          <Input autoFocus placeholder="Summer in Italy" {...register('name')} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <TextArea placeholder="Optional" {...register('description')} />
        </Field>
        <Field label="Time zone" error={errors.timezone?.message}>
          <TimeZoneInput {...register('timezone')} />
        </Field>

        <div className="card divide-y divide-separator/40">
          <Controller
            control={control}
            name="has_dates"
            render={({ field }) => <Toggle label="Set dates" description="Off for a trip with just a number of days." checked={field.value} onChange={field.onChange} />}
          />
          <div className="space-y-3 p-4">
            {hasDates ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts" error={errors.starts_at?.message}><Input type="date" {...register('starts_at')} /></Field>
                <Field label="Ends" error={errors.ends_at?.message}><Input type="date" {...register('ends_at')} /></Field>
              </div>
            ) : (
              <Field label="Number of days" error={errors.number_of_days?.message}>
                <Input type="number" min={1} max={365} {...register('number_of_days')} />
              </Field>
            )}
          </div>
          <Controller
            control={control}
            name="hidden"
            render={({ field }) => <Toggle label="Hidden" description="Hide this trip from calendar and widgets." checked={field.value} onChange={field.onChange} />}
          />
        </div>

        <div>
          <span className="label">Cover</span>
          <CoverPicker value={cover} onChange={setCover} tripId={trip?.id} previewId={trip?.id} />
        </div>
        <ErrorNotice error={formError ? new Error(formError) : null} />
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
