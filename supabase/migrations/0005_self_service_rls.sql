-- =============================================================================
-- Self-service member accounts, part 2 (needs 'directory_listing' from 0004
-- committed first -- ALTER TYPE ... ADD VALUE can't be used in the same
-- transaction as a statement that references the new value).
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Self-service contact-detail editing. SECURITY DEFINER so we can whitelist
-- exactly which columns a member may change on their own record, rather than
-- granting a blanket self-UPDATE policy that a raw API call could use to
-- rewrite person_type/notes/deleted_at.
-- ----------------------------------------------------------------------------
create or replace function update_own_contact_details(
  p_full_name text,
  p_email text,
  p_phone text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_postcode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  select person_id into v_person_id from profiles where user_id = auth.uid();
  if v_person_id is null then
    raise exception 'Your account is not linked to a member record.';
  end if;
  if length(trim(coalesce(p_full_name, ''))) = 0 then
    raise exception 'A name is required.';
  end if;

  update people
     set full_name     = p_full_name,
         email         = p_email,
         phone         = p_phone,
         address_line1 = p_address_line1,
         address_line2 = p_address_line2,
         city          = p_city,
         postcode      = p_postcode
   where id = v_person_id
     and deleted_at is null;
end;
$$;

revoke all on function update_own_contact_details from public;
grant execute on function update_own_contact_details to authenticated;

-- ----------------------------------------------------------------------------
-- Self-service directory opt-in/out. Append-only, same as admin-captured
-- consent, but a member choosing their own directory visibility needs no
-- admin involvement.
-- ----------------------------------------------------------------------------
create or replace function set_own_directory_consent(p_granted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  select person_id into v_person_id from profiles where user_id = auth.uid();
  if v_person_id is null then
    raise exception 'Your account is not linked to a member record.';
  end if;

  insert into consents (person_id, consent_type, granted, granted_at, withdrawn_at, captured_by)
  values (
    v_person_id,
    'directory_listing',
    p_granted,
    case when p_granted then now() else null end,
    case when p_granted then null else now() end,
    auth.uid()
  );
end;
$$;

revoke all on function set_own_directory_consent from public;
grant execute on function set_own_directory_consent to authenticated;

-- ----------------------------------------------------------------------------
-- people_directory: now also carries phone/email, but only for people with a
-- current directory_listing consent. Still runs as the view owner (definer-
-- like) so it can read the base table for everyone, while emitting contact
-- details conditionally.
-- ----------------------------------------------------------------------------
create or replace view people_directory as
  select
    p.id,
    p.full_name,
    p.person_type,
    case when coalesce(dc.granted, false) then p.phone else null end as phone,
    case when coalesce(dc.granted, false) then p.email else null end as email
  from people p
  left join lateral (
    select c.granted
    from consents c
    where c.person_id = p.id
      and c.consent_type = 'directory_listing'
    order by c.created_at desc
    limit 1
  ) dc on true
  where p.deleted_at is null;

comment on view people_directory is
  'Member/visitor directory. Name + type for everyone; phone/email only for people with a current directory_listing consent.';

-- ----------------------------------------------------------------------------
-- register_eligible_people: name-only list of people whose attendance-consent
-- is currently granted, so any authenticated user can load a register without
-- needing raw access to the `people` or `consents` tables (which stay
-- admin-or-self via their existing RLS policies).
-- ----------------------------------------------------------------------------
create or replace view register_eligible_people as
  select p.id, p.full_name
  from people p
  where p.deleted_at is null
    and exists (
      select 1
      from consents c
      where c.person_id = p.id
        and c.consent_type = 'attendance_records'
        and c.granted
        and c.created_at = (
          select max(c2.created_at)
          from consents c2
          where c2.person_id = p.id
            and c2.consent_type = 'attendance_records'
        )
    );

grant select on register_eligible_people to authenticated;

comment on view register_eligible_people is
  'Name-only list of people eligible to appear on an attendance register, for any authenticated user taking one.';

-- ----------------------------------------------------------------------------
-- attendance: any authenticated user may now read and record attendance (so
-- they can actually take a register), matching the product decision that
-- register-taking isn't admin-only. Deletes remain admin-only via the
-- existing attendance_admin_all policy.
-- ----------------------------------------------------------------------------
-- Superseded by the broader select policy below (kept as one OR'd policy
-- set would be redundant either way, but drop it for clarity).
drop policy if exists attendance_read_own on attendance;

create policy attendance_select_any_authenticated on attendance
  for select to authenticated
  using (true);

create policy attendance_write_any_authenticated on attendance
  for insert to authenticated
  with check (true);

create policy attendance_update_any_authenticated on attendance
  for update to authenticated
  using (true)
  with check (true);
