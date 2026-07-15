# TamFam Project Plan — Context, Gap Analysis & Roadmap

_Last updated: 2026-07-15. Update this document as phases land or requirements change._

## Purpose

TamFam is a Progressive Web App for Tamworth Christadelphian Church (TamFam)
to store member/visitor data (addresses, phone numbers, emails, etc.) and use
it to take attendance registers at configurable, repeatable meetings. Members
start as pure data; sending an invite to a member's email turns them into a
user who can log in, view the member list, take attendance registers, and
edit their own personal information. Only admin users can edit meeting
details and all member information. The site must be fully UK GDPR, DPA 2018
and Data (Use and Access) Act 2025 compliant, and WCAG 2.2 AA accessible.

## What already exists (verified in code)

- **People (members/visitors) CRUD** — `src/app/(app)/people/*`, admin-only.
- **Meetings** — create + archive, recurring (`none/weekly/monthly/annually`)
  via `src/lib/recurrence.ts`; no edit-existing-meeting page yet.
- **Attendance register** — `src/app/(app)/register/[meetingId]/[date]/`,
  admin-only today, with offline queue/sync (IndexedDB + Background Sync).
- **Auth** — Supabase magic-link, invite-only sign-up (`shouldCreateUser:
  false`), `profiles(user_id, person_id, role)` with `is_admin()` SQL helper
  driving RLS; `requireSession()`/`requireAdmin()` in `src/lib/auth.ts`.
- **GDPR machinery** — `consents` table (append-only), `audit_log` (trigger-
  populated), `/api/people/[id]/export` (Subject Access Request JSON export),
  `erasePerson` action (soft delete + anonymise attendance + 30-day hard
  purge via `0002_retention.sql`), `/privacy` notice page, London
  (`eu-west-2`) hosting, PECR note (no analytics/cookies).
- **Accessibility** — skip link, labelled fields, AA contrast tokens, ≥44px
  touch targets, `jest-axe` component tests.
- **Missing entirely**: in-app invite flow (today: manual Supabase Studio
  invite + manual SQL to promote to admin), self-service profile
  view/edit, non-admin directory access, non-admin register-taking, meeting
  edit page, in-app admin promotion, DUA 2025-specific privacy text.

## Product decisions on file

1. **Member directory**: extend `people_directory` to show phone/email, but
   **only** for people who have opted in to a directory-visibility consent —
   everyone else still shows name-only. Requires a new `consent_type` value
   (e.g. `directory_listing`) and a directory view keyed off it.
2. **Register-taking scope**: any authenticated (invited) user can take the
   register for any meeting/date — no restriction to "upcoming only."
3. **Admin promotion**: add an in-app admin-only control to grant/revoke the
   `admin` role on another user, replacing the manual-SQL bootstrap step for
   everyone after the first admin.

## Roadmap

### Phase 1 — Core requirements from the product brief
1. **In-app invite-to-user flow**
   - New admin action on a `people` record: "Invite as user" → calls
     `createAdminClient().auth.admin.inviteUserByEmail(email, { data: {
     person_id } })` (`src/lib/supabase/admin.ts` already exists for this,
     currently unused).
   - Update `handle_new_user()` trigger (new migration) to read
     `new.raw_user_meta_data->>'person_id'` so the auto-created `profiles`
     row links to the right `people.id` instead of `null`.
   - Guard against re-inviting/double-inviting the same person; surface
     invite state on the person detail page.
2. **Self-service profile editing**
   - New route (e.g. `/profile`) using `requireSession()` (not
     `requireAdmin()`) that loads the caller's own `people` row via
     `profiles.person_id` and lets them edit contact fields.
   - New RLS policy `people_update_own` restricted to safe self-editable
     columns (contact/address only — not `person_type`, `notes`,
     `deleted_at`) — likely via a `security definer` RPC or a `check`
     constraint approach rather than a blanket self-`UPDATE` grant, since
     Postgres RLS can't easily restrict *which columns* an UPDATE touches.
3. **Directory with opt-in contact visibility**
   - New `consent_type = 'directory_listing'` value + migration.
   - Replace/extend `people_directory` view: name+type for everyone;
     phone/email included only where a live `directory_listing` consent is
     granted.
   - New non-admin-visible nav entry + page (e.g. `/directory`), distinct
     from the existing admin-only `/people` management screens.
4. **Open up register-taking to all authenticated users**
   - Change `register/[meetingId]/[date]/page.tsx` (and its server action)
     from `requireAdmin()` to `requireSession()`.
   - New RLS policy on `attendance` allowing any authenticated user to
     insert/update rows (keep delete admin-only), setting `recorded_by =
     auth.uid()`.
   - Nav: make sure the register link itself doesn't assume admin.
5. **In-app admin promotion**
   - Admin-only control (e.g. on a person/profile page once linked to a
     user) to toggle `profiles.role` between `member`/`admin`, using the
     existing `profiles_admin_write` RLS policy (already permits this —
     just needs UI + a server action).
6. **Meeting edit page**
   - Add `meetings/[id]/edit` + action, reusing `components/meeting-form.tsx`
     (currently create-only) and the existing `meetings_admin_write` policy.

### Phase 2 — Compliance formalisation
7. **UK GDPR / DPA 2018 / Data (Use and Access) Act 2025 review**
   - Update `/privacy` page copy to reference the Data (Use and Access) Act
     2025 alongside UK GDPR/DPA 2018.
   - Add a clear complaints-handling section/contact (DUA 2025 places a duty
     on controllers to facilitate data-subject complaints) — likely just a
     documented process + email, not new code.
   - Confirm no automated decision-making or bulk direct-marketing exists
     (currently true) so the DUA's ADM/soft-opt-in provisions stay out of
     scope; revisit if e-mail newsletters are ever added.
   - This is policy/documentation work primarily — final sign-off on legal
     wording is a church-trustee decision, not something the codebase can
     certify (README already disclaims "not legal advice").
8. **WCAG 2.2 AA gap audit**
   - Check new 2.2 success criteria against current UI: 2.4.11 Focus Not
     Obscured, 2.5.7 Dragging Movements (N/A — no drag interactions),
     2.5.8 Target Size Minimum (already ≥44px, likely passes), 3.2.6
     Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible
     Authentication (magic-link already satisfies this well).
   - Do a manual keyboard/screen-reader pass (README already flags this as
     outstanding) and record results.
   - Update README's "WCAG 2.1 AA" claim to "2.2 AA" once verified.

### Phase 3 — Housekeeping (lower priority, do opportunistically)
9. Expand test coverage: RLS-backed CRUD flows, invite flow, consent logic,
   offline queue/sync — currently only `recurrence.test.ts` and
   `a11y.test.tsx` exist.
10. Regenerate `src/lib/supabase/types.ts` via `supabase gen types
    typescript` instead of hand-maintaining it.
11. Revisit self-hosted Supabase/Coolify deploy path hardening given the
    history of Kong/auth/schema-permission fix commits.

## Files most relevant to Phase 1

- `src/lib/supabase/admin.ts`, `src/lib/auth.ts` — invite/session plumbing.
- `supabase/migrations/0001_init.sql` — schema/RLS being extended (via new
  migration files, not edits to this one, per standard Supabase practice).
- `src/app/(app)/people/actions.ts`, `components/person-form.tsx`,
  `components/consent-toggle.tsx` — patterns to follow for the new invite
  action and directory-consent toggle.
- `src/app/(app)/register/[meetingId]/[date]/page.tsx`,
  `components/attendance-register.tsx` — permission change site.
- `src/components/app-nav.tsx` — nav entries for `/profile` and `/directory`.
- `src/app/(app)/meetings/actions.ts`, `components/meeting-form.tsx` — reuse
  for the new edit page.

## Verification checklist (per phase)

- `npm run typecheck`, `npm run lint`, `npm test`.
- Manually exercise: invite a test email → confirm login → self-edit profile
  → appears/doesn't appear in directory per consent → take a register entry
  → non-admin cannot reach `/people` or admin toggles.
- Re-run `jest-axe` suite plus a manual keyboard-only pass over new pages
  (`/profile`, `/directory`, meeting edit) for the WCAG 2.2 items above.
