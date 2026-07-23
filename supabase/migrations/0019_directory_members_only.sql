-- =============================================================================
-- Visitors never appear in the member directory, regardless of consent --
-- enforced at the data layer (not just hidden in the UI), since a directory
-- listing is a member-facing feature and visitors haven't gone through the
-- same self-service consent flow as members typically would.
-- =============================================================================

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
  left join lateral (
    select c.granted
    from consents c
    where c.person_id = p.id and c.consent_type = 'directory_visible'
    order by c.created_at desc
    limit 1
  ) dv on true
  where p.deleted_at is null
    and p.person_type = 'member'
    and coalesce(dv.granted, true);

grant select on people_directory to authenticated;

comment on view people_directory is
  'Member-only directory (visitors are never included). Excludes anyone with a current directory_visible=false consent (default visible). Name + type + family_id for everyone else; phone/email/address only for people who''ve separately opted in to sharing each.';
