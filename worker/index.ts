// Trip Desk Worker: OAuth endpoints, authenticated Tripsy proxy, static assets for the rest.
import type { Env } from './env';
import { callback, clientMetadata, login, logout, sessionInfo } from './oauth';
import { handleApi } from './proxy';
import { csrfOk, isStateChanging, json, rateLimitOk, withSecurityHeaders } from './security';
import { readSid } from './session';

export async function handle(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;
  const isAuth = pathname.startsWith('/auth/');
  const isApi = pathname.startsWith('/api/');

  if (pathname === '/oauth/client-metadata.json') {
    return method === 'GET' ? clientMetadata(env, url.origin) : json({ detail: 'Method not allowed' }, 405);
  }
  if (!isAuth && !isApi) return null;

  if (!(await rateLimitOk(request, env, readSid(request)))) {
    return json({ detail: 'Too many requests' }, 429, { 'Retry-After': '60' });
  }

  const stateChanging = isApi ? isStateChanging(request) : pathname === '/auth/logout' && method === 'POST';
  if (stateChanging && !csrfOk(request)) return json({ detail: 'Forbidden' }, 403);

  if (isApi) return pathname === '/api/session' ? sessionInfo(env, request) : handleApi(request, env);

  const routes: Record<string, [string, (e: Env, r: Request) => Promise<Response>]> = {
    '/auth/login': ['GET', login],
    '/auth/callback': ['GET', callback],
    '/auth/logout': ['POST', logout],
  };
  const route = routes[pathname];
  if (!route) return json({ detail: 'Not found' }, 404);
  if (route[0] !== method) return json({ detail: 'Method not allowed' }, 405);
  return route[1](env, request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const res = await handle(request, env);
    return res ? withSecurityHeaders(res) : env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
