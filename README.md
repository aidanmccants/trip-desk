# Trip Desk

Trip Desk is a browser editor for [Tripsy](https://tripsy.app) trips, built for desktop screens. You sign in with your Tripsy account and view and edit your trips, itineraries, expenses, documents and settings. It is not affiliated with Tripsy.

A live version is available at [tripdesk.mccants.link](https://tripdesk.mccants.link).

## How it works

Trip Desk is one Cloudflare Worker that does three things:

- Serves the React single-page app from `dist/client` (Workers static assets, with SPA fallback).
- Handles sign-in. It runs OAuth 2.0 Authorization Code with PKCE against `https://my.tripsy.app`. The browser never sees a password; the sign-in button is a plain link to `/auth/login`, which redirects to Tripsy.
- Proxies `/api/*` to `https://api.tripsy.app`. Only routes in the allow-list (`shared/routes.ts`) are forwarded. The Worker adds the access token; the browser never holds it.

Tokens are stored in Workers KV (`SESSIONS` binding) under `session:<sid>`. The browser holds only `sid`, an HttpOnly session cookie. Pending OAuth state is kept under `oauth:<state>` for 10 minutes. The Worker refreshes access tokens before they expire and after a 401.

Tripsy paths in the app are Tripsy's own paths, as documented at `docs.api.tripsy.app`.

## Stack

- Client: React 18, TypeScript (strict), Vite, TanStack Query v5, React Router v6, React Hook Form with Zod, Tailwind CSS v3, lucide-react.
- Worker: Cloudflare Workers with KV and a rate-limit binding, Wrangler 4.
- Tests: Vitest.

## Repository layout

```
worker/              Worker: routing, OAuth, KV sessions, /api proxy, security headers,
                     rate limiting, scripts/register.ts (OAuth client registration)
client/src/          React app. features/<area>/ per screen, components/ (UI kit),
                     lib/ (API client, query hooks, helpers)
client/public/       Static files: favicon.svg and _headers (CSP and other headers)
shared/              Types, writable field lists and the proxy allow-list, used by both sides
design/reference/    Tripsy screenshots that set the visual style
wrangler.toml        Worker config: static assets, KV binding, rate limiter, vars
```

`dist/` is build output and is git-ignored. `.dev.vars` holds local secrets and is git-ignored; never commit it.

## Local development

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create the local env file from the example:

   ```sh
   cp .dev.vars.example .dev.vars
   ```

   On Windows, use `copy .dev.vars.example .dev.vars`.

3. Register the OAuth client with Tripsy:

   ```sh
   npm run register
   ```

   This posts to `https://my.tripsy.app/o/register/` with the redirect URI `http://localhost:8787/auth/callback` and prints a `client_id`. Put that value in `.dev.vars` as `OAUTH_CLIENT_ID`. To include your production callback in the same registration, pass it as an argument or set `PROD_REDIRECT_URI`:

   ```sh
   npm run register -- https://your-domain.example/auth/callback
   ```

   Add `--confidential` only if you want a client secret. If Tripsy returns one, it goes in `.dev.vars` as `OAUTH_CLIENT_SECRET`.

4. Start the dev servers:

   ```sh
   npm run dev
   ```

   This builds the client once (the Worker serves `dist/client`), then runs `wrangler dev` on port 8787 and Vite on port 5173. Vite hot-reloads and proxies `/api`, `/auth` and `/oauth` to the Worker.

   Sign in at `http://localhost:8787`. The OAuth callback is registered for that address, so start sign-in there. Cookies are shared across ports on `localhost`, so you can then use `http://localhost:5173` for live edits. Port 8787 serves the build made when `npm run dev` started, so use 5173 while you are editing.

Other scripts:

- `npm run typecheck` runs `tsc` for the Worker and the client.
- `npm test` runs the Vitest suites in `worker/`, `shared/` and `client/src/`.
- `npm run build` builds the client into `dist/client`.

## Deploying from GitHub

Trip Desk deploys with Cloudflare Workers Builds, from a GitHub repository.

1. Create the session KV namespace once, from a machine where you have run `npx wrangler login`:

   ```sh
   npx wrangler kv namespace create SESSIONS
   ```

   Paste the printed `id` into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`, and commit the change. The namespace id is not a secret.

2. In the Cloudflare dashboard, go to Workers & Pages, select Create, then Import a repository, and choose this repository.

3. Set the build and deploy commands:

   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`

4. Set the production OAuth client id. Choose one:

   - Register with your production callback (`npm run register -- https://<your-domain>/auth/callback`) and set `OAUTH_CLIENT_ID` to the printed id as a Worker variable in the dashboard (Settings → Variables and Secrets). Don't add it under `[vars]` in `wrangler.toml`: an empty `[vars]` value there overrides `.dev.vars` in local dev.
   - Or leave `OAUTH_CLIENT_ID` unset. The Worker then uses `https://<your-domain>/oauth/client-metadata.json` as the client id, and Tripsy fetches that document. This needs the Worker to be served over https, and the redirect URI is derived from the request host (`<origin>/auth/callback`).

5. Only if Tripsy issued a client secret, store it as a secret:

   ```sh
   npx wrangler secret put OAUTH_CLIENT_SECRET
   ```

6. After the first deploy, check that sign-in redirects to `my.tripsy.app`, and that the response headers from `client/public/_headers` are present, for example with `curl -I https://<your-domain>/`.

To deploy from your own machine instead, run `npx wrangler login` once and then `npm run deploy`.

`OAUTH_REDIRECT_URI` in `wrangler.toml` is empty by default, which derives the callback from the request host. Set it only if you need a fixed callback. `.dev.vars` sets it to the localhost callback for development.

The rate-limit binding in `wrangler.toml` uses `namespace_id = "1001"`. Pick another id if it clashes with another Worker on your account.

## Security

- The client never renders or accepts credentials. Sign-in is a redirect to Tripsy's own page. Keep it that way: do not add password or email-and-password inputs.
- OAuth uses PKCE (S256) and a random `state`, checked on the callback.
- Tokens stay in KV. The session cookie is `sid`: HttpOnly, SameSite=Lax, Secure on https, 30 days.
- State-changing requests need both the `X-Requested-With: tripsy-web` header and an `Origin` equal to the Worker's origin. This covers every non-GET request under `/api` and `POST /auth/logout`.
- The `/api` proxy forwards only allow-listed method and path pairs. Path ids must be positive integers, encoded paths are rejected, and JSON bodies are cut down to the writable fields in `shared/fields.ts`.
- Content Security Policy is set in `client/public/_headers`. Worker-generated responses get `default-src 'none'`, `frame-ancestors 'none'`, `nosniff` and a referrer policy.
- Rate limiting uses the `RATE_LIMITER` binding: 120 requests per 60 seconds, keyed by session id, or by client IP before sign-in. If the binding is missing, limiting is skipped.
- Booking-email HTML from Tripsy is untrusted. Render it only in a sandboxed iframe (see `shared/types.ts`).

## Known gaps and open questions

- The built-in `activity_type` and `transportation_type` lists beyond `tour`, `restaurant` and `airplane` are guesses. Tripsy's docs confirm only those three. See `client/src/lib/categories.ts`.
- Custom categories resolve to a generic star icon tinted with the category color (`activityMeta` in `client/src/lib/categories.ts`). The `icon_name` field is saved but not used for display.
- The `cover_gradient` palette is the app's own. Tripsy stores only the index (`client/src/lib/gradients.ts`).
- Photo and document uploads PUT straight from the browser to a presigned S3 URL. The bucket's CORS rules for the app origin are not verified yet.
- Check Tripsy's API terms before opening sign-in to anyone other than the account owner.
- Production runs at `https://tripdesk.mccants.link`, so its callback is `https://tripdesk.mccants.link/auth/callback`. With `OAUTH_CLIENT_ID` unset, Tripsy reads the client-metadata document at `https://tripdesk.mccants.link/oauth/client-metadata.json`. If Tripsy rejects that, run `npm run register -- https://tripdesk.mccants.link/auth/callback` and set the printed id as `OAUTH_CLIENT_ID`.
