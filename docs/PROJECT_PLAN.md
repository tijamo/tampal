# TamFam Project Plan — Context, Gap Analysis & Roadmap

_Last updated: 2026-07-16. Update this document as phases land or requirements change._

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
- **In-app invite flow** — "Invite as user" action on a person record
  (`src/app/(app)/people/actions.ts` `invitePerson`, `components/invite-person.tsx`)
  calls `inviteUserByEmail` with `person_id` in the metadata;
  `handle_new_user()` (`0004_self_service.sql`) links the resulting profile
  to that person automatically.
- **Self-service profile editing** — `/profile` (`requireSession()`, not
  admin) lets a linked user edit their own contact details via the
  `update_own_contact_details` SECURITY DEFINER RPC
  (`0005_self_service_rls.sql`), which whitelists exactly the editable
  columns.
- **Directory with opt-in contact visibility** — `/directory` (non-admin
  nav entry) reads the `people_directory` view, which shows phone/email
  only where a live `directory_listing` consent exists; opt-in/out is
  self-service from `/profile` via `set_own_directory_consent`.
- **Open register-taking** — `register/[meetingId]/[date]` now uses
  `requireSession()`; `attendance` RLS allows any authenticated user to
  insert/update (delete stays admin-only).
- **In-app admin promotion** — `setUserRole` action + toggle on the person
  detail page, admin-only, self-demotion blocked.
- **Meeting edit page** — `meetings/[id]/edit` reuses `MeetingForm` in
  `edit` mode.
- **Missing entirely**: DUA 2025-specific privacy text, WCAG 2.2-specific
  gap audit (see Phase 2).

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

### Phase 1 — Core requirements from the product brief — ✅ DONE (v0.1.3)
1. ✅ In-app invite-to-user flow.
2. ✅ Self-service profile editing.
3. ✅ Directory with opt-in contact visibility.
4. ✅ Open up register-taking to all authenticated users.
5. ✅ In-app admin promotion.
6. ✅ Meeting edit page.

All six landed together in `20527ec` (v0.1.3); see "What already exists"
above for where each lives. `npm run typecheck`, `npm run lint`, and
`npm test` all pass against this state.

### Phase 2 — Compliance formalisation (next up)
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

## Files most relevant to Phase 2

- `src/app/privacy/page.tsx` — privacy notice copy to extend with DUA 2025
  references and a complaints-handling section.
- `README.md` — disclaims "not legal advice"; also carries the "WCAG 2.1 AA"
  claim to update once the 2.2 audit lands.
- `__tests__/a11y.test.tsx` — existing `jest-axe` coverage to extend for
  `/profile`, `/directory`, and the meeting edit page.

## Verification checklist (per phase)

- `npm run typecheck`, `npm run lint`, `npm test`.
- Manually exercise: invite a test email → confirm login → self-edit profile
  → appears/doesn't appear in directory per consent → take a register entry
  → non-admin cannot reach `/people` or admin toggles.
- Re-run `jest-axe` suite plus a manual keyboard-only pass over new pages
  (`/profile`, `/directory`, meeting edit) for the WCAG 2.2 items above.
