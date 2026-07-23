-- =============================================================================
-- Replace the single directory_listing consent with three independent ones
-- (directory_phone, directory_email, directory_address -- added in
-- 0013_directory_consent_types.sql), and expose address in people_directory.
--
-- Backfill: anyone currently sharing under the old coarse consent keeps
-- sharing their phone and email under the new granular one (no regression in
-- what's already visible to the congregation). Address is never backfilled --
-- it's new and more sensitive than phone/email, so it starts opted OUT for
-- everyone and needs a fresh, specific opt-in.
-- =============================================================================

with currently_shared as (
  select c.person_id
  from consents c
  where c.consent_type = 'directory_listing'
    and c.granted
    and c.created_at = (
      select max(c2.created_at)
      from consents c2
      where c2.person_id = c.person_id
        and c2.consent_type = 'directory_listing'
    )
)
insert into consents (person_id, consent_type, granted, granted_at, captured_by)
select cs.person_id, t.consent_type, true, now(), null
from currently_shared cs
cross join (values ('directory_phone'::consent_type), ('directory_email'::consent_type)) as t(consent_type);

-- ----------------------------------------------------------------------------
-- Self-service consent RPC now takes which kind of directory consent to set,
-- validated against an allowlist so this can't be used to set an unrelated
-- consent_type (e.g. attendance_records) on your own record.
-- ----------------------------------------------------------------------------
drop function if exists set_own_directory_consent(boolean);

create or replace function set_own_directory_consent(p_consent_type text, p_granted boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  if p_consent_type not in ('directory_phone', 'directory_email', 'directory_address') then
    raise exception 'Invalid consent type for self-service directory consent.';
  end if;

  select person_id into v_person_id from profiles where user_id = auth.uid();
  if v_person_id is null then
    raise exception 'Your account is not linked to a member record.';
  end if;

  insert into consents (person_id, consent_type, granted, granted_at, withdrawn_at, captured_by)
  values (
    v_person_id,
    p_consent_type::consent_type,
    p_granted,
    case when p_granted then now() else null end,
    case when p_granted then null else now() end,
    auth.uid()
  );
end;
$$;

revoke all on function set_own_directory_consent(text, boolean) from public;
grant execute on function set_own_directory_consent(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- people_directory: phone/email now keyed off their own consent types, plus
-- address (new). Existing columns keep their name/position (create or
-- replace view requires that); address_line1/2/city/postcode are appended
-- after family_id (itself appended in 0009) rather than placed near the
-- other contact fields.
-- ----------------------------------------------------------------------------
create or replace view people_directory as
  select
    p.id,
    p.first_name,
    p.surname,
    p.person_type,
    case when coalesce(dp.granted, false) then p.phone else null end as phone,
    case when coalesce(de.granted, false) then p.email else null end as email,
    p.family_id,
    case when coalesce(da.granted, false) then p.address_line1 else null end as address_line1,
    case when coalesce(da.granted, false) then p.address_line2 else null end as address_line2,
    case when coalesce(da.granted, false) then p.city else null end as city,
    case when coalesce(da.granted, false) then p.postcode else null end as postcode
  from people p
  left join lateral (
    select c.granted
    from consents c
    where c.person_id = p.id and c.consent_type = 'directory_phone'
    order by c.created_at desc
    limit 1
  ) dp on true
  left join lateral (
    select c.granted
    from consents c
    where c.person_id = p.id and c.consent_type = 'directory_email'
    order by c.created_at desc
    limit 1
  ) de on true
  left join lateral (
    select c.granted
    from consents c
    where c.person_id = p.id and c.consent_type = 'directory_address'
    order by c.created_at desc
    limit 1
  ) da on true
  where p.deleted_at is null;

grant select on people_directory to authenticated;

comment on view people_directory is
  'Member/visitor directory. Name + type + family_id for everyone; phone/email/address only for people who''ve separately opted in to sharing each.';
