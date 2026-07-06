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

This runs `../supabase/migrations/0001_init.sql` and `0002_retention.sql`
(schema, RLS, audit triggers, retention jobs).

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

## Notes

- **Egress**: none of this is metered by Supabase anymore — you only pay your
  server/bandwidth bill, which for a church app is negligible.
- **Updates**: bump the image tags in `docker-compose.yml` deliberately and test
  in a staging copy; GoTrue/PostgREST run their own migrations on start.
- If you hit a roles/permissions edge case with a newer `supabase/postgres` image,
  cross-check `db/init/00-init.sh` against Supabase's current official
  `docker/volumes/db` scripts — the role model there is the source of truth.
