-- =============================================================================
-- Self-service member accounts: in-app invites, self-edit, opt-in directory,
-- and shared register-taking.
--
-- Design notes:
--   * handle_new_user() now links the auto-created profile to the person
--     record the admin invited, so "member becomes user" is a single step.
--   * Self-service writes go through SECURITY DEFINER functions rather than
--     a blanket self-UPDATE RLS policy, so a member can only ever change the
--     specific columns the app intends (contact details, directory opt-in)
--     and never person_type/notes/deleted_at via a raw API call.
--   * Attendance stays admin-managed for deletes, but any authenticated user
--     may now read/insert/update it so they can actually take a register --
--     this necessarily widens who can see this Article 9 special-category
--     data beyond "admins + self", consistent with the product decision that
--     any invited user may take the register for any meeting.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Link invited users to their person record.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id uuid;
begin
  v_person_id := nullif(new.raw_user_meta_data ->> 'person_id', '')::uuid;
  insert into public.profiles (user_id, person_id, role)
  values (new.id, v_person_id, 'member')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- New consent type: opting in to a phone/email listing in the shared directory.
-- ----------------------------------------------------------------------------
alter type consent_type add value if not exists 'directory_listing';
