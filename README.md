# TamFam

A Progressive Web App for **Tamworth Christadelphian Church** to manage members
and visitors, meetings, and attendance — installable on any phone or tablet,
accessible to **WCAG 2.2 AA**, and built for **UK GDPR** compliance.

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
- `supabase/migrations/0006_split_full_name.sql` — split `full_name` into `first_name`/`surname`
- `supabase/migrations/0007_lock_down_maintenance_rpcs.sql` — revoke public execute on the retention RPCs
- `supabase/migrations/0008_families_and_import_fields.sql` — `families` table, family membership, and extra person fields for the CHMeetings import
- `supabase/migrations/0009_directory_family_id.sql` — expose `family_id` on `people_directory` for the directory's family view
- `supabase/migrations/0010_register_taker_role.sql` — adds the `register_taker` role (enum value only)
- `supabase/migrations/0011_register_taker_rls.sql` — narrows attendance access to admin/register_taker, restores self-read
- `supabase/migrations/0012_self_service_erasure.sql` — shared erase_person_data() RPC for admin and self-service GDPR erasure
- `supabase/migrations/0013_directory_consent_types.sql` — adds `directory_phone`/`directory_email`/`directory_address` consent types (enum values only)
- `supabase/migrations/0014_granular_directory_consent.sql` — splits directory sharing into independent phone/email/address consent, exposes address on `people_directory`
- `supabase/migrations/0015_directory_hidden_consent_type.sql` — adds the `directory_hidden` consent type (enum value only, retired by 0017/0018)
- `supabase/migrations/0016_directory_hidden_rls.sql` — excludes anyone with `directory_hidden` granted from `people_directory` entirely (retired by 0017/0018)
- `supabase/migrations/0017_directory_visible_consent_type.sql` — adds `directory_visible` (enum value only), replacing `directory_hidden`'s inverted polarity
- `supabase/migrations/0018_directory_visible_rls.sql` — `people_directory` now keys visibility off `directory_visible` (default true), consistent with phone/email/address's granted-means-shown polarity
- `supabase/migrations/0019_directory_members_only.sql` — visitors are excluded from `people_directory` entirely, regardless of consent

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
| `npm test`          | Jest — unit/a11y tests + RLS integration suite     |

Regenerate the PWA icons with `node scripts/generate-icons.js`.

### RLS integration tests

`__tests__/rls/rls.test.ts` runs the real Postgres RLS policies, grants,
views and SECURITY DEFINER functions from `supabase/migrations/*.sql`
against a throwaway local Postgres cluster (`__tests__/rls/harness.ts`
runs `initdb`/`pg_ctl` directly — no Docker/Supabase CLI needed). It
requires local Postgres server binaries (`initdb`, `pg_ctl`); if none are
found it skips itself with a warning rather than failing `npm test`.

## Accessibility

Semantic landmarks and a skip link, labelled fields with associated errors,
keyboard operability with visible focus, AA colour contrast, reduced-motion
support, and ≥44px touch targets on the register. Automated checks use
`jest-axe` plus an `axe-core` pass over the rendered pages.

A WCAG 2.2 AA gap audit (2026-07-16) covered the six new 2.2 success criteria
(2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size
Minimum, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible
Authentication — all pass or N/A, see `docs/PROJECT_PLAN.md`) and a manual
keyboard pass, which caught and fixed three pre-existing AA gaps: buttons,
inputs and link-buttons had no visible keyboard focus indicator at all
(2.4.7), the focus ring didn't meet 3:1 contrast in dark mode (1.4.11), and
the consent/directory/role toggle switch had no accessible name and an
under-contrast "off" state (4.1.2, 1.4.11). A full manual screen-reader pass
is still recommended before release.

## A note on compliance

This app provides the **tooling** for good data practice; it is not legal advice.
The church should confirm its own ICO position, appoint someone responsible for
data protection, and complete the data-controller details in the privacy notice
(`NEXT_PUBLIC_DATA_CONTROLLER_*`).
