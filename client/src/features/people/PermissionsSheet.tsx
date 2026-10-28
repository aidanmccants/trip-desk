// Edit a collaborator's permissions, or remove them from the trip.
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Collaborator, Trip } from '@shared/types';
import { COLLABORATOR_PERMISSION_FIELDS } from '@shared/fields';
import { api } from '../../lib/api';
import { qk, useMe, useMyPermissions } from '../../lib/queries';
import { Button, ErrorNotice, Sheet, Toggle, useConfirm } from '../../components/ui';
import { Avatar } from './Avatar';

type Field = (typeof COLLABORATOR_PERMISSION_FIELDS)[number];
type Draft = Record<Field, boolean>;

const LABELS: Record<Field, string> = {
  can_edit: 'Can edit itinerary',
  can_add_guests: 'Can add guests',
  can_see_expenses: 'Can see expenses',
  can_edit_expenses: 'Can edit expenses',
  can_see_documents: 'Can see documents',
  can_edit_documents: 'Can edit documents',
  is_travelling: 'Is travelling',
  receive_notifications: 'Receives notifications',
};

/** Fields that need can_edit to be on. */
const NEEDS_EDIT: Field[] = ['can_add_guests', 'can_edit_expenses', 'can_edit_documents'];
const PREFS: Field[] = ['is_travelling', 'receive_notifications'];

const toDraft = (m: Collaborator): Draft => {
  const p = m.permissions as unknown as Record<string, boolean | undefined>;
  return Object.fromEntries(COLLABORATOR_PERMISSION_FIELDS.map((f) => [f, !!p[f]])) as Draft;
};

export function PermissionsSheet({ trip, member, open, onClose }: {
  trip: Trip;
  member: Collaborator | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const me = useMe();
  const mine = useMyPermissions(trip.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open && member) {
      setDraft(toDraft(member));
      setError(null);
    }
  }, [open, member]);

  const confirm = useConfirm('Remove from trip?');

  const save = useMutation({
    mutationFn: async (changes: Partial<Draft>) => {
      const base = `/v1/trip/${trip.id}/collaborator/${member!.id}/permissions`;
      const entries = Object.entries(changes) as [Field, boolean][];
      const limited = isSelf && !mine.canAddGuests || isOwnerRow;
      if (limited) {
        // Preference-only requests carry exactly one field each.
        for (const [k, v] of entries) await api.patch(base, { [k]: v });
      } else if (entries.length) {
        await api.patch(base, changes);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.collaborators(trip.id) });
      onClose();
    },
    onError: async (e) => {
      setError(e);
      await qc.invalidateQueries({ queryKey: qk.collaborators(trip.id) });
    },
  });

  if (!member || !draft) return null;
  const isSelf = member.id === me.data?.id;
  const isOwnerRow = member.permissions.is_owner;
  const limited = (isSelf && !mine.canAddGuests) || isOwnerRow;
  const original = toDraft(member);
  const changes = Object.fromEntries(
    COLLABORATOR_PERMISSION_FIELDS.filter((f) => draft[f] !== original[f]).map((f) => [f, draft[f]]),
  ) as Partial<Draft>;
  const dirty = Object.keys(changes).length > 0;

  const callerHas: Record<Field, boolean> = {
    can_edit: mine.canEdit,
    can_add_guests: mine.canAddGuests,
    can_see_expenses: mine.canSeeExpenses,
    can_edit_expenses: mine.canEditExpenses,
    can_see_documents: mine.canSeeDocuments,
    can_edit_documents: mine.canEditDocuments,
    is_travelling: true,
    receive_notifications: true,
  };

  const disabled = (f: Field): boolean => {
    if (limited) return !PREFS.includes(f);
    if (PREFS.includes(f)) return false;
    // Can't grant what you lack (but you may always revoke what is already on).
    if (!callerHas[f] && !original[f]) return true;
    if (NEEDS_EDIT.includes(f) && !draft.can_edit) return true;
    return false;
  };

  const set = (f: Field, v: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, [f]: v };
      if (f === 'can_edit' && !v) for (const k of NEEDS_EDIT) next[k] = false;
      return next;
    });

  const remove = () =>
    confirm.ask(async () => {
      try {
        await api.del(`/v1/trip/${trip.id}/collaborator/${member.id}`);
        await qc.invalidateQueries({ queryKey: qk.collaborators(trip.id) });
        onClose();
      } catch (e) {
        setError(e);
      }
    });

  const canRemove = !isOwnerRow && !isSelf && mine.canAddGuests;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={member.name}
        subtitle={member.email}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => { setError(null); save.mutate(changes); }}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={member.name} photoUrl={member.photo_url} size={48} />
            <div className="min-w-0">
              <div className="truncate text-headline">{member.name}{isSelf && ' (You)'}</div>
              <div className="truncate text-footnote text-label-3">{member.email}</div>
            </div>
          </div>
          <ErrorNotice error={error} />
          {isOwnerRow && (
            <p className="text-footnote text-label-3">The trip owner always has full access. Only notification and travelling preferences can be changed.</p>
          )}
          {isSelf && !isOwnerRow && !mine.canAddGuests && (
            <p className="text-footnote text-label-3">You can only change your own travelling and notification preferences.</p>
          )}
          <div className="card divide-y divide-separator/40 overflow-hidden">
            {COLLABORATOR_PERMISSION_FIELDS.map((f) => (
              <Toggle key={f} label={LABELS[f]} checked={draft[f]} disabled={disabled(f)} onChange={(v) => set(f, v)} />
            ))}
          </div>
          {canRemove && (
            <Button variant="danger" className="w-full" onClick={remove}>Remove from trip</Button>
          )}
        </div>
      </Sheet>
      {confirm.dialog}
    </>
  );
}
