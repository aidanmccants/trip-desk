// Client id / redirect URI resolution shared by the OAuth handlers and token refresh.
import type { Env } from './env';

/** Configured id, else the client-metadata-document URL when served over https. */
export function clientId(env: Env, origin: string): string | null {
  if (env.OAUTH_CLIENT_ID) return env.OAUTH_CLIENT_ID;
  return origin.startsWith('https://') ? `${origin}/oauth/client-metadata.json` : null;
}

export function redirectUri(env: Env, origin: string): string {
  return env.OAUTH_REDIRECT_URI || `${origin}/auth/callback`;
}

/** client_secret_post parameters, when a secret is configured. */
export function clientSecretParams(env: Env): Record<string, string> {
  return env.OAUTH_CLIENT_SECRET ? { client_secret: env.OAUTH_CLIENT_SECRET } : {};
}
