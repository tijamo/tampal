# Self-hosting TamFam's Supabase backend

Run the Supabase stack on **your own server** — no egress caps, full control, and
UK data residency (host it in the UK). The TamFam app is unchanged; it just points
at this backend instead of `supabase.com`.

This is a **trimmed** stack derived from Supabase's official self-hosting setup:
Postgres + GoTrue (auth) + PostgREST + Kong (gateway) + Studio (admin UI). Realtime,
Storage, Functions and the pooler are omitted because the app doesn't use them.

## Requirements

- A Linux server with **Docker + Docker Compose**, ~**1–2 GB RAM**, in the UK/EU.
- Two DNS records pointing at it, e.g. `tamfam.example` (app) and
  `api.tamfam.example` (backend API).
- An **SMTP** account for sending magic-link / invite emails.

## 1. Configure

```bash
cd self-hosting
cp .env.example .env

# Generate a JWT secret + API keys and paste them into .env:
node gen-keys.mjs
```

Edit `.env`: set `POSTGRES_PASSWORD`, the generated `JWT_SECRET` / `ANON_KEY` /
`SERVICE_ROLE_KEY`, your `API_EXTERNAL_URL` and `SITE_URL`, and the `SMTP_*` values.

Treat `POSTGRES_PASSWORD` as fixed once you've brought the stack up once — see
[Troubleshooting](#troubleshooting) if you need to change it later.

## 2. Bring the stack up

```bash
docker compose up -d
docker compose ps        # wait until db + auth are healthy
```

## 3. Apply the app schema

The app's tables reference `auth.users` (created by GoTrue at runtime), so apply
them **after** the stack is healthy:

```bash
./migrate.sh
```

This applies every file in `../supabase/migrations/` in order (currently
`0001_init.sql` through `0005_self_service_rls.sql`: schema, RLS, audit
triggers, retention jobs, and — critically for a self-hosted stack —
`0003_grants.sql`'s table-level `GRANT`s, without which every query fails
with "permission denied for table x" before RLS is even consulted, since
Supabase Cloud grants these automatically but a self-hosted stack has no
equivalent bootstrap).

## 4. Put HTTPS in front

For this **non-Coolify** path, Caddy runs on the host and needs to reach Kong on a
host port, so first **uncomment the `ports:` block** under the `kong` service in
`docker-compose.yml` (it's commented out by default because Coolify routes to Kong
internally). Then `docker compose up -d` again, and run the reverse proxy
(`Caddyfile` included) for automatic TLS:

```bash
caddy run --config ./Caddyfile
```

Now `https://api.tamfam.example` fronts Kong (:8000) and `https://tamfam.example`
fronts the Next.js app (:3000). **Studio** is bound to `127.0.0.1:3001` only —
reach it via an SSH tunnel (`ssh -L 3001:localhost:3001 you@server`), never expose it.

## 5. Point the app at your backend

In the app's `.env.local` (repo root):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://api.tamfam.example
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from gen-keys>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from gen-keys>
NEXT_PUBLIC_SITE_URL=https://tamfam.example
```

The app's CSP and service worker already adapt to a custom Supabase domain, so no
code changes are needed. Build and start the app (`npm run build && npm run start`),
or deploy it to any Node host.

## 6. Bootstrap the first admin

Accounts are invite-only. Create your auth user, then promote it:

```bash
# Invite yourself (sends a magic link via SMTP):
curl -X POST "https://api.tamfam.example/auth/v1/invite" \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.org"}'

# After the profile row is auto-created, promote to admin:
docker compose exec -T db psql -U postgres -d postgres -c \
  "update profiles set role='admin' where user_id=(select id from auth.users where email='you@example.org');"
```

(You can also invite users and manage them in **Studio → Authentication**.)

## Smoke test

1. Open `https://tamfam.example` → sign in → receive and click the magic link.
2. Add a person (with consent) under **People**.
3. Create a weekly meeting; confirm the next occurrence shows.
4. Take a register on a phone; turn on airplane mode mid-way and confirm the
   toggles queue, then sync when back online.

## Backups (important for GDPR accountability)

Schedule a nightly logical dump and keep it encrypted and off-box:

```bash
docker compose exec -T db pg_dump -U postgres -d postgres --no-owner \
  | gzip > "tamfam-$(date +%F).sql.gz"
```

## Troubleshooting

- **Changed `POSTGRES_PASSWORD` after the first `docker compose up -d` →
  `auth`/`rest`/`meta` crash-loop on "password authentication failed".**
  `db/init/00-init.sh` (which sets each service role's password from
  `POSTGRES_PASSWORD`) only runs via Postgres's `docker-entrypoint-initdb.d`
  mechanism, i.e. **only against a fresh, empty `db-data` volume**. Editing
  `.env` and re-running `docker compose up -d` against an *existing* volume
  does not update the roles' actual passwords — but `auth`, `rest`, and
  `meta` all pick up the new value from their env vars and try to connect
  with it, so all three start failing. Fix: either `docker compose down -v`
  (wipes `db-data` — only safe before you've applied real data) and start
  over from step 1, or manually `ALTER ROLE ... WITH PASSWORD '...'` each
  service role (`authenticator`, `supabase_auth_admin`, `supabase_admin`) to
  match. The same applies if you rotate `JWT_SECRET`: regenerate
  `ANON_KEY`/`SERVICE_ROLE_KEY` together with it via `gen-keys.mjs` — a
  mismatched secret makes Kong/PostgREST reject every request with 401s.

- **App builds fine but every page fails once deployed.** The app's
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are inlined at
  **build** time (see the `Dockerfile` note on Coolify "Build Variables"),
  but nothing at build time checks they were actually set — `next build`
  succeeds either way. If they're missing, `src/middleware.ts` (which runs
  on every request) throws on its non-null-asserted
  `process.env.NEXT_PUBLIC_SUPABASE_URL!`, taking down the whole app with no
  build-time warning. If a fresh deploy 500s on every route, check that
  these were actually passed as build args/variables, not just runtime env.

## Notes

- **Egress**: none of this is metered by Supabase anymore — you only pay your
  server/bandwidth bill, which for a church app is negligible.
- **Updates**: bump the image tags in `docker-compose.yml` deliberately and test
  in a staging copy; GoTrue/PostgREST run their own migrations on start.
- If you hit a roles/permissions edge case with a newer `supabase/postgres` image,
  cross-check `db/init/00-init.sh` against Supabase's current official
  `docker/volumes/db` scripts — the role model there is the source of truth.
