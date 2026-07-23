-- =============================================================================
-- Expose family_id on people_directory so the directory can offer a
-- "group by family" view, same as the admin People page. Not sensitive:
-- families are already readable by every authenticated user (0008's
-- families_select policy), so this just lets the directory join to it.
--
-- Appended as the last column so `create or replace view` can be used
-- (Postgres allows adding trailing columns this way, but not reordering or
-- inserting them, hence appending rather than placing it near person_type).
-- =============================================================================

create or replace view people_directory as
  select
    p.id,
    p.first_name,
    p.surname,
    p.person_type,
    case when coalesce(dc.granted, false) then p.phone else null end as phone,
    case when coalesce(dc.granted, false) then p.email else null end as email,
    p.family_id
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
  'Member/visitor directory. Name + type + family_id for everyone; phone/email only for people with a current directory_listing consent.';
