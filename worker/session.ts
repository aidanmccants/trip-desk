// Server-side sessions in KV, cookie helpers, and token refresh.
import type { SessionUser } from '../shared/types';
import { TRIPSY_AUTH, type Env } from './env';
import { clientId, clientSecretParams } from './oauth-config';

export interface Session {
  access_token: string;
  refresh_token: string | null;
  /** ms epoch */
  expires_at: number;
  user: SessionUser;
}

export const COOKIE = 'sid';
export const SESSION_TTL = 30 * 24 * 3600;
const REFRESH_SKEW_MS = 60_000;

export function readSid(request: Request): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) {
      const v = rest.join('=');
      return /^[0-9a-f]{64}$/.test(v) ? v : null;
    }
  }
  return null;
}

export function sessionCookie(sid: string, secure: boolean, maxAge = SESSION_TTL): string {
  return `${COOKIE}=${sid}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function randomHex(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loadSession(env: Env, sid: string): Promise<Session | null> {
  const raw = await env.SESSIONS.get(`session:${sid}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(env: Env, sid: string, session: Session): Promise<void> {
  return env.SESSIONS.put(`session:${sid}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
}

export function deleteSession(env: Env, sid: string): Promise<void> {
  return env.SESSIONS.delete(`session:${sid}`);
}

type Tokens = Pick<Session, 'access_token' | 'refresh_token' | 'expires_at'>;

/** Turn a Tripsy token response into session tokens; keeps the old refresh token if none is sent. */
export function applyTokens(prev: Session | null, data: Record<string, unknown>): Tokens | null {
  if (typeof data.access_token !== 'string' || !data.access_token) return null;
  const expiresIn = typeof data.expires_in === 'number' && data.expires_in > 0 ? data.expires_in : 3600;
  return {
    access_token: data.access_token,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : (prev?.refresh_token ?? null),
    expires_at: Date.now() + expiresIn * 1000,
  };
}

export const needsRefresh = (s: Session): boolean => s.expires_at - Date.now() < REFRESH_SKEW_MS;

/**
 * Refresh the session's tokens. On failure another request may already have rotated them, so
 * re-read KV and use that copy if its access token changed; otherwise drop the session.
 */
export async function refreshSession(env: Env, origin: string, sid: string, session: Session): Promise<Session | null> {
  if (session.refresh_token) {
    try {
      const res = await fetch(`${TRIPSY_AUTH}/o/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: session.refresh_token,
          client_id: clientId(env, origin) ?? '',
          ...clientSecretParams(env),
        }),
      });
      if (res.ok) {
        const tokens = applyTokens(session, (await res.json()) as Record<string, unknown>);
        if (tokens) {
          const next = { ...session, ...tokens };
          await saveSession(env, sid, next);
          return next;
        }
      }
    } catch {
      // fall through to the KV re-read
    }
  }
  const latest = await loadSession(env, sid);
  if (latest && latest.access_token !== session.access_token) return latest;
  await deleteSession(env, sid);
  return null;
}
