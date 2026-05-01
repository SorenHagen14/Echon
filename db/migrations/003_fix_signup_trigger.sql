-- =============================================================================
-- Echon — Fix: SECURITY DEFINER signup trigger functions need explicit search_path
-- Migration: 003
-- =============================================================================
-- Root cause:
--   handle_new_user() and handle_new_workspace() are SECURITY DEFINER functions
--   but were created with no explicit search_path (proconfig IS NULL). When
--   Supabase's GoTrue service inserts into auth.users, it runs under the
--   supabase_auth_admin role, which has rolconfig `search_path = auth`.
--
--   The trigger inherits the caller's search_path because `proconfig IS NULL`
--   (not because SECURITY DEFINER changes it — it doesn't). With search_path
--   restricted to `auth`, the unqualified references to `profiles`,
--   `workspaces`, and `workspace_settings` (all in `public`) fail with
--   "relation does not exist", which bubbles up to the client as the generic
--   Supabase error: "Database error saving new user."
--
-- Fix:
--   Recreate both functions with an explicit SET search_path clause so they
--   always resolve public schema objects regardless of who fires the trigger.
--   This is also the standard Supabase/Postgres security hardening practice
--   for SECURITY DEFINER functions (prevents search_path hijack attacks).
--
-- Why the triggers appeared to "work" in manual tests:
--   `supabase db query --linked` runs as `postgres`, which has
--   `search_path = "$user", public, extensions` — so public is resolvable
--   and the trigger succeeds. The bug only surfaces under GoTrue's role.
--
-- Scope of this fix:
--   Only the two signup-path functions. Other SECURITY DEFINER helpers
--   (auth_workspace_id, update_updated_at) run in RLS / userland contexts
--   where public is already in scope, so they are not breaking anything
--   today. Hardening them with explicit search_path is a good follow-up
--   but out of scope here — the immediate goal is to unbreak signup.
-- =============================================================================


create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into profiles  (id)        values (new.id);
  insert into workspaces (owner_id) values (new.id);
  return new;
end;
$$;


create or replace function handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into workspace_settings (workspace_id) values (new.id);
  return new;
end;
$$;
