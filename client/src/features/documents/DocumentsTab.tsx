import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Link as LinkIcon, Mail, Search, Upload, type LucideIcon } from 'lucide-react';
import type { AnyItem, EmailSummary, ItemKind, ParentRef, Trip, TripDocument } from '@shared/types';
import { refId } from '@shared/types';
import { api, ApiError, fetchAll } from '../../lib/api';
import { itemMeta } from '../../lib/categories';
import { qk, useCategories, useItinerary, useMyPermissions } from '../../lib/queries';
import {
  Button, CategoryBadge, EmptyState, ErrorNotice, ListSkeleton, Segmented, cx, useConfirm,
} from '../../components/ui';
import { AttachLinkSheet } from './AttachLinkSheet';
import { DocumentRow, RowMenu } from './DocumentRow';
import { EmailViewerSheet } from './EmailViewerSheet';
import { MoveDocumentSheet } from './MoveDocumentSheet';
import { RenameSheet } from './RenameSheet';
import { UploadSheet } from './UploadSheet';
import { DOC_ICON, deletePath, docKind, fmtDate, invalidateDocuments, parentOf, useOpenDocument, type Parent } from './docs';

type Filter = 'all' | 'image' | 'file' | 'link' | 'email';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'file', label: 'Files' },
  { value: 'link', label: 'Links' },
  { value: 'email', label: 'Emails' },
];

interface Entry {
  key: string;
  type: 'doc' | 'email';
  title: string;
  subtitle: string;
  date: string;
  filter: Filter;
  icon: LucideIcon;
  /** Item the entry is attached to, if any. */
  item?: { kind: ItemKind; name: string; item: AnyItem };
  thumb?: string | null;
  doc?: TripDocument;
  email?: EmailSummary;
}

const noRetry403 = (n: number, e: unknown) => !(e instanceof ApiError && e.status === 403) && n < 2;

function Badge({ entry, categories }: { entry: Entry; categories: ReturnType<typeof useCategories>['data'] }) {
  const Overlay = entry.icon;
  const base = entry.item ? (
    (() => {
      const meta = itemMeta(entry.item.kind, entry.item.item, categories ?? []);
      return <CategoryBadge icon={meta.icon} color={meta.color} />;
    })()
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill/20 text-label-2">
      <Overlay className="h-5 w-5" />
    </span>
  );
  return (
    <span className="relative shrink-0">
      {base}
      {entry.item && (
        <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-white ring-2 ring-card">
          <Overlay className="h-2.5 w-2.5" />
        </span>
      )}
    </span>
  );
}

export function DocumentsTab({ trip }: { trip: Trip }) {
  const qc = useQueryClient();
  const perms = useMyPermissions(trip.id);
  const categories = useCategories();
  const itinerary = useItinerary(trip.id);
  const confirm = useConfirm('Delete this document?', 'It will be removed from this trip.');
  const opener = useOpenDocument();

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [emailId, setEmailId] = useState<number | null>(null);
  const [rename, setRename] = useState<TripDocument | null>(null);
  const [move, setMove] = useState<TripDocument | null>(null);
  const [deleteError, setDeleteError] = useState<unknown>(null);

  const docs = useQuery({
    queryKey: qk.documents(trip.id),
    queryFn: () => fetchAll<TripDocument>(`/v2/trip/${trip.id}/documents`),
    enabled: perms.canSeeDocuments,
    retry: noRetry403,
  });
  const emails = useQuery({
    queryKey: qk.emails(trip.id),
    queryFn: () => fetchAll<EmailSummary>(`/v2/trip/${trip.id}/emails`),
    enabled: perms.canSeeDocuments,
    retry: noRetry403,
  });

  const items = useMemo(() => {
    const m = new Map<string, { kind: ItemKind; name: string; item: AnyItem }>();
    for (const i of itinerary.hostings) m.set(`hosting:${i.id}`, { kind: 'hosting', name: i.name, item: i });
    for (const i of itinerary.activities) m.set(`activity:${i.id}`, { kind: 'activity', name: i.name, item: i });
    for (const i of itinerary.transportations) m.set(`transportation:${i.id}`, { kind: 'transportation', name: i.name, item: i });
    return m;
  }, [itinerary.hostings, itinerary.activities, itinerary.transportations]);

  const entries = useMemo<Entry[]>(() => {
    const firstItem = (h?: ParentRef[], a?: ParentRef[], t?: ParentRef[]) =>
      (h?.length ? items.get(`hosting:${refId(h[0])}`) : undefined) ??
      (a?.length ? items.get(`activity:${refId(a[0])}`) : undefined) ??
      (t?.length ? items.get(`transportation:${refId(t[0])}`) : undefined);
    const out: Entry[] = [];
    for (const d of docs.data ?? []) {
      const kind = docKind(d.file_type);
      const item = firstItem(d.hostings, d.activities, d.transportations);
      out.push({
        key: `d${d.id}`, type: 'doc', title: d.title, doc: d, filter: kind, icon: DOC_ICON[kind], item,
        subtitle: item?.name ?? fmtDate(d.created_at), date: d.created_at,
        thumb: kind === 'image' ? d.temp_read_url : null,
      });
    }
    for (const e of emails.data ?? []) {
      const item = firstItem(e.hostings, e.activities, e.transportations);
      out.push({
        key: `e${e.id}`, type: 'email', title: e.subject || '(No subject)', email: e, filter: 'email', icon: Mail, item,
        subtitle: item?.name ?? e.body_preview ?? fmtDate(e.date), date: e.date,
      });
    }
    return out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  }, [docs.data, emails.data, items]);

  const q = search.trim().toLowerCase();
  const shown = entries.filter(
    (e) => (filter === 'all' || e.filter === filter) && (!q || e.title.toLowerCase().includes(q) || e.subtitle.toLowerCase().includes(q)),
  );

  if (!perms.canSeeDocuments) {
    return <EmptyState icon={FolderOpen} title="Documents are private" message="You don't have permission to see this trip's documents." />;
  }

  const showDocsError = !!docs.error && filter !== 'email';
  const showEmailsError = !!emails.error && (filter === 'email' || (filter === 'all' && !docs.error));
  const loading = (docs.isLoading || emails.isLoading) && !entries.length;
  const bothFailed = !!docs.error && !!emails.error;

  const del = (d: TripDocument) =>
    confirm.ask(async () => {
      setDeleteError(null);
      try {
        await api.del(deletePath(trip.id, parentOf(d, trip.id), d.id));
        await invalidateDocuments(qc, trip.id);
      } catch (e) {
        setDeleteError(e);
        throw e;
      }
    });

  const onRow = (e: Entry) => {
    if (e.type === 'email' && e.email) setEmailId(e.email.id);
    else if (e.doc) void opener.open(e.doc.id);
  };

  let emptyNode: ReactNode = null;
  if (!loading && !shown.length && !bothFailed) {
    emptyNode = q || filter !== 'all' ? (
      <EmptyState icon={Search} title="No matches" message="Try a different search or filter." />
    ) : (
      <EmptyState
        icon={FolderOpen}
        title="No documents yet"
        message="Keep reservations, tickets and links for this trip in one place."
        action={perms.canEditDocuments && (
          <div className="flex gap-2">
            <Button icon={LinkIcon} onClick={() => setLinkOpen(true)}>Add link</Button>
            <Button variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>Upload file</Button>
          </div>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a document"
            aria-label="Search a document"
            className="input pl-9"
          />
        </div>
        {perms.canEditDocuments && (
          <>
            <Button icon={LinkIcon} onClick={() => setLinkOpen(true)}>Add link</Button>
            <Button variant="primary" icon={Upload} onClick={() => setUploadOpen(true)}>Upload file</Button>
          </>
        )}
      </div>
      <Segmented value={filter} onChange={setFilter} options={FILTERS} />

      {showDocsError && <ErrorNotice error={docs.error} context="documents" />}
      {showEmailsError && <ErrorNotice error={emails.error} context="documents" />}
      {opener.error != null && <ErrorNotice error={opener.error} context="documents" />}
      {deleteError != null && <ErrorNotice error={deleteError} context="documents" />}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : shown.length ? (
        <div className={cx('card')}>
          {shown.map((e) => (
            <DocumentRow
              key={e.key}
              badge={<Badge entry={e} categories={categories.data} />}
              title={e.title}
              subtitle={e.subtitle}
              thumbUrl={e.thumb}
              busy={e.doc ? opener.busyId === e.doc.id : false}
              onClick={() => onRow(e)}
              menu={
                perms.canEditDocuments && e.doc ? (
                  <RowMenu
                    items={[
                      { label: 'Rename', icon: 'rename', onSelect: () => setRename(e.doc!) },
                      { label: 'Move', icon: 'move', onSelect: () => setMove(e.doc!) },
                      { label: 'Delete', icon: 'delete', onSelect: () => del(e.doc!) },
                    ]}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
      ) : (
        emptyNode
      )}

      {confirm.dialog}
      <AttachLinkSheet trip={trip} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <UploadSheet trip={trip} open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {rename && (
        <RenameSheet tripId={trip.id} doc={{ id: rename.id, title: rename.title }} open onClose={() => setRename(null)} />
      )}
      {move && (
        <MoveDocumentSheet
          tripId={trip.id}
          doc={{ id: move.id, title: move.title }}
          current={parentOf(move, trip.id) as Parent}
          open
          onClose={() => setMove(null)}
        />
      )}
      {emailId != null && (
        <EmailViewerSheet
          path={`/v2/trip/${trip.id}/emails/${emailId}`}
          queryKey={[...qk.emails(trip.id), emailId]}
          onClose={() => setEmailId(null)}
        />
      )}
    </div>
  );
}
