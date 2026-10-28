// OAuth 2.0 authorization-code + PKCE flow against my.tripsy.app, plus session/logout endpoints.
import type { SessionUser } from '../shared/types';
import { SCOPE, TRIPSY_AUTH, type Env } from './env';
import { clientId, clientSecretParams, redirectUri } from './oauth-config';
import { json, text } from './security';
import {
  applyTokens, deleteSession, loadSession, randomHex, readSid, saveSession, sessionCookie,
  type Session,
} from './session';

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const randomB64url = (bytes: number): string => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

const redirect = (location: string, extra: Record<string, string> = {}): Response =>
  new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });

const authError = (code: string): Response => redirect(`/?auth_error=${encodeURIComponent(code)}`);

/** Client-metadata document (Tripsy accepts its URL as client_id). */
export function clientMetadata(env: Env, origin: string): Response {
  const id = clientId(env, origin);
  const body = {
    client_id: id ?? `${origin}/oauth/client-metadata.json`,
    client_name: 'Trip Desk',
    client_uri: origin,
    redirect_uris: [redirectUri(env, origin)],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: SCOPE,
  };
  return json(body, 200, { 'Cache-Control': 'public, max-age=300' });
}

export async function login(env: Env, request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const id = clientId(env, origin);
  if (!id) {
    return text(
      'Trip Desk has no OAuth client id. Over http (local dev) Tripsy cannot fetch a client-metadata document.\n' +
        'Run `npm run register`, then put the printed client_id in .dev.vars (OAUTH_CLIENT_ID=...) or wrangler.toml [vars].',
      500,
    );
  }
  const state = randomB64url(24);
  const verifier = randomB64url(48);
  const redirect_uri = redirectUri(env, origin);
  await env.SESSIONS.put(`oauth:${state}`, JSON.stringify({ verifier, redirectUri: redirect_uri }), {
    expirationTtl: 600,
  });
  const url = new URL(`${TRIPSY_AUTH}/o/authorize/`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: id,
    redirect_uri,
    scope: SCOPE,
    state,
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
  }).toString();
  return redirect(url.toString());
}

async function fetchUser(accessToken: string): Promise<SessionUser | null> {
  const res = await fetch(`${TRIPSY_AUTH}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const u = (await res.json()) as Record<string, unknown>;
  if (u.sub === undefined || u.sub === null) return null;
  const email = typeof u.email === 'string' ? u.email : null;
  return { sub: String(u.sub), name: typeof u.name === 'string' ? u.name : (email ?? ''), email };
}

export async function callback(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  let pending: { verifier: string; redirectUri: string } | null = null;
  if (state) {
    const raw = await env.SESSIONS.get(`oauth:${state}`);
    await env.SESSIONS.delete(`oauth:${state}`);
    try {
      pending = raw ? JSON.parse(raw) : null;
    } catch {
      pending = null;
    }
  }
  if (!pending) return authError('bad_state');
  if (oauthError) return authError(oauthError.replace(/[^a-z_]/gi, '').slice(0, 32).toLowerCase() || 'denied');
  const id = clientId(env, origin);
  if (!code || !id) return authError('bad_request');

  try {
    const tokenRes = await fetch(`${TRIPSY_AUTH}/o/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pending.redirectUri,
        client_id: id,
        code_verifier: pending.verifier,
        ...clientSecretParams(env),
      }),
    });
    if (!tokenRes.ok) return authError('token_exchange');
    const tokens = applyTokens(null, (await tokenRes.json()) as Record<string, unknown>);
    if (!tokens) return authError('token_exchange');
    const user = await fetchUser(tokens.access_token);
    if (!user) return authError('userinfo');

    const sid = randomHex(32);
    const session: Session = { ...tokens, user };
    await saveSession(env, sid, session);
    return redirect('/', { 'Set-Cookie': sessionCookie(sid, origin.startsWith('https://')) });
  } catch {
    return authError('server_error');
  }
}

export async function sessionInfo(env: Env, request: Request): Promise<Response> {
  const sid = readSid(request);
  const session = sid ? await loadSession(env, sid) : null;
  return session ? json({ user: session.user }) : json({ detail: 'Not signed in' }, 401);
}

async function revoke(env: Env, clientIdValue: string, token: string, hint: string): Promise<void> {
  try {
    await fetch(`${TRIPSY_AUTH}/o/revoke_token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        token_type_hint: hint,
        client_id: clientIdValue,
        ...clientSecretParams(env),
      }),
    });
  } catch {
    // best-effort
  }
}

export async function logout(env: Env, request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  const sid = readSid(request);
  const session = sid ? await loadSession(env, sid) : null;
  const id = clientId(env, origin);
  if (session && id) {
    await revoke(env, id, session.access_token, 'access_token');
    if (session.refresh_token) await revoke(env, id, session.refresh_token, 'refresh_token');
  }
  if (sid) await deleteSession(env, sid);
  return new Response(null, {
    status: 204,
    headers: { 'Set-Cookie': sessionCookie('', origin.startsWith('https://'), 0), 'Cache-Control': 'no-store' },
  });
}
