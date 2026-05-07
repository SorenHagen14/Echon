-- =============================================================================
-- Echon — Onboarding v2 (HVAC voice receptionist)
-- Migration: 005
-- =============================================================================
-- Reshapes the onboarding wizard to match the v2 flow (see
-- _wireframes/onboarding.md):
--   * Account creation moves OUT of the wizard (signup is its own page).
--   * Step 2 is now "Where did you hear about us?" — referral_source returns,
--     with new HVAC-shaped options (no DM-era values).
--   * Step 8 becomes a sub-flow ending in an in-browser test call. New
--     agent_configs columns capture the Vapi-style sub-flow answers
--     (tasks, typical_callers, tone enum widened) and remember the user's
--     position inside the sub-flow for resume.
--   * Phone-call test step is gone (now in-browser inside Step 8). Total
--     wizard length: 11 steps (down from 12).
--   * Step 10 (number provisioning) ships forwarding-first; phone_numbers
--     gets a `source` enum so future porting flows don't require a migration.
--   * agent_configs.agent_name default flips from 'Riley' to 'John'.
--   * agent_configs.tone widens from ('friendly','professional','direct')
--     to ('professional','friendly','empathetic','concise','other'); a
--     companion tone_other column captures free-text "Something else" input.
--
-- Pre-launch migration. No production data to preserve. Single transaction;
-- rolls back on any failure.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. workspaces — widen onboarding_step to 1..11; add referral_source columns
-- ---------------------------------------------------------------------------
-- The pivot migration (004) capped onboarding_step at 12. The v2 wizard is
-- 11 steps (account creation moved out, phone test merged into Step 8). Any
-- workspace that already advanced to step 12 in dev/test gets snapped back
-- to 11 so the new constraint accepts them.

update workspaces set onboarding_step = 11 where onboarding_step = 12;

alter table workspaces
  drop constraint if exists workspaces_onboarding_step_check;

alter table workspaces
  add constraint workspaces_onboarding_step_check
  check (onboarding_step between 1 and 11);

-- Referral source enum + columns. Pivot migration (004) dropped the DM-era
-- referral_source enum + columns; we reintroduce both with the v2 shape.
create type referral_source as enum (
  'google_search',
  'youtube',
  'linkedin',
  'twitter',
  'blog',
  'discord',
  'friend',
  'other'
);

alter table workspaces
  add column referral_source       referral_source,
  add column referral_source_other text;

-- Constraint: referral_source_other is only meaningful when source = 'other'.
alter table workspaces
  add constraint workspaces_referral_source_other_check
  check (
    (referral_source = 'other' and referral_source_other is not null and length(trim(referral_source_other)) > 0)
    or (referral_source is distinct from 'other' and referral_source_other is null)
  );


-- ---------------------------------------------------------------------------
-- 2. agent_configs — Step 8 sub-flow columns; tone widening; default rename
-- ---------------------------------------------------------------------------

-- 2a. Add Step 8a/8b columns: tasks + callers (multi-select with "other")
alter table agent_configs
  add column tasks                  jsonb not null default '[]'::jsonb,
  add column tasks_other            text,
  add column typical_callers        jsonb not null default '[]'::jsonb,
  add column typical_callers_other  text;

-- 2b. Step 8 sub-flow position (1..5) — null when Step 8 is not in progress.
-- See _wireframes/onboarding.md "Resume behavior".
alter table agent_configs
  add column builder_substep smallint
    check (builder_substep is null or builder_substep between 1 and 5);

-- 2c. Widen `tone` from ('friendly','professional','direct') to v2 options,
-- and add tone_other for "Something else". The existing column is text with
-- a CHECK constraint, so we just swap the constraint.
alter table agent_configs
  drop constraint if exists agent_configs_tone_check;

alter table agent_configs
  add constraint agent_configs_tone_check
  check (tone in ('professional','friendly','empathetic','concise','other'));

-- v2 default tone is 'professional' (was 'friendly'). Don't backfill existing
-- rows — they keep whatever value they had.
alter table agent_configs
  alter column tone set default 'professional';

alter table agent_configs
  add column tone_other text;

alter table agent_configs
  add constraint agent_configs_tone_other_check
  check (
    (tone = 'other' and tone_other is not null and length(trim(tone_other)) > 0)
    or (tone is distinct from 'other' and tone_other is null)
  );

-- 2d. Agent name default flips Riley → John for new rows. Existing rows
-- keep whatever name they have.
alter table agent_configs
  alter column agent_name set default 'John';


-- ---------------------------------------------------------------------------
-- 3. phone_numbers — `source` enum so future porting works without migration
-- ---------------------------------------------------------------------------
-- MVP ships the forwarding model (Echon provisions a number; customer
-- forwards to it). Schema anticipates two future modes:
--   * 'ported'        — customer's existing number was ported into Vapi
--   * 'forwarded_to'  — number is the target of a customer's carrier-side
--                        forward (the typical pilot case)
-- Today every row is 'provisioned'. The application layer flips to
-- 'forwarded_to' once the concierge setup call confirms forwarding works.

create type phone_number_source as enum (
  'provisioned',
  'ported',
  'forwarded_to'
);

alter table phone_numbers
  add column source              phone_number_source not null default 'provisioned',
  add column forwarded_from      text,                                            -- E.164 of the customer's existing business line, when known
  add column forwarding_verified bool not null default false,
  add column concierge_call_at   timestamptz;                                     -- when the setup call is scheduled / happened


-- ---------------------------------------------------------------------------
-- 4. Notes on what is intentionally NOT changed
-- ---------------------------------------------------------------------------
-- * agent_configs.speaking_rate, recording_*, behavior toggles — untouched;
--   they're configured in Settings → Voice agent post-onboarding, not in
--   the wizard.
-- * after_hours_mode enum — unchanged (the v2 Step 6 uses the same three
--   options as v1 with refreshed copy).
-- * RLS policies on workspaces / agent_configs / phone_numbers — already in
--   place from migrations 001 + 004; new columns inherit those policies.

commit;
