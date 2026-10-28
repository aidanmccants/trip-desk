import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderInput, InboxIcon, Mail, Paperclip, Pencil, Trash2 } from 'lucide-react';
import type { EmailSummary } from '@shared/types';
import { api, fetchAll } from '../../lib/api';
import { qk } from '../../lib/queries';
import {
  Button, EmptyState, ErrorNotice, Field, Input, IconButton, ListSkeleton, Sheet, useConfirm,
} from '../../components/ui';
import { EmailViewerSheet } from '../documents/EmailViewerSheet';
import { fmtDate } from '../documents/docs';
import { FileEmailSheet } from './FileEmailSheet';

function RenameSubjectSheet({ email, onClose }: { email: { id: number; subject: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(email.subject);
  const save = useMutation({
    mutationFn: () => api.patch<null>(`/v1/automation/emails/${email.id}`, { subject: subject.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.inbox });
      onClose();
    },
  });
  return (
    <Sheet
      open
      onClose={onClose}
      title="Rename email"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} disabled={!subject.trim() || subject.trim() === email.subject} onClick={() => save.mutate()}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        {save.error && <ErrorNotice error={save.error} />}
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
        </Field>
      </div>
    </Sheet>
  );
}

export function InboxPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.inbox, queryFn: () => fetchAll<EmailSummary>('/v1/automation/emails') });
  const [selected, setSelected] = useState<EmailSummary | null>(null);
  const [filing, setFiling] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const confirm = useConfirm('Delete this email?', 'It will be removed from your inbox.');

  const close = () => {
    setSelected(null);
    setFiling(false);
    setRenaming(false);
  };

  const remove = (e: EmailSummary) =>
    confirm.ask(async () => {
      setDeleteError(null);
      try {
        await api.del(`/v1/automation/emails/${e.id}`);
        await qc.invalidateQueries({ queryKey: qk.inbox });
        close();
      } catch (err) {
        setDeleteError(err);
        throw err;
      }
    });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="text-title-1">Inbox</h1>
      <p className="mt-1 text-subhead text-label-3">Booking emails Tripsy couldn't file automatically.</p>

      <div className="mt-6 space-y-4">
        {deleteError != null && <ErrorNotice error={deleteError} />}
        {list.isLoading ? (
          <ListSkeleton rows={5} />
        ) : list.error ? (
          <ErrorNotice error={list.error} context="documents" />
        ) : list.data?.length ? (
          <div className="card">
            {list.data.map((e) => (
              <button key={e.id} type="button" onClick={() => setSelected(e)} className="row w-full text-left hover:bg-fill/10">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill/20 text-label-2">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{e.subject || '(No subject)'}</span>
                  <span className="line-clamp-2 text-footnote text-label-3">{e.body_preview}</span>
                </span>
                <span className="shrink-0 text-right text-footnote text-label-3">
                  <span className="block">{fmtDate(e.date)}</span>
                  {!!e.attachments_count && (
                    <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{e.attachments_count}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState icon={InboxIcon} title="Inbox zero" message="Every booking email has been filed into a trip." />
          </div>
        )}
      </div>

      {confirm.dialog}
      {selected && (
        <EmailViewerSheet
          path={`/v1/automation/emails/${selected.id}`}
          queryKey={qk.inboxEmail(selected.id)}
          onClose={close}
          leading={() => <IconButton icon={Trash2} label="Delete email" onClick={() => remove(selected)} />}
          footer={() => (
            <>
              <Button icon={Pencil} onClick={() => setRenaming(true)}>Rename</Button>
              <Button variant="primary" icon={FolderInput} onClick={() => setFiling(true)}>File into trip…</Button>
            </>
          )}
        />
      )}
      {selected && filing && (
        <FileEmailSheet email={selected} open onClose={() => setFiling(false)} onDone={close} />
      )}
      {selected && renaming && (
        <RenameSubjectSheet email={selected} onClose={() => setRenaming(false)} />
      )}
    </div>
  );
}
