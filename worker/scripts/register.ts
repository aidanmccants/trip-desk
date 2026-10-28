// Registers Trip Desk as an OAuth client (RFC 7591). Run once: `npm run register`.
//   npm run register -- https://trips.example.com/auth/callback [--confidential]
// Production redirect URIs also come from PROD_REDIRECT_URI (comma separated).

const args = process.argv.slice(2);
const confidential = args.includes('--confidential');
const prod = [
  ...args.filter((a) => a.startsWith('http')),
  ...(process.env.PROD_REDIRECT_URI ?? '').split(',').map((s) => s.trim()).filter(Boolean),
];

const metadata = {
  client_name: 'Trip Desk',
  redirect_uris: ['http://localhost:8787/auth/callback', ...prod],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: confidential ? 'client_secret_post' : 'none',
  scope: 'read write profile email',
};

const res = await fetch('https://my.tripsy.app/o/register/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify(metadata),
});
const raw = await res.text();
if (!res.ok) {
  console.error(`Registration failed (${res.status}): ${raw}`);
  process.exit(1);
}
const data = JSON.parse(raw) as { client_id?: string; client_secret?: string };

console.log(`client_id:     ${data.client_id}`);
if (data.client_secret) console.log(`client_secret: ${data.client_secret}`);
console.log('\nNext steps:');
console.log(`  1. Put the client_id in .dev.vars (OAUTH_CLIENT_ID=${data.client_id}) and in wrangler.toml [vars].`);
if (data.client_secret) {
  console.log('  2. Local: add OAUTH_CLIENT_SECRET=... to .dev.vars. Production: npx wrangler secret put OAUTH_CLIENT_SECRET');
}
if (prod.length === 0) {
  console.log('  Only the localhost redirect URI was registered; re-run with your production /auth/callback URL.');
}

export {};
