import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@shared/types';
import { Button, ErrorNotice, Field, Input, Sheet, TextArea } from '../../components/ui';
import { applyApiErrors } from '../../components/form';
import { ParentPicker } from './ParentPicker';
import { attachDocument, invalidateDocuments, type Parent } from './docs';

const schema = z.object({
  url: z.string().trim().url('Enter a full address, like https://example.com').refine((v) => /^https?:\/\//i.test(v), 'Only http and https links are allowed'),
  title: z.string().trim().min(1, 'Give the link a title').max(255),
  description: z.string().max(2000).optional(),
});
type Values = z.infer<typeof schema>;

/** Attach a web link to the trip or an item. `parent` presets (and hides) the destination. */
export function AttachLinkSheet({ trip, parent, open, onClose }: { trip: Trip; parent?: Parent; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner trip={trip} parent={parent} onClose={onClose} />;
}

function Inner({ trip, parent, onClose }: { trip: Trip; parent?: Parent; onClose: () => void }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<Parent | null>(parent ?? { kind: 'trip', id: trip.id });
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { url: '', title: '', description: '' },
  });

  const save = useMutation({
    mutationFn: (v: Values) =>
      attachDocument(trip.id, target ?? { kind: 'trip', id: trip.id }, {
        url: v.url.trim(),
        file_type: 'url',
        title: v.title.trim(),
        ...(v.description?.trim() ? { description: v.description.trim() } : {}),
      }),
    onSuccess: async () => {
      await invalidateDocuments(qc, trip.id);
      onClose();
    },
    onError: (e) => setFormError(applyApiErrors(e, setError, ['url', 'title', 'description'])),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title="Add link"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="attach-link-form" loading={save.isPending}>Add link</Button>
        </>
      }
    >
      <form id="attach-link-form" className="space-y-4" onSubmit={handleSubmit((v) => { setFormError(null); save.mutate(v); })}>
        {formError && <ErrorNotice error={new Error(formError)} />}
        <Field label="Web address" error={errors.url?.message}>
          <Input type="url" placeholder="https://" autoFocus {...register('url')} />
        </Field>
        <Field label="Title" error={errors.title?.message}>
          <Input {...register('title')} />
        </Field>
        <Field label="Description" error={errors.description?.message}>
          <TextArea {...register('description')} />
        </Field>
        {!parent && <ParentPicker tripId={trip.id} value={target} onChange={setTarget} />}
      </form>
    </Sheet>
  );
}
