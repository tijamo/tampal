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
  details and attendance are visible to **administrators only** (and to each
  person for their own records, for Subject Access Requests).
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

### 1. Create the Supabase project

Create a project in the **London (`eu-west-2`)** region, then apply the migrations
in order:

- `supabase/migrations/0001_init.sql` — schema, RLS policies, `is_admin()`, audit triggers
- `supabase/migrations/0002_retention.sql` — retention jobs (needs `pg_cron`)

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

Sign in at `/login` with the magic link. From then on, invite others via
**Authentication → Users** and manage everything in the app.

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
