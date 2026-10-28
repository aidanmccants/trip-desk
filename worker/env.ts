// Worker bindings (see wrangler.toml).

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  OAUTH_CLIENT_ID?: string;
  OAUTH_CLIENT_SECRET?: string;
  OAUTH_REDIRECT_URI?: string;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  RATE_LIMITER?: RateLimiter;
}

export const TRIPSY_API = 'https://api.tripsy.app';
export const TRIPSY_AUTH = 'https://my.tripsy.app';
export const SCOPE = 'read write profile email';
