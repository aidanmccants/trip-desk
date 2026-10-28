// Allow-list matcher, body stripper and query filter for the proxy. Pure; no I/O.
import { ALLOWED_QUERY_PARAMS, ALLOWED_ROUTES, type AllowedRoute } from '../shared/routes';

const ID = /^[1-9]\d*$/;

/** Match a raw (still-encoded) path like `/v1/trips/12` against the allow-list. */
export function matchRoute(method: string, path: string): AllowedRoute | null {
  // Encoded characters, backslashes and dot segments never appear in legitimate paths.
  if (!path.startsWith('/') || /[%\\]/.test(path)) return null;
  const parts = path.slice(1).split('/');
  if (parts.some((p) => p === '' || p === '.' || p === '..')) return null;

  for (const route of ALLOWED_ROUTES) {
    if (route.method !== method) continue;
    const pattern = route.pattern.slice(1).split('/');
    if (pattern.length !== parts.length) continue;
    const ok = pattern.every((seg, i) => (seg.startsWith(':') ? ID.test(parts[i]) : seg === parts[i]));
    if (ok) return route;
  }
  return null;
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(source: Obj, keys: readonly string[]): Obj {
  const out: Obj = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(source, k)) out[k] = source[k];
  return out;
}

/** Keep only the writable keys for the route. Returns null when the body is not a JSON object. */
export function stripBody(route: AllowedRoute, body: unknown): Obj | null {
  if (!route.fields || !isObject(body)) return null;
  const out = pick(body, route.fields);
  for (const [key, allowed] of Object.entries(route.nested ?? {})) {
    if (isObject(out[key])) out[key] = pick(out[key] as Obj, allowed);
  }
  return out;
}

/** Keep only allow-listed query keys (including `fields!`), preserving repeats. */
export function filterQuery(params: URLSearchParams): URLSearchParams {
  const allowed = new Set<string>(ALLOWED_QUERY_PARAMS);
  const out = new URLSearchParams();
  for (const [k, v] of params) if (allowed.has(k)) out.append(k, v);
  return out;
}
