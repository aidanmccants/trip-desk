import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import type { Activity, AnyItem, Hosting, ItemKind, Transportation, Trip } from '@shared/types';
import { api } from '../../lib/api';
import { invalidateTrip, useMyPermissions } from '../../lib/queries';
import { Button, ErrorNotice, Sheet, useConfirm } from '../../components/ui';
import { HostingForm } from './forms/HostingForm';
import { ActivityForm } from './forms/ActivityForm';
import { TransportationForm } from './forms/TransportationForm';
import { MoveItemSheet } from './MoveItemSheet';

const NOUN: Record<ItemKind, string> = { hosting: 'Lodging', activity: 'Activity', transportation: 'Transportation' };

/** Create (no item) or edit a hosting/activity/transportation. defaultDay is YYYY-MM-DD. */
export function ItemEditSheet({ open, onClose, trip, kind, item, defaultDay }: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  kind: ItemKind;
  item?: AnyItem;
  defaultDay?: string;
}) {
  const qc = useQueryClient();
  const { canEdit } = useMyPermissions(trip.id);
  const [pending, setPending] = useState(false);
  const [moving, setMoving] = useState(false);
  const [delError, setDelError] = useState<unknown>(null);
  const confirm = useConfirm(`Delete this ${NOUN[kind].toLowerCase()}?`, 'This removes it from the trip for everyone.');
  const onPending = useCallback((p: boolean) => setPending(p), []);

  if (!open) return null;
  const formId = `item-form-${kind}`;
  const common = { trip, defaultDay, formId, onSaved: onClose, onPending };

  const remove = () =>
    confirm.ask(async () => {
      if (!item) return;
      setDelError(null);
      try {
        await api.del(`/v1/trip/${trip.id}/${kind}/${item.id}`);
        await invalidateTrip(qc, trip.id);
        onClose();
      } catch (e) {
        setDelError(e);
      }
    });

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        width="lg"
        title={`${item ? 'Edit' : 'New'} ${NOUN[kind]}`}
        subtitle={item?.name}
        footer={
          <>
            {item && canEdit && (
              <div className="mr-auto flex gap-2">
                <Button variant="danger" icon={Trash2} onClick={remove}>Delete</Button>
                <Button icon={ArrowRightLeft} onClick={() => setMoving(true)}>Move to trip…</Button>
              </div>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" form={formId} loading={pending} disabled={!canEdit}>
              {item ? 'Save' : 'Add'}
            </Button>
          </>
        }
      >
        <div className="pt-1">
          {kind === 'hosting' && <HostingForm {...common} item={item as Hosting | undefined} />}
          {kind === 'activity' && <ActivityForm {...common} item={item as Activity | undefined} />}
          {kind === 'transportation' && <TransportationForm {...common} item={item as Transportation | undefined} />}
          <ErrorNotice className="mt-4" error={delError} />
        </div>
      </Sheet>
      {confirm.dialog}
      {item && (
        <MoveItemSheet
          open={moving}
          onClose={() => setMoving(false)}
          onMoved={() => { setMoving(false); onClose(); }}
          trip={trip}
          kind={kind}
          item={item}
        />
      )}
    </>
  );
}
