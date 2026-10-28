import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentMeta } from '@shared/types';
import { api } from '../../lib/api';
import { Button, ErrorNotice, Field, Input, Sheet, TextArea } from '../../components/ui';
import { invalidateDocuments } from './docs';

export interface RenameTarget {
  id: number;
  title: string;
  /** Known description (item lists have it); otherwise it is loaded from the trip document route. */
  description?: string | null;
}

/** Edit title/description via PATCH /v1/documents/{id}, sending only what changed. */
export function RenameSheet({ tripId, doc, open, onClose }: { tripId: number; doc: RenameTarget; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner tripId={tripId} doc={doc} onClose={onClose} />;
}

function Inner({ tripId, doc, onClose }: { tripId: number; doc: RenameTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const known = doc.description !== undefined;
  const detail = useQuery({
    queryKey: ['trip', tripId, 'documents', 'detail', doc.id],
    queryFn: () => api.get<DocumentMeta>(`/v2/trip/${tripId}/documents/${doc.id}`),
    enabled: !known,
    staleTime: 0,
  });
  const original = known ? (doc.description ?? '') : (detail.data?.description ?? '');
  const [title, setTitle] = useState(doc.title);
  const [description, setDescription] = useState<string | null>(null);
  const descValue = description ?? original;
  const loadingDesc = !known && detail.isLoading;

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, string> = {};
      if (title.trim() !== doc.title) body.title = title.trim();
      if (descValue !== original) body.description = descValue;
      return api.patch<null>(`/v1/documents/${doc.id}`, body);
    },
    onSuccess: async () => {
      await invalidateDocuments(qc, tripId);
      onClose();
    },
  });

  const changed = title.trim() !== doc.title || descValue !== original;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Rename document"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!title.trim() || !changed || loadingDesc} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorNotice error={save.error} context="documents" />}
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={255} />
        </Field>
        <Field label="Description">
          <TextArea value={descValue} disabled={loadingDesc} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
