import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import worker from './index';
import type { Session } from './session';

const SID = 'a'.repeat(64);
const ORIGIN = 'https://trips.example.com';

function fakeKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  };
}

const session = (over: Partial<Session> = {}): Session => ({
  access_token: 'old',
  refresh_token: 'r1',
  expires_at: Date.now() + 3_600_000,
  user: { sub: '1', name: 'A', email: null },
  ...over,
});

let kv: ReturnType<typeof fakeKv>;
let env: Env;
let fetchMock: ReturnType<typeof vi.fn>;
const assets = vi.fn(async () => new Response('asset'));

beforeEach(() => {
  kv = fakeKv();
  env = { SESSIONS: kv as unknown as KVNamespace, ASSETS: { fetch: assets } as unknown as Fetcher, OAUTH_CLIENT_ID: 'cid' };
  kv.store.set(`session:${SID}`, JSON.stringify(session()));
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const api = (path: string, init: RequestInit = {}, cookie = `sid=${SID}`) =>
  worker.fetch(
    new Request(`${ORIGIN}/api${path}`, {
      ...init,
      headers: { Cookie: cookie, 'X-Requested-With': 'tripsy-web', Origin: ORIGIN, ...(init.headers as object) },
    }),
    env,
  );

const tokenResponse = (access: string) =>
  new Response(JSON.stringify({ access_token: access, refresh_token: 'r2', expires_in: 3600 }), { status: 200 });

describe('proxy', () => {
  it('requires a session', async () => {
    const res = await api('/v1/me', {}, '');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: 'Not signed in' });
  });

  it('returns 404 for non-allowed paths without calling Tripsy', async () => {
    const res = await api('/v1/trips/abc');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: 'Not allowed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only Authorization/Accept/Content-Type, strips body and filters query', async () => {
    fetchMock.mockResolvedValue(new Response('{"id":1}', { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'x=1' } }));
    const res = await api('/v1/trips/1?page=2&evil=1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Rome', owner: 7 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tripsy.app/v1/trips/1?page=2');
    expect(init.headers).toEqual({ Authorization: 'Bearer old', Accept: 'application/json', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"name":"Rome"}');
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ id: 1 });
  });

  it('passes an empty 204 through with a null body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const res = await api('/v1/trips/1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('passes an empty 200 through', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
    const res = await api('/v1/me');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('sends {} for an empty POST body and 400 for non-object JSON', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 201 }));
    await api('/v1/trips', { method: 'POST' });
    expect(fetchMock.mock.calls[0][1].body).toBe('{}');
    const bad = await api('/v1/trips', { method: 'POST', body: '[1]' });
    expect(bad.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes on 401 and retries once', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(tokenResponse('new'))
      .mockResolvedValueOnce(new Response('{"ok":1}', { status: 200 }));
    const res = await api('/v1/me');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('https://my.tripsy.app/o/token/');
    expect(String(fetchMock.mock.calls[1][1].body)).toContain('grant_type=refresh_token');
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
    expect(JSON.parse(kv.store.get(`session:${SID}`)!).access_token).toBe('new');
  });

  it('does not retry twice when the retry is also 401', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(tokenResponse('new'))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const res = await api('/v1/me');
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('deletes the session when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const res = await api('/v1/me');
    expect(res.status).toBe(401);
    expect(kv.store.has(`session:${SID}`)).toBe(false);
  });

  it('uses a token rotated by a concurrent request when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockImplementationOnce(async () => {
        kv.store.set(`session:${SID}`, JSON.stringify(session({ access_token: 'rotated' })));
        return new Response('{}', { status: 400 });
      })
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const res = await api('/v1/me');
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer rotated');
    expect(kv.store.has(`session:${SID}`)).toBe(true);
  });

  it('refreshes before forwarding when the token is about to expire', async () => {
    kv.store.set(`session:${SID}`, JSON.stringify(session({ expires_at: Date.now() + 10_000 })));
    fetchMock.mockResolvedValueOnce(tokenResponse('fresh')).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await api('/v1/me');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });
});

describe('security', () => {
  it('rejects state-changing requests without the header or a matching Origin', async () => {
    const noHeader = await api('/v1/trips/1', { method: 'DELETE', headers: { 'X-Requested-With': '' } });
    const badOrigin = await api('/v1/trips/1', { method: 'DELETE', headers: { Origin: 'https://evil.example' } });
    expect(noHeader.status).toBe(403);
    expect(badOrigin.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits with 429 and works without a binding', async () => {
    env.RATE_LIMITER = { limit: async () => ({ success: false }) };
    expect((await api('/v1/me')).status).toBe(429);
  });

  it('GET /api/session returns the user, and logout clears the cookie', async () => {
    const res = await api('/session');
    expect(await res.json()).toEqual({ user: { sub: '1', name: 'A', email: null } });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const out = await worker.fetch(
      new Request(`${ORIGIN}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `sid=${SID}`, 'X-Requested-With': 'tripsy-web', Origin: ORIGIN },
      }),
      env,
    );
    expect(out.status).toBe(204);
    expect(out.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(kv.store.has(`session:${SID}`)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('login redirects with PKCE and stores state; metadata uses the https origin', async () => {
    env.OAUTH_CLIENT_ID = '';
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/login`), env);
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get('Location')!);
    expect(loc.origin + loc.pathname).toBe('https://my.tripsy.app/o/authorize/');
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    expect(loc.searchParams.get('client_id')).toBe(`${ORIGIN}/oauth/client-metadata.json`);
    expect(kv.store.has(`oauth:${loc.searchParams.get('state')}`)).toBe(true);
    const meta = await (await worker.fetch(new Request(`${ORIGIN}/oauth/client-metadata.json`), env)).json();
    expect(meta).toMatchObject({ client_name: 'Trip Desk', redirect_uris: [`${ORIGIN}/auth/callback`] });
  });

  it('login explains registration on http with no client id', async () => {
    env.OAUTH_CLIENT_ID = '';
    const res = await worker.fetch(new Request('http://localhost:8787/auth/login'), env);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('npm run register');
  });

  it('callback exchanges the code and creates a session', async () => {
    kv.store.set('oauth:st', JSON.stringify({ verifier: 'v', redirectUri: `${ORIGIN}/auth/callback` }));
    fetchMock
      .mockResolvedValueOnce(tokenResponse('tok'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: 5, name: 'Ann', email: 'a@b.c' }), { status: 200 }));
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=c&state=st`), env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    expect(res.headers.get('Set-Cookie')).toMatch(/^sid=[0-9a-f]{64}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=2592000/);
    expect(kv.store.has('oauth:st')).toBe(false);
    expect(String(fetchMock.mock.calls[0][1].body)).toContain('code_verifier=v');
  });

  it('callback with bad state redirects with an error', async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/auth/callback?code=c&state=nope`), env);
    expect(res.headers.get('Location')).toBe('/?auth_error=bad_state');
  });
});
