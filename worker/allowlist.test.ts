import { describe, expect, it } from 'vitest';
import { ALLOWED_ROUTES } from '../shared/routes';
import { filterQuery, matchRoute, stripBody } from './allowlist';

describe('matchRoute', () => {
  it('matches every allow-list entry with numeric ids', () => {
    for (const r of ALLOWED_ROUTES) {
      const path = r.pattern.replace(/:\w+/g, '42');
      expect(matchRoute(r.method, path), `${r.method} ${path}`).toBe(r);
    }
  });

  it('rejects the wrong method', () => {
    expect(matchRoute('PUT', '/v1/trips/1')).toBeNull();
    expect(matchRoute('POST', '/v1/trips/1')).toBeNull();
    expect(matchRoute('DELETE', '/v1/me')).toBeNull();
    expect(matchRoute('GET', '/v1/storage/uploads')).toBeNull();
  });

  it.each(['abc', '0', '01', '-1', '1.5', '1e3', ' 1', '1 '])('rejects id %j', (id) => {
    expect(matchRoute('GET', `/v1/trips/${id}`)).toBeNull();
  });

  it('rejects extra, missing and empty segments and trailing slashes', () => {
    expect(matchRoute('GET', '/v1/trips/1/extra')).toBeNull();
    expect(matchRoute('GET', '/v1/trips/')).toBeNull();
    expect(matchRoute('GET', '/v2/trips/')).toBeNull();
    expect(matchRoute('GET', '/v2/trips')).not.toBeNull();
    expect(matchRoute('GET', '//v2/trips')).toBeNull();
    expect(matchRoute('GET', '/v1//trips/1')).toBeNull();
    expect(matchRoute('GET', 'v2/trips')).toBeNull();
  });

  it('rejects traversal and encoded tricks', () => {
    expect(matchRoute('GET', '/v1/trips/1/../2')).toBeNull();
    expect(matchRoute('GET', '/v1/trips/./1')).toBeNull();
    expect(matchRoute('GET', '/v1/trips/%31')).toBeNull();
    expect(matchRoute('GET', '/v1%2ftrips/1')).toBeNull();
    expect(matchRoute('GET', '/v1/trips/1%2F..%2Fme')).toBeNull();
    expect(matchRoute('GET', '/v1\\trips/1')).toBeNull();
  });

  it('does not expose unknown areas', () => {
    expect(matchRoute('GET', '/v1/admin')).toBeNull();
    expect(matchRoute('GET', '/v3/trips')).toBeNull();
  });
});

describe('stripBody', () => {
  const route = (method: string, path: string) => {
    const r = matchRoute(method, path);
    if (!r) throw new Error('no route');
    return r;
  };

  it('drops id, owner and unknown keys', () => {
    const out = stripBody(route('PATCH', '/v1/trips/1'), { id: 9, owner: 3, name: 'Rome', evil: 1 });
    expect(out).toEqual({ name: 'Rome' });
  });

  it('allows update_trip only on PATCH item routes', () => {
    const body = { name: 'x', update_trip: 5 };
    expect(stripBody(route('PATCH', '/v1/trip/1/hosting/2'), body)).toEqual(body);
    expect(stripBody(route('POST', '/v1/trip/1/hostings'), body)).toEqual({ name: 'x' });
    expect(stripBody(route('PATCH', '/v1/trips/1'), body)).toEqual({ name: 'x' });
  });

  it('allows guest_invites only when creating a trip', () => {
    const body = { name: 'x', guest_invites: [1] };
    expect(stripBody(route('POST', '/v1/trips'), body)).toEqual(body);
    expect(stripBody(route('PATCH', '/v1/trips/1'), body)).toEqual({ name: 'x' });
  });

  it('filters nested permissions', () => {
    const out = stripBody(route('POST', '/v1/guests/invite'), {
      trip_id: 1,
      invited_user_email: 'a@b.c',
      is_admin: true,
      permissions: { read_only: true, title: 'Friend', is_owner: true },
    });
    expect(out).toEqual({
      trip_id: 1,
      invited_user_email: 'a@b.c',
      permissions: { read_only: true, title: 'Friend' },
    });
  });

  it('rejects non-object bodies and routes without fields', () => {
    const r = route('PATCH', '/v1/trips/1');
    expect(stripBody(r, [1])).toBeNull();
    expect(stripBody(r, null)).toBeNull();
    expect(stripBody(r, 'x')).toBeNull();
    expect(stripBody(route('DELETE', '/v1/trips/1'), {})).toBeNull();
  });
});

describe('filterQuery', () => {
  it('keeps allow-listed keys, including fields!, and drops the rest', () => {
    const q = filterQuery(new URLSearchParams('page=2&fields!=a,b&access_token=x&deleted=true&fields=c'));
    expect(q.toString()).toBe(new URLSearchParams([['page', '2'], ['fields!', 'a,b'], ['deleted', 'true'], ['fields', 'c']]).toString());
    expect(q.has('access_token')).toBe(false);
  });
});
