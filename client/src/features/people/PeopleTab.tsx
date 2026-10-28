import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LogOut, UserPlus, Users } from 'lucide-react';
import type { Collaborator, Trip } from '@shared/types';
import { api } from '../../lib/api';
import { qk, useCollaborators, useMe, useMyPermissions } from '../../lib/queries';
import { Button, EmptyState, ErrorNotice, ListSkeleton, cx, useConfirm } from '../../components/ui';
import { Avatar } from './Avatar';
import { InviteSheet } from './InviteSheet';
import { PermissionsSheet } from './PermissionsSheet';

function Pill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'accent' | 'warn' }) {
  return (
    <span
      className={cx(
        'rounded-pill px-2 py-0.5 text-caption font-medium',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'warn' && 'bg-[#FF8A00]/15 text-[#FF8A00]',
        tone === 'neutral' && 'bg-fill/20 text-label-2',
      )}
    >
      {children}
    </span>
  );
}

export function PeopleTab({ trip }: { trip: Trip }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const perms = useMyPermissions(trip.id);
  const collabs = useCollaborators(trip.id);
  const [selected, setSelected] = useState<Collaborator | null>(null);
  const [inviting, setInviting] = useState(false);
  const [leaveError, setLeaveError] = useState<unknown>(null);
  const confirm = useConfirm('Leave this trip?', 'You will lose access to this trip unless someone invites you again.');

  const leave = useMutation({
    mutationFn: () => api.del(`/v1/trip/${trip.id}/collaborator/${me.data!.id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.trips });
      navigate('/');
    },
  });

  if (collabs.isLoading) return <ListSkeleton rows={3} />;
  if (collabs.error) return <ErrorNotice error={collabs.error} />;
  const members = collabs.data ?? [];
  const myId = me.data?.id;
  const amOwner = perms.isOwner;

  return (
    <div className="space-y-5">
      {perms.canAddGuests && (
        <Button variant="primary" icon={UserPlus} onClick={() => setInviting(true)}>Invite</Button>
      )}
      {members.length === 0 ? (
        <EmptyState icon={Users} title="No one here yet" />
      ) : (
        <div className="card divide-y divide-separator/40 overflow-hidden">
          {members.map((m) => {
            const isSelf = m.id === myId;
            const owner = m.permissions.is_owner;
            const clickable = isSelf || (perms.canAddGuests && !owner);
            const body = (
              <>
                <Avatar name={m.name} photoUrl={m.photo_url} />
                <div className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-callout font-medium">{m.name}</span>
                    {isSelf && <Pill tone="accent">You</Pill>}
                  </div>
                  <div className="truncate text-footnote text-label-3">{m.email}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {owner && <Pill tone="accent">Owner</Pill>}
                    {!m.joined && <Pill tone="warn">Pending</Pill>}
                    {m.permissions.is_travelling && <Pill>Travelling</Pill>}
                    {!m.permissions.can_edit && !owner && <Pill>View only</Pill>}
                  </div>
                </div>
                {clickable && <ChevronRight className="h-4 w-4 text-label-3" />}
              </>
            );
            return clickable ? (
              <button key={m.id} type="button" className="row w-full hover:bg-fill/10" onClick={() => setSelected(m)}>{body}</button>
            ) : (
              <div key={m.id} className="row">{body}</div>
            );
          })}
        </div>
      )}
      {!amOwner && myId !== undefined && members.some((m) => m.id === myId) && (
        <>
          <ErrorNotice error={leaveError} />
          <Button
            variant="danger"
            icon={LogOut}
            onClick={() => {
              setLeaveError(null);
              confirm.ask(async () => {
                try {
                  await leave.mutateAsync();
                } catch (e) {
                  setLeaveError(e);
                }
              });
            }}
          >
            Leave trip
          </Button>
        </>
      )}
      {confirm.dialog}
      <PermissionsSheet trip={trip} member={selected} open={!!selected} onClose={() => setSelected(null)} />
      <InviteSheet trip={trip} open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}
