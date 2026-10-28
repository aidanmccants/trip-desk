import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { qk, useTrips } from '../../lib/queries';
import { Button, ErrorNotice, Field, Select, Sheet, Skeleton } from '../../components/ui';
import { ParentPicker } from '../documents/ParentPicker';
import { destinationBody, type Parent } from '../documents/docs';

/** File an inbox email into a trip, optionally into one of its itinerary items. */
export function FileEmailSheet({ email, open, onClose, onDone }: {
  email: { id: number; subject: string };
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!open) return null;
  return <Inner email={email} onClose={onClose} onDone={onDone} />;
}

function Inner({ email, onClose, onDone }: { email: { id: number; subject: string }; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const trips = useTrips();
  const [tripId, setTripId] = useState<number | null>(null);
  const [target, setTarget] = useState<Parent | null>(null);

  const file = useMutation({
    mutationFn: () => api.patch<null>(`/v1/automation/emails/${email.id}`, destinationBody(target as Parent)),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.inbox }),
        tripId != null ? qc.invalidateQueries({ queryKey: qk.emails(tripId) }) : Promise.resolve(),
      ]);
      onDone();
    },
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title="File into trip"
      subtitle={email.subject}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!target} loading={file.isPending} onClick={() => file.mutate()}>File email</Button>
        </>
      }
    >
      <div className="space-y-4">
        {file.error && <ErrorNotice error={file.error} context="documents" />}
        {trips.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : trips.error ? (
          <ErrorNotice error={trips.error} />
        ) : (
          <Field label="Trip">
            <Select
              value={tripId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setTripId(id);
                setTarget(id != null ? { kind: 'trip', id } : null);
              }}
            >
              <option value="">Choose a trip…</option>
              {trips.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
        )}
        {tripId != null && (
          <ParentPicker key={tripId} tripId={tripId} value={target} onChange={setTarget} label="Item (optional)" tripLabel="Just the trip" />
        )}
      </div>
    </Sheet>
  );
}
