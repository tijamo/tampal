-- =============================================================================
-- Families, plus extra person fields to support importing member data from
-- another platform (CHMeetings) without losing information.
--
-- Design notes:
--   * families is a lightweight grouping: a name and an optional primary
--     contact (a member of the family). Membership lives on people.family_id
--     rather than a join table -- a person belongs to at most one family,
--     which matches how the source data and the church's own model works.
--   * families are readable by all authenticated users (like meetings/the
--     directory: name-level grouping isn't sensitive), but only admins can
--     create/rename families or change membership -- consistent with people
--     being admin-managed.
--   * external_ref on both tables records the source system's id (e.g.
--     "chmeetings:2097043") so a re-run of the importer updates existing
--     records instead of duplicating them.
--   * New person columns are plain (non-special-category) PII, covered by
--     the same admin-or-self people_select policy people already has.
-- =============================================================================

create table families (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null check (length(trim(name)) > 0),
  primary_contact_person_id uuid references people (id) on delete set null,
  external_ref               text,
  created_at                 timestamptz not null default now(),
  created_by                 uuid references auth.users (id) on delete set null
);

create unique index families_external_ref_idx on families (external_ref) where external_ref is not null;

alter table people add column family_id uuid references families (id) on delete set null;
create index people_family_idx on people (family_id) where deleted_at is null;

alter table people
  add column birthdate        date,
  add column baptism_date     date,
  add column baptism_location text,
  add column join_date        date,
  add column talents_hobbies  text,
  add column home_church      text,
  add column tags             text[] not null default '{}',
  add column external_ref     text;

create unique index people_external_ref_idx on people (external_ref) where external_ref is not null;

-- ----------------------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------------------
alter table families enable row level security;

create policy families_select on families
  for select to authenticated using (true);

create policy families_admin_write on families
  for all to authenticated
  using (is_admin()) with check (is_admin());

grant select, insert, update, delete on families to authenticated, service_role;

create trigger audit_families
  after insert or update or delete on families
  for each row execute function log_audit();
