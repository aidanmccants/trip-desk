import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as LinkIcon, Mail, Upload } from 'lucide-react';
import type { DocumentMeta, EmailSummary, ItemKind, Trip } from '@shared/types';
import { api, ApiError, fetchAll } from '../../lib/api';
import { qk, useMyPermissions } from '../../lib/queries';
import { Button, ErrorNotice, SectionCard, Skeleton, useConfirm } from '../../components/ui';
import { AttachLinkSheet } from './AttachLinkSheet';
import { DocumentRow, RowMenu } from './DocumentRow';
import { EmailViewerSheet } from './EmailViewerSheet';
import { RenameSheet } from './RenameSheet';
import { UploadSheet } from './UploadSheet';
import {
  DOC_ICON, deletePath, docKind, fmtDate, invalidateDocuments, itemDocumentsPath, itemEmailsPath, useOpenDocument,
  type Parent,
} from './docs';

const noRetry403 = (n: number, e: unknown) => !(e instanceof ApiError && e.status === 403) && n < 2;
const is403 = (e: unknown) => e instanceof ApiError && e.status === 403;

/** Documents + booking emails attached directly to one itinerary item. */
export function AttachmentsSection({ trip, kind, itemId }: { trip: Trip; kind: ItemKind; itemId: number }) {
  const qc = useQueryClient();
  const perms = useMyPermissions(trip.id);
  const parent: Parent = { kind, id: itemId };
  const confirm = useConfirm('Delete this document?', 'It will be removed from this item.');
  const opener = useOpenDocument();
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rename, setRename] = useState<DocumentMeta | null>(null);
  const [emailId, setEmailId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const docs = useQuery({
    queryKey: qk.itemDocuments(trip.id, kind, itemId),
    queryFn: () => fetchAll<DocumentMeta>(itemDocumentsPath(trip.id, kind, itemId)),
    enabled: perms.canSeeDocuments,
    retry: noRetry403,
  });
  const emails = useQuery({
    queryKey: qk.itemEmails(trip.id, kind, itemId),
    queryFn: () => fetchAll<EmailSummary>(itemEmailsPath(trip.id, kind, itemId)),
    enabled: perms.canSeeDocuments,
    retry: noRetry403,
  });

  if (!perms.canSeeDocuments || is403(docs.error) || is403(emails.error)) {
    return <p className="px-1 text-footnote text-label-3">Documents need Tripsy Pro</p>;
  }

  const del = (d: DocumentMeta) =>
    confirm.ask(async () => {
      setActionError(null);
      try {
        await api.del(deletePath(trip.id, parent, d.id));
        await invalidateDocuments(qc, trip.id);
      } catch (e) {
        setActionError(e);
        throw e;
      }
    });

  return (
    <>
      <SectionCard
        title="Documents"
        action={
          perms.canEditDocuments && (
            <div className="flex gap-1">
              <Button size="sm" variant="plain" icon={LinkIcon} onClick={() => setLinkOpen(true)}>Add link</Button>
              <Button size="sm" variant="plain" icon={Upload} onClick={() => setUploadOpen(true)}>Upload</Button>
            </div>
          )
        }
      >
        {actionError != null && <ErrorNotice className="mx-4 mb-2" error={actionError} context="documents" />}
        {opener.error != null && <ErrorNotice className="mx-4 mb-2" error={opener.error} context="documents" />}
        {docs.isLoading ? (
          <div className="px-4 pb-4"><Skeleton className="h-10 w-full" /></div>
        ) : docs.error ? (
          <ErrorNotice className="mx-4 mb-4" error={docs.error} context="documents" />
        ) : docs.data?.length ? (
          <div>
            {docs.data.map((d) => {
              const k = docKind(d.file_type);
              const Icon = DOC_ICON[k];
              return (
                <DocumentRow
                  key={d.id}
                  badge={<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill/20 text-label-2"><Icon className="h-5 w-5" /></span>}
                  title={d.title}
                  subtitle={d.description || fmtDate(d.created_at)}
                  thumbUrl={k === 'image' ? d.thumb_url : null}
                  busy={opener.busyId === d.id}
                  onClick={() => void opener.open(d.id)}
                  menu={
                    perms.canEditDocuments ? (
                      <RowMenu
                        items={[
                          { label: 'Rename', icon: 'rename', onSelect: () => setRename(d) },
                          { label: 'Delete', icon: 'delete', onSelect: () => del(d) },
                        ]}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="px-4 pb-4 text-subhead text-label-3">No documents attached.</p>
        )}
      </SectionCard>

      {(emails.isLoading || !!emails.data?.length || !!emails.error) && (
        <SectionCard title="Booking emails">
          {emails.isLoading ? (
            <div className="px-4 pb-4"><Skeleton className="h-10 w-full" /></div>
          ) : emails.error ? (
            <ErrorNotice className="mx-4 mb-4" error={emails.error} context="documents" />
          ) : (
            emails.data?.map((e) => (
              <DocumentRow
                key={e.id}
                badge={<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill/20 text-label-2"><Mail className="h-5 w-5" /></span>}
                title={e.subject || '(No subject)'}
                subtitle={fmtDate(e.date)}
                onClick={() => setEmailId(e.id)}
              />
            ))
          )}
        </SectionCard>
      )}

      {confirm.dialog}
      <AttachLinkSheet trip={trip} parent={parent} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <UploadSheet trip={trip} parent={parent} open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {rename && (
        <RenameSheet
          tripId={trip.id}
          doc={{ id: rename.id, title: rename.title, description: rename.description }}
          open
          onClose={() => setRename(null)}
        />
      )}
      {emailId != null && (
        <EmailViewerSheet
          path={`/v2/trip/${trip.id}/${kind}/${itemId}/emails/${emailId}`}
          queryKey={[...qk.itemEmails(trip.id, kind, itemId), emailId]}
          onClose={() => setEmailId(null)}
        />
      )}
    </>
  );
}
