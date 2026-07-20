-- =============================================================================
-- Split people.full_name into first_name / surname.
--
-- Backfill splits on the last whitespace run: everything after it becomes
-- surname, everything before becomes first_name (so "Mary Jane Watson" ->
-- first_name "Mary Jane", surname "Watson"). Single-word names get no
-- surname (null) rather than a guessed one.
-- =============================================================================

alter table people add column first_name text;
alter table people add column surname text;

update people
   set first_name = trim(regexp_replace(full_name, '\s+\S+$', '')),
       surname     = case when full_name ~ '\s'
                       then trim(regexp_replace(full_name, '^.*\s', ''))
                       else null
                     end;

alter table people
  alter column first_name set not null,
  add constraint people_first_name_check check (length(trim(first_name)) > 0);

-- ----------------------------------------------------------------------------
-- people_directory: name-only (+ opt-in contact) view, now first/surname.
-- ----------------------------------------------------------------------------
create or replace view people_directory as
  select
    p.id,
    p.first_name,
    p.surname,
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
-- is currently granted.
-- ----------------------------------------------------------------------------
create or replace view register_eligible_people as
  select p.id, p.first_name, p.surname
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

comment on view register_eligible_people is
  'Name-only list of people eligible to appear on an attendance register, for any authenticated user taking one.';

-- ----------------------------------------------------------------------------
-- Self-service contact-detail editing: split name parameters.
-- ----------------------------------------------------------------------------
drop function if exists update_own_contact_details(text, text, text, text, text, text, text);

create or replace function update_own_contact_details(
  p_first_name text,
  p_surname text,
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
  if length(trim(coalesce(p_first_name, ''))) = 0 then
    raise exception 'A first name is required.';
  end if;

  update people
     set first_name    = p_first_name,
         surname       = p_surname,
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

-- Now safe: the views and function above no longer reference full_name.
alter table people drop column full_name;
