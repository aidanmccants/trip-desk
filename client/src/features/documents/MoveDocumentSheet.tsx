import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button, ErrorNotice, Sheet } from '../../components/ui';
import { ParentPicker } from './ParentPicker';
import { destinationBody, invalidateDocuments, parentKey, type Parent } from './docs';

type Doc = { id: number; title: string };

/** Move a document to the trip or to one item, sending exactly one destination id. */
export function MoveDocumentSheet({ tripId, doc, current, open, onClose }: {
  tripId: number;
  doc: Doc;
  current: Parent;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <Inner tripId={tripId} doc={doc} current={current} onClose={onClose} />;
}

function Inner({ tripId, doc, current, onClose }: { tripId: number; doc: Doc; current: Parent; onClose: () => void }) {
  const qc = useQueryClient();
  const here: Parent = current.kind === 'trip' ? { kind: 'trip', id: tripId } : current;
  const [target, setTarget] = useState<Parent | null>(here);
  const same = !target || parentKey(target) === parentKey(here);
  const move = useMutation({
    mutationFn: () => api.patch<null>(`/v1/documents/${doc.id}`, destinationBody(target as Parent)),
    onSuccess: async () => {
      await invalidateDocuments(qc, tripId);
      onClose();
    },
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title="Move document"
      subtitle={doc.title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={same} loading={move.isPending} onClick={() => move.mutate()}>Move</Button>
        </>
      }
    >
      <div className="space-y-4">
        {move.error && <ErrorNotice error={move.error} context="documents" />}
        <ParentPicker tripId={tripId} value={target} onChange={setTarget} label="Move to" />
      </div>
    </Sheet>
  );
}
