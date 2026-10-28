// CSRF checks, rate limiting and response headers for Worker-generated responses.
import type { Env } from './env';

export function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra },
  });
}

export function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Add nosniff, referrer and CSP headers without touching ones already set. */
export function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** State-changing requests need the custom header and a same-origin Origin. */
export function csrfOk(request: Request): boolean {
  if (request.headers.get('X-Requested-With') !== 'tripsy-web') return false;
  const origin = request.headers.get('Origin');
  return origin !== null && origin === new URL(request.url).origin;
}

export function isStateChanging(request: Request): boolean {
  return request.method !== 'GET' && request.method !== 'HEAD';
}

/** True when the request may proceed. Absent binding means no limiting. */
export async function rateLimitOk(request: Request, env: Env, sid: string | null): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  const key = sid ?? request.headers.get('CF-Connecting-IP') ?? 'anonymous';
  try {
    return (await env.RATE_LIMITER.limit({ key })).success;
  } catch {
    return true;
  }
}
