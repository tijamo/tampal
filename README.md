# TamFam

A Progressive Web App for **Tamworth Christadelphian Church** to manage members
and visitors, meetings, and attendance — installable on any phone or tablet,
accessible to **WCAG 2.1 AA**, and built for **UK GDPR** compliance.

## Why the GDPR design is the way it is

Attendance at a Christadelphian meeting reveals a person's **religious belief**,
which is **special category data** under **Article 9 of the UK GDPR**. The whole
data model is shaped around protecting it:

- **Explicit consent** is captured per person for (a) recording attendance and
  (b) storing contact details, backed by the **Article 9(2)(d)** condition for
  not-for-profit religious bodies. Consent is append-only, so grant/withdrawal
  history is preserved.
- People are only shown in a register **if their attendance consent is currently
  granted**.
- **Row-Level Security** is enabled and default-deny on every table. Contact
  details remain visible to **administrators only** (and to each person for
  their own record, for Subject Access Requests). Attendance is visible to
  **any logged-in user**, since taking a register means seeing who's on it —
  this is a deliberate trade-off documented as such, not an oversight; only
  administrators can delete attendance records.
- Every change to sensitive tables is written to an **audit log** by database
  triggers.
- **Subject rights** are built in: per-person **JSON export** (access &
  portability) and **erasure** (strips PII immediately, anonymises attendance,
  hard-purges after a grace period).
- **Retention**: a daily job strips stale visitor contact details (default 24
  months of inactivity) and purges erased records — see
  `supabase/migrations/0002_retention.sql`.
- **Cookies/PECR**: only strictly-necessary auth cookies are used; no analytics
  or tracking, so **no cookie banner is required**.
- Data is hosted in the **London (`eu-west-2`)** region.

## Tech stack

- **Next.js 14** (App Router, TypeScript, Server Components + Server Actions)
- **Supabase** — Postgres, Auth (magic-link, invite-only), Row-Level Security
- **Tailwind CSS** with AA-contrast tokens; **Radix UI** for accessible dialogs/switches
- **PWA**: web manifest + service worker with an **offline attendance queue**
  (IndexedDB + Background Sync) for halls with poor signal

## Getting started

> **Prefer to self-host?** To avoid egress caps and keep full control of the data,
> run the Supabase stack on your own server — see [`self-hosting/README.md`](./self-hosting/README.md).
> The app is identical either way; only the `NEXT_PUBLIC_SUPABASE_URL` differs.
>
> **All-in-one on a UK server:** to keep every bit of compute and data in the UK
> (no US transfer, no egress caps, ~£7–10/mo), deploy the app *and* Supabase on a
> single UK VPS with Coolify — see [`deploy/coolify.md`](./deploy/coolify.md). A
> production `Dockerfile` (Next.js standalone) is included for any container host.

### 1. Create the Supabase project

Create a project in the **London (`eu-west-2`)** region, then apply the migrations
in order:

- `supabase/migrations/0001_init.sql` — schema, RLS policies, `is_admin()`, audit triggers
- `supabase/migrations/0002_retention.sql` — retention jobs (needs `pg_cron`)
- `supabase/migrations/0003_grants.sql` — table grants (self-hosted only)
- `supabase/migrations/0004_self_service.sql` — invite/person linking
- `supabase/migrations/0005_self_service_rls.sql` — self-service RLS/RPCs

Either run them via the Supabase SQL editor, or with the CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

### 2. Configure environment

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, and the data-controller details.
```

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

### 4. Bootstrap the first administrator

Accounts are **invite-only**. In the Supabase dashboard → **Authentication →
Users**, invite yourself by email (this creates an auth user; a `profiles` row is
created automatically as `member`). Then promote to admin in the SQL editor:

```sql
update profiles set role = 'admin'
where user_id = (select id from auth.users where email = 'you@example.org');
```

Sign in at `/login` with the magic link. From then on, invite other members
as users directly from their person page in the app (**Invite as user**) —
this links their login to their existing member record automatically. The
manual Supabase-dashboard invite above is only needed for this first admin.

## Scripts

| Command             | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the dev server                               |
| `npm run build`     | Production build                                   |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`)                  |
| `npm run lint`      | ESLint (`next lint`)                               |
| `npm test`          | Jest — recurrence unit tests + `jest-axe` a11y     |

Regenerate the PWA icons with `node scripts/generate-icons.js`.

## Accessibility

Semantic landmarks and a skip link, labelled fields with associated errors,
keyboard operability with visible focus, AA colour contrast, reduced-motion
support, and ≥44px touch targets on the register. Automated checks use `jest-axe`;
a manual keyboard/screen-reader pass is recommended before release.

## A note on compliance

This app provides the **tooling** for good data practice; it is not legal advice.
The church should confirm its own ICO position, appoint someone responsible for
data protection, and complete the data-controller details in the privacy notice
(`NEXT_PUBLIC_DATA_CONTROLLER_*`).
