// Two-step uploads: the Worker proxies POST /v1/storage/uploads for a presigned URL,
// then the browser PUTs the bytes straight to S3 with exactly the returned headers
// (never a Tripsy auth header).
import type { ItemKind, UploadTicket } from '@shared/types';
import { api } from './api';

type Purpose =
  | { purpose: 'trip_cover'; tripId?: number }
  | { purpose: 'profile_photo' }
  | { purpose: 'document'; parentType: 'trip' | ItemKind; parentId: number };

export async function uploadFile(file: File, target: Purpose): Promise<UploadTicket> {
  const body: Record<string, unknown> = {
    purpose: target.purpose,
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    content_length: file.size,
  };
  if (target.purpose === 'trip_cover' && target.tripId) {
    body.parent_type = 'trip';
    body.parent_id = target.tripId;
  }
  if (target.purpose === 'document') {
    body.parent_type = target.parentType;
    body.parent_id = target.parentId;
  }
  const ticket = await api.post<UploadTicket>('/v1/storage/uploads', body);
  // Content-Length is set by the browser from the body; it can't be set by script.
  const headers: Record<string, string> = Object.fromEntries(
    Object.entries(ticket.headers ?? {}).filter(([k]) => k.toLowerCase() !== 'content-length'),
  );
  const res = await fetch(ticket.upload_url, { method: ticket.method || 'PUT', headers, body: file });
  if (!res.ok) throw new Error(`Upload to storage failed (${res.status}).`);
  return ticket;
}
