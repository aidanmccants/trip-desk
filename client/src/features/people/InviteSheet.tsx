// Invite someone to a trip by favorite or email.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import type { Collaborator, Favorite, Trip } from '@shared/types';
import { INVITE_PERMISSION_FIELDS } from '@shared/fields';
import { ApiError, api, fetchAll } from '../../lib/api';
import { qk, useMyPermissions } from '../../lib/queries';
import { Button, ErrorNotice, Field, Input, Sheet, Toggle, cx } from '../../components/ui';
import { Avatar } from './Avatar';

type Perm = Exclude<(typeof INVITE_PERMISSION_FIELDS)[number], 'title'>;

const LABELS: Record<Perm, string> = {
  read_only: 'View only',
  can_add_guests: 'Can add guests',
  can_see_expenses: 'Can see expenses',
  can_edit_expenses: 'Can edit expenses',
  can_see_documents: 'Can see documents',
  can_edit_documents: 'Can edit documents',
  is_travelling: 'Is travelling',
};
const ORDER: Perm[] = ['read_only', 'can_add_guests', 'can_see_expenses', 'can_edit_expenses', 'can_see_documents', 'can_edit_documents', 'is_travelling'];
/** Switched off (and locked) by read_only. */
const EDIT_TYPE: Perm[] = ['can_add_guests', 'can_edit_expenses', 'can_edit_documents'];

const NOT_FOUND = 'Tripsy can only invite people who are your favorites or share another trip with you.';

export function InviteSheet({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const mine = useMyPermissions(trip.id);
  const favorites = useQuery({
    queryKey: qk.favorites,
    queryFn: () => fetchAll<Favorite>('/v1/guests/favorites'),
    enabled: open,
  });

  const has: Record<Perm, boolean> = {
    read_only: true,
    can_add_guests: mine.canAddGuests,
    can_see_expenses: mine.canSeeExpenses,
    can_edit_expenses: mine.canEditExpenses,
    can_see_documents: mine.canSeeDocuments,
    can_edit_documents: mine.canEditDocuments,
    is_travelling: true,
  };
  const initial = (): Record<Perm, boolean> => ({
    read_only: false,
    can_add_guests: false,
    can_see_expenses: has.can_see_expenses,
    can_edit_expenses: false,
    can_see_documents: has.can_see_documents,
    can_edit_documents: false,
    is_travelling: true,
  });

  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [perms, setPerms] = useState<Record<Perm, boolean>>(initial);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setTitle('');
      setPerms(initial());
      setError(null);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = useMutation({
    mutationFn: () => {
      const permissions: Record<string, boolean | string> = {};
      for (const k of ORDER) if (has[k]) permissions[k] = perms[k];
      if (title.trim()) permissions.title = title.trim();
      return api.post('/v1/guests/invite', { trip_id: trip.id, invited_user_email: email.trim(), permissions });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.collaborators(trip.id) });
      await qc.invalidateQueries({ queryKey: qk.favorites });
      const list = qc.getQueryData<Collaborator[]>(qk.collaborators(trip.id)) ?? [];
      const found = list.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
      setResult(found?.joined ? `${found.name} was added to the trip.` : 'Invitation sent. They appear here once they join.');
    },
    onError: (e) => setError(e instanceof ApiError && e.status === 404 ? new Error(NOT_FOUND) : e),
  });

  const setPerm = (k: Perm, v: boolean) =>
    setPerms((p) => {
      const next = { ...p, [k]: v };
      if (k === 'read_only' && v) for (const e of EDIT_TYPE) next[e] = false;
      return next;
    });

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const faves = (favorites.data ?? []).filter((f) => f.favorite_user.email);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invite to trip"
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" disabled={!validEmail} loading={send.isPending} onClick={() => { setError(null); send.mutate(); }}>
              Send invite
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"><Check className="h-7 w-7" /></span>
          <p className="text-callout">{result}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <ErrorNotice error={error} />
          {faves.length > 0 && (
            <div>
              <div className="label">Favorites</div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {faves.map((f) => {
                  const u = f.favorite_user;
                  const on = email.trim().toLowerCase() === u.email!.toLowerCase();
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setEmail(u.email!)}
                      className="flex w-20 shrink-0 flex-col items-center gap-1 text-center"
                    >
                      <span className={cx('rounded-full p-0.5 ring-2', on ? 'ring-accent' : 'ring-transparent')}>
                        <Avatar name={u.name} photoUrl={u.photo_url} size={48} seed={u.email} />
                      </span>
                      <span className="w-full truncate text-caption">{u.name}</span>
                      {f.pending && <span className="text-caption text-label-3">Invitation pending</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Field label="Email">
            <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Title (optional)">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Travel buddy" />
          </Field>
          <div className="card divide-y divide-separator/40 overflow-hidden">
            {ORDER.filter((k) => has[k]).map((k) => (
              <Toggle
                key={k}
                label={LABELS[k]}
                checked={perms[k]}
                disabled={perms.read_only && EDIT_TYPE.includes(k)}
                onChange={(v) => setPerm(k, v)}
              />
            ))}
          </div>
          <p className="text-footnote text-label-3">{NOT_FOUND}</p>
        </div>
      )}
    </Sheet>
  );
}
