// Account settings (/settings). The profile form saves in one PATCH /v1/me with only the fields
// that changed. The photo saves on its own as soon as it uploads, so it sits outside the form.
// Custom categories live in CategoriesSection.
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PROFILE_FIELDS } from '@shared/fields';
import type { Profile } from '@shared/types';
import { api, diff } from '../../lib/api';
import { qk, useMe } from '../../lib/queries';
import { uploadFile } from '../../lib/upload';
import { applyApiErrors, CurrencyInput, TimeZoneInput } from '../../components/form';
import { Button, ErrorNotice, Field, Input, SectionCard, Skeleton, Toggle } from '../../components/ui';
import { CategoriesSection } from './CategoriesSection';

const CURRENCY = /^[A-Za-z]{3}$/;

const FormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  username: z.string().trim().min(1, 'Username is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  language: z.string().trim().min(1, 'Enter a language code, such as en.'),
  timezone: z.string().trim().min(1, 'Choose a timezone.'),
  default_currency: z.string().trim().regex(CURRENCY, 'Use a 3-letter code, such as USD.'),
  store_currency: z.string().trim().regex(CURRENCY, 'Use a 3-letter code, such as USD.'),
  calendar_emojis: z.boolean(),
  calendar_lodgings_all_day: z.boolean(),
  calendar_trips_all_day: z.boolean(),
  notifications_flights_general_enabled: z.boolean(),
  notifications_flights_departure_and_arrival: z.boolean(),
  notifications_collaborators_new_activities_enabled: z.boolean(),
});
type FormValues = z.infer<typeof FormSchema>;
type BoolField = {
  [K in keyof FormValues]: FormValues[K] extends boolean ? K : never;
}[keyof FormValues];
const FORM_FIELDS = Object.keys(FormSchema.shape);

/** The form's view of a profile. Photo is handled separately, so it is not part of the form. */
function toForm(p: Profile): FormValues {
  return {
    name: p.name,
    username: p.username,
    email: p.email,
    language: p.language,
    timezone: p.timezone,
    default_currency: p.default_currency,
    store_currency: p.store_currency,
    calendar_emojis: p.calendar_emojis,
    calendar_lodgings_all_day: p.calendar_lodgings_all_day,
    calendar_trips_all_day: p.calendar_trips_all_day,
    notifications_flights_general_enabled: p.notifications_flights_general_enabled,
    notifications_flights_departure_and_arrival: p.notifications_flights_departure_and_arrival,
    notifications_collaborators_new_activities_enabled: p.notifications_collaborators_new_activities_enabled,
  };
}

export function SettingsPage() {
  const me = useMe();
  const profile = me.data;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <h1 className="text-large-title">Settings</h1>

      {profile ? (
        <ProfileForm profile={profile} />
      ) : me.error ? (
        <ErrorNotice error={me.error} />
      ) : (
        <ProfileSkeleton />
      )}

      <CategoriesSection meId={profile?.id} />

      {profile && <AccountSection isPremium={profile.is_premium} />}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card space-y-3 p-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Profile, preferences, calendar and notification settings, saved together. */
function ProfileForm({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  // The values last loaded from or saved to the server. Diffs are taken against this, not the
  // live profile, so a background refetch cannot make an untouched field look changed.
  const [baseline, setBaseline] = useState<FormValues>(() => toForm(profile));
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: baseline,
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    setSaved(false);
    const next: FormValues = {
      ...values,
      default_currency: values.default_currency.toUpperCase(),
      store_currency: values.store_currency.toUpperCase(),
    };
    const changes = diff(next, baseline);
    const body = Object.fromEntries(
      Object.entries(changes).filter(([key]) => (PROFILE_FIELDS as readonly string[]).includes(key)),
    );
    if (Object.keys(body).length === 0) {
      // Only case changes that normalise back to the saved value end up here.
      form.reset(next);
      setSaved(true);
      return;
    }
    try {
      await api.patch<Profile>('/v1/me', body);
      await qc.invalidateQueries({ queryKey: qk.me });
      const fresh = qc.getQueryData<Profile>(qk.me);
      const nextBaseline = fresh ? toForm(fresh) : next;
      setBaseline(nextBaseline);
      form.reset(nextBaseline);
      setSaved(true);
    } catch (e) {
      const message = applyApiErrors(e, form.setError, FORM_FIELDS);
      setFormError(message);
    }
  };

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SectionCard title="Profile">
        <PhotoRow profile={profile} />
        <FieldRow>
          <Field label="Name" error={errors.name?.message}>
            <Input autoComplete="name" {...form.register('name')} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Username" error={errors.username?.message}>
            <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...form.register('username')} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...form.register('email')} />
          </Field>
        </FieldRow>
      </SectionCard>

      <SectionCard title="Preferences">
        <FieldRow>
          <Field label="Language" hint="A language code, such as en." error={errors.language?.message}>
            <Input autoComplete="off" {...form.register('language')} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Timezone" error={errors.timezone?.message}>
            <TimeZoneInput {...form.register('timezone')} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Default currency" error={errors.default_currency?.message}>
            <CurrencyInput {...form.register('default_currency')} />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Store currency" error={errors.store_currency?.message}>
            <CurrencyInput {...form.register('store_currency')} />
          </Field>
        </FieldRow>
      </SectionCard>

      <SectionCard title="Calendar">
        <SwitchField control={form.control} name="calendar_emojis" label="Emoji on calendar" />
        <SwitchField control={form.control} name="calendar_lodgings_all_day" label="Lodgings as all-day" />
        <SwitchField control={form.control} name="calendar_trips_all_day" label="Trips as all-day" />
      </SectionCard>

      <SectionCard title="Notifications">
        <SwitchField control={form.control} name="notifications_flights_general_enabled" label="Flight updates" />
        <SwitchField
          control={form.control}
          name="notifications_flights_departure_and_arrival"
          label="Departure and arrival"
        />
        <SwitchField
          control={form.control}
          name="notifications_collaborators_new_activities_enabled"
          label="New activities from collaborators"
        />
      </SectionCard>

      {formError && <ErrorNotice error={new Error(formError)} />}

      <div className="flex items-center justify-end gap-3">
        {saved && !isDirty && <span className="text-footnote text-label-3">Saved</span>}
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div className="row">
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function SwitchField({ control, name, label }: { control: Control<FormValues>; name: BoolField; label: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={label} />}
    />
  );
}

/** Profile photo. Uploads straight to storage, then saves the URL to the profile right away. */
function PhotoRow({ profile }: { profile: Profile }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await uploadFile(file, { purpose: 'profile_photo' });
      if (!ticket.public_url) throw new Error('The upload finished without a photo URL.');
      await api.patch<Profile>('/v1/me', { photo_url: ticket.public_url });
      await qc.invalidateQueries({ queryKey: qk.me });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row">
        <Avatar name={profile.name} src={profile.photo_url} />
        <div className="min-w-0 flex-1">
          <div className="text-callout">Photo</div>
          <div className="truncate text-footnote text-label-3">@{profile.username}</div>
        </div>
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
        <Button variant="plain" size="sm" loading={busy} onClick={() => input.current?.click()}>
          Change photo
        </Button>
      </div>
      {error ? (
        <div className="px-4 pb-3">
          <ErrorNotice error={error} />
        </div>
      ) : null}
    </>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img src={src} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-fill/20 text-headline text-label-2">
      {initials || '?'}
    </span>
  );
}

function AccountSection({ isPremium }: { isPremium: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Stay on the page if sign-out fails: a successful redirect would otherwise show the app again.
  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'tripsy-web' },
      });
      if (!res.ok) throw new Error(`Sign out failed (${res.status}).`);
      window.location.assign('/');
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Account">
      <div className="row">
        <span className="flex-1 text-callout">Tripsy Pro: {isPremium ? 'Active' : 'Not active'}</span>
      </div>
      <div className="row">
        <Button variant="danger" className="w-full" loading={busy} onClick={signOut}>
          Sign out
        </Button>
      </div>
      {error ? (
        <div className="px-4 pb-3">
          <ErrorNotice error={error} />
        </div>
      ) : null}
    </SectionCard>
  );
}
