import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { AnyItem, ItemKind, Trip } from '@shared/types';
import { MOVE_FIELD } from '@shared/fields';
import { api } from '../../lib/api';
import { invalidateTrip, useTrips } from '../../lib/queries';
import { tripRange } from '../../lib/time';
import { Button, ErrorNotice, ListSkeleton, Sheet, cx } from '../../components/ui';

/** Pick another trip and move the item there (PATCH update_trip; Tripsy answers with an empty 200). */
export function MoveItemSheet({ open, onClose, onMoved, trip, kind, item }: {
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
  trip: Trip;
  kind: ItemKind;
  item: AnyItem;
}) {
  const qc = useQueryClient();
  const trips = useTrips();
  const [target, setTarget] = useState<number | null>(null);
  const others = (trips.data ?? []).filter((t) => t.id !== trip.id);

  const move = useMutation({
    mutationFn: (targetId: number) => api.patch(`/v1/trip/${trip.id}/${kind}/${item.id}`, { [MOVE_FIELD]: targetId }),
    onSuccess: async (_d, targetId) => {
      await Promise.all([invalidateTrip(qc, trip.id), invalidateTrip(qc, targetId)]);
      onMoved();
    },
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Move to trip"
      subtitle={item.name}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={target == null} loading={move.isPending} onClick={() => target != null && move.mutate(target)}>
            Move
          </Button>
        </>
      }
    >
      <div className="space-y-3 pt-1">
        {trips.isLoading && <ListSkeleton rows={3} />}
        {!trips.isLoading && others.length === 0 && <p className="py-6 text-center text-subhead text-label-3">You have no other trips.</p>}
        {others.length > 0 && (
          <div className="card divide-y divide-separator/40">
            {others.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarget(t.id)}
                className={cx('row w-full text-left', target === t.id && 'bg-accent/10')}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-callout font-medium">{t.name}</div>
                  <div className="text-footnote text-label-3">{tripRange(t)}</div>
                </div>
                {target === t.id && <Check className="h-5 w-5 text-accent" />}
              </button>
            ))}
          </div>
        )}
        <ErrorNotice error={trips.error ?? move.error} />
      </div>
    </Sheet>
  );
}
