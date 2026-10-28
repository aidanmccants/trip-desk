// Fetch wrapper for the Worker's /api proxy. Paths are Tripsy's own paths
// (e.g. `/v2/trips`), so docs.api.tripsy.app applies as written.
import type { Paginated } from '@shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    /** Parsed JSON body (Tripsy validation errors are `{ field: [messages] }`), or text. */
    public body: unknown,
  ) {
    super(describeError(status, body));
  }

  /** Field errors from a Tripsy 400, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (this.status !== 400 || !this.body || typeof this.body !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.body as Record<string, unknown>)) {
      out[k] = Array.isArray(v) ? v.join(' ') : String(v);
    }
    return out;
  }
}

function describeError(status: number, body: unknown): string {
  if (status === 401) return 'Your session has ended. Sign in again.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item doesn't exist anymore.";
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === 'string') return b.detail;
    const first = Object.entries(b)[0];
    if (first) return `${first[0] === 'non_field_errors' ? '' : first[0] + ': '}${[first[1]].flat().join(' ')}`;
  }
  return `Request failed (${status}).`;
}

/** Called on any 401 so the app can drop back to the signed-out screen. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'tripsy-web' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  // Several Tripsy writes succeed with an empty 200/204 body; those resolve to null.
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    if (res.status === 404 && (res.headers.get('content-type') ?? '').includes('text/html')) {
      console.error(`[api] HTML 404 for ${method} ${path}: wrong Tripsy path?`);
    }
    if (res.status === 401) onUnauthorized();
    throw new ApiError(res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T = null>(path: string) => request<T>('DELETE', path),
};

/** Fetches every page of a paginated list, following `next` until it is null. */
export async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: Paginated<T> = await api.get<Paginated<T>>(next);
    out.push(...page.results);
    next = page.next ? toApiPath(page.next) : null;
  }
  return out;
}

/** `https://api.tripsy.app/v2/trips?page=2` → `/v2/trips?page=2`. */
export function toApiPath(next: string): string {
  const u = new URL(next, 'https://api.tripsy.app');
  return u.pathname + u.search;
}

/**
 * Keys of `next` whose value differs from `prev`. Used for PATCH so only changed
 * fields are sent.
 */
export function diff<T extends Record<string, unknown>>(next: T, prev: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    const a = next[key];
    const b = prev[key];
    const same = (a ?? null) === (b ?? null) || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) out[key] = a;
  }
  return out;
}
