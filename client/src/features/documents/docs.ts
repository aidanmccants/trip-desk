// Shared helpers for documents: parent resolution, exact Tripsy routes, kinds and icons.
import { useCallback, useState } from 'react';
import { FileText, Image as ImageIcon, Link as LinkIcon, type LucideIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { QueryClient } from '@tanstack/react-query';
import type { DocumentDownload, DocumentMeta, ItemKind, TripDocument } from '@shared/types';
import { refId } from '@shared/types';
import { api } from '../../lib/api';
import { qk } from '../../lib/queries';

/** Where a document lives: the trip itself or one itinerary item. */
export interface Parent {
  kind: 'trip' | ItemKind;
  id: number;
}

export type DocKind = 'link' | 'image' | 'file';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Direct parent of a trip-aggregate document (empty arrays mean the trip itself). */
export function parentOf(doc: TripDocument, tripId?: number): Parent {
  if (doc.hostings?.length) return { kind: 'hosting', id: refId(doc.hostings[0]) };
  if (doc.activities?.length) return { kind: 'activity', id: refId(doc.activities[0]) };
  if (doc.transportations?.length) return { kind: 'transportation', id: refId(doc.transportations[0]) };
  return { kind: 'trip', id: tripId ?? 0 };
}

/** Parent-scoped collection path (attach POST, delete base). */
function parentBase(tripId: number, parent: Parent): string {
  return parent.kind === 'trip'
    ? `/v1/trip/${tripId}/documents`
    : `/v1/trip/${tripId}/${parent.kind}/${parent.id}/documents`;
}

export const attachPath = (tripId: number, parent: Parent) => parentBase(tripId, parent);
export const deletePath = (tripId: number, parent: Parent, docId: number) => `${parentBase(tripId, parent)}/${docId}`;

/** v2 read path of one parent's documents / emails. */
export const itemDocumentsPath = (tripId: number, kind: ItemKind, itemId: number) => `/v2/trip/${tripId}/${kind}/${itemId}/documents`;
export const itemEmailsPath = (tripId: number, kind: ItemKind, itemId: number) => `/v2/trip/${tripId}/${kind}/${itemId}/emails`;

export function docKind(fileType: string | null | undefined): DocKind {
  if (fileType === 'url') return 'link';
  if (fileType?.startsWith('image/')) return 'image';
  return 'file';
}

export const DOC_ICON: Record<DocKind, LucideIcon> = { link: LinkIcon, image: ImageIcon, file: FileText };
export const DOC_LABEL: Record<DocKind, string> = { link: 'Link', image: 'Image', file: 'File' };

/** "MMM d, yyyy" from an ISO timestamp; empty string when unparseable. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/** Only http(s) URLs are ever used as an image src or opened. */
export const isHttpUrl = (u: string | null | undefined): u is string => !!u && /^https?:\/\//i.test(u);

export const parentKey = (p: Parent) => `${p.kind}:${p.id}`;

/** Body for PATCH /v1/documents/{id} or /v1/automation/emails/{id}: exactly one destination. */
export function destinationBody(parent: Parent): Record<string, number> {
  switch (parent.kind) {
    case 'trip': return { trip_id: parent.id };
    case 'activity': return { activity_id: parent.id };
    case 'hosting': return { hosting_id: parent.id };
    default: return { transportation_id: parent.id };
  }
}

/** After any document write: the trip prefix covers the aggregate list and every item list. */
export function invalidateDocuments(qc: QueryClient, tripId: number) {
  return qc.invalidateQueries({ queryKey: qk.documents(tripId) });
}

export function attachDocument(tripId: number, parent: Parent, body: Record<string, unknown>) {
  return api.post<DocumentMeta>(attachPath(tripId, parent), body);
}

/**
 * Open a document through the download endpoint on every click (signed URLs are never
 * cached). Only http(s) targets are opened.
 */
export function useOpenDocument() {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const open = useCallback(async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      const d = await api.get<DocumentDownload>(`/v1/documents/${id}/get`);
      if (!isHttpUrl(d.download_url)) throw new Error('This document has no safe address to open.');
      window.open(d.download_url, '_blank', 'noopener');
    } catch (e) {
      setError(e);
    } finally {
      setBusyId(null);
    }
  }, []);
  return { open, busyId, error, clearError: () => setError(null) };
}
