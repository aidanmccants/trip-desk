// /api/* proxy: session lookup, allow-list, body stripping, token refresh and passthrough.
import { filterQuery, matchRoute, stripBody } from './allowlist';
import { TRIPSY_API, type Env } from './env';
import { json } from './security';
import { loadSession, needsRefresh, readSid, refreshSession, type Session } from './session';

const MAX_BODY = 1_000_000;
const NULL_BODY = new Set([101, 204, 205, 304]);

function forward(url: string, method: string, token: string, body: string | null): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (body !== null) headers['Content-Type'] = 'application/json';
  return fetch(url, { method, headers, body: body ?? undefined });
}

/** Status and body from Tripsy; only content-type is kept. */
function passthrough(res: Response): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const type = res.headers.get('Content-Type');
  if (type) headers.set('Content-Type', type);
  return new Response(NULL_BODY.has(res.status) ? null : res.body, { status: res.status, headers });
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sid = readSid(request);
  let session: Session | null = sid ? await loadSession(env, sid) : null;
  if (!sid || !session) return json({ detail: 'Not signed in' }, 401);

  const path = url.pathname.slice('/api'.length);
  const route = matchRoute(request.method, path);
  if (!route) return json({ detail: 'Not allowed' }, 404);

  let body: string | null = null;
  if (route.fields) {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ detail: 'Body too large' }, 413);
    let parsed: unknown = {};
    if (raw.trim() !== '') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return json({ detail: 'Invalid JSON' }, 400);
      }
    }
    const stripped = stripBody(route, parsed);
    if (!stripped) return json({ detail: 'Body must be a JSON object' }, 400);
    body = JSON.stringify(stripped);
  }

  const query = filterQuery(url.searchParams).toString();
  const target = `${TRIPSY_API}${path}${query ? `?${query}` : ''}`;

  if (needsRefresh(session)) {
    session = await refreshSession(env, url.origin, sid, session);
    if (!session) return json({ detail: 'Not signed in' }, 401);
  }

  try {
    let res = await forward(target, request.method, session.access_token, body);
    if (res.status === 401) {
      const fresh = await refreshSession(env, url.origin, sid, session);
      if (!fresh) return json({ detail: 'Not signed in' }, 401);
      res = await forward(target, request.method, fresh.access_token, body);
    }
    return passthrough(res);
  } catch {
    return json({ detail: 'Tripsy is unreachable' }, 502);
  }
}
