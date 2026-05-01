-- =============================================================================
-- Echon — Onboarding Wizard Part 2: Enums, Offers Split, Avatar/Pain/Wins, Referral
-- Migration: 002
-- =============================================================================
-- Introduces:
--   1. Four Postgres enums (business_type, offer_type, win_outcome,
--      referral_source) derived verbatim from the onboarding wireframe.
--   2. workspace_settings.business_type migrated from text+CHECK to enum.
--   3. offers split into its own table; offer_type/other/url removed from
--      workspace_settings. Single offer per workspace today, multi-offer
--      ready (BACKLOG.md) — no future data surgery required.
--   4. workspace_settings gains avatar and pain-point columns (Steps 4, 5).
--   5. workspaces gains referral_source + referral_source_other + onboarding_step.
--   6. wins table + RLS (Step 7 data store, 1:many per workspace).
--   7. wins_nag_dismissed on workspace_settings (dashboard banner state).
--
-- Pre-apply check:
--   Run in the Supabase SQL Editor:
--     select business_type, count(*) from workspace_settings group by 1;
--   If any row has business_type in ('agency','creator','fitness'), the
--   Section 2 cast will fail. Uncomment the CASE fallback block in Section
--   2 to remap those legacy values. Otherwise the simple cast is used —
--   cleaner and fails loudly on any surprise value.
--
-- Pre-apply check (offers):
--   Run in the Supabase SQL Editor:
--     select count(*) from workspace_settings
--       where offer_type is not null or offer_url is not null;
--   If > 0, STOP — existing offer data must be migrated into the new offers
--   table before Section 3 drops those columns. Given the onboarding flow
--   that would populate offer_type has not been built yet, this count
--   should be 0. Fresh schema assumption.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Enum types
-- ---------------------------------------------------------------------------

-- Step 2 — Business Profile
create type business_type as enum (
  'coaching',
  'agency_smma',
  'saas',
  'ecommerce',
  'consulting',
  'creator_influencer',
  'real_estate',
  'fitness_wellness',
  'other'
);

-- Step 3 — Offer (deduplicated across all business_type -> offer mappings).
-- Application code handles the business_type -> allowed offer_type dropdown
-- mapping. "Discovery Call" under Coaching and Consulting share the single
-- enum value discovery_call. consultation_call, free_consultation, and
-- discovery_call are kept distinct despite semantic adjacency, per the
-- wireframe-faithful rule.
create type offer_type as enum (
  -- Coaching
  'discovery_call',
  'group_program',
  'online_course',
  'workshop',
  -- Agency / SMMA
  'strategy_call',
  'done_for_you_service',
  'retainer',
  -- SaaS
  'free_trial',
  'demo_call',
  'paid_subscription',
  -- E-commerce
  'product_purchase',
  'flash_sale',
  'free_sample',
  -- Consulting (discovery_call, retainer reused from above)
  'project_proposal',
  -- Creator / Influencer
  'free_webinar',
  'paid_community',
  'digital_product',
  -- Real Estate
  'property_viewing',
  'consultation_call',
  'lead_form',
  -- Fitness / Wellness
  'free_consultation',
  'class_trial',
  'program_enrollment',
  -- Catch-all for 'other' business_type
  'other'
);

-- Step 7 — Wins outcome. Named win_outcome (not outcome) to avoid a future
-- collision when we add lead outcome, booking outcome, etc. Column on the
-- wins table is still named outcome.
create type win_outcome as enum (
  'booked_call',
  'closed_sale',
  'got_reply',
  'other'
);

-- Step 9 — Referral source
create type referral_source as enum (
  'instagram',
  'twitter',
  'youtube',
  'tiktok',
  'facebook',
  'linkedin',
  'friend_family',
  'google_search',
  'podcast',
  'other'
);


-- ---------------------------------------------------------------------------
-- 2. Migrate workspace_settings.business_type from text+CHECK to enum
-- ---------------------------------------------------------------------------
-- Assumes no rows have legacy values 'agency', 'creator', or 'fitness'.
-- Onboarding flow that populates this column has not been built yet, so all
-- rows should be 'other' (from the column default in migration 001). If the
-- pre-apply check shows otherwise, uncomment the CASE block below.

alter table workspace_settings
  alter column business_type drop default;

alter table workspace_settings
  drop constraint if exists workspace_settings_business_type_check;

alter table workspace_settings
  alter column business_type type business_type
  using business_type::business_type;

-- FALLBACK (uncomment if pre-apply check found any 'agency' / 'creator' /
-- 'fitness' rows, and comment out the simple cast above):
--
-- alter table workspace_settings
--   alter column business_type type business_type
--   using (
--     case business_type
--       when 'agency'  then 'agency_smma'::business_type
--       when 'creator' then 'creator_influencer'::business_type
--       when 'fitness' then 'fitness_wellness'::business_type
--       else business_type::business_type
--     end
--   );

alter table workspace_settings
  alter column business_type set default 'other'::business_type;


-- ---------------------------------------------------------------------------
-- 3. Split offers out of workspace_settings into its own table
-- ---------------------------------------------------------------------------
-- Rationale: multi-offer support is in BACKLOG.md. Keeping offers in their
-- own table now means the future multi-offer feature is a schema-compatible
-- addition (flip is_active logic in the app) rather than a data-migrating
-- split later.
--
-- No unique constraint on (workspace_id) — the "exactly one active offer"
-- rule today is enforced at the application layer, so lifting it for
-- multi-offer is a code change, not a schema change.

alter table workspace_settings
  drop column offer_type,
  drop column offer_type_other,
  drop column offer_url;

create table offers (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,

  offer_type        offer_type not null,
  offer_type_other  text,                     -- required at app layer when offer_type = 'other'
  offer_url         text,                     -- optional booking / sales link

  is_active         bool not null default true,
  position          int  not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index offers_by_workspace_active
  on offers (workspace_id)
  where is_active = true;

create trigger offers_updated_at
  before update on offers
  for each row execute function update_updated_at();

alter table offers enable row level security;

create policy "offers: owner access"
  on offers for all
  using (workspace_id = auth_workspace_id());


-- ---------------------------------------------------------------------------
-- 4. workspace_settings: avatar + pain point columns
-- ---------------------------------------------------------------------------
-- All nullable because workspace_settings is auto-provisioned on workspace
-- creation (see handle_new_workspace trigger in migration 001), which runs
-- before onboarding populates these. The onboarding_completed flag is the
-- gate that says "these are populated for real."

alter table workspace_settings
  -- Step 4 — Your Avatar
  add column avatar_description    text,
  add column avatar_demographics   jsonb,                        -- { age_ranges, genders, location_types, income_brackets }
  add column avatar_channels       text[] not null default '{}', -- Instagram / TikTok / LinkedIn / YouTube / Facebook Groups / Reddit / Other
  add column avatar_notes          text,

  -- Step 5 — Pain Point
  add column primary_pain          text,
  add column tried_solutions       text,
  add column cost_of_inaction      text,

  -- Step 7 — Wins nag banner state
  add column wins_nag_dismissed    bool not null default false;


-- ---------------------------------------------------------------------------
-- 5. workspaces: referral source + onboarding progress
-- ---------------------------------------------------------------------------
-- referral_source / referral_source_other: one-time attribution answer.
-- NULL semantics (see _wireframes/onboarding.md Data Collection Note):
--   - onboarding_step < 10  -> not yet reached Step 9 (no inference)
--   - onboarding_step >= 10 AND referral_source IS NULL -> explicitly skipped
--
-- onboarding_step: monotonically increasing cursor for the resume flow.
-- Middleware redirects to /onboarding/<onboarding_step> until
-- workspace_settings.onboarding_completed = true. Range 1-10.

alter table workspaces
  add column referral_source       referral_source,
  add column referral_source_other text,
  add column onboarding_step       int not null default 1
    check (onboarding_step between 1 and 10);


-- ---------------------------------------------------------------------------
-- 6. wins table
-- ---------------------------------------------------------------------------
-- One row per historical DM conversation the Client pastes during Step 7
-- (or adds later via Settings). Standalone entries — not linked to leads,
-- because these are pre-Echon conversations used only for AI training.
-- The 5-entry cap at onboarding is enforced in application code, not the
-- database.

create table wins (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,

  conversation_text text         not null,
  outcome           win_outcome  not null,
  deal_value        numeric(12,2),          -- USD; nullable
  notes             text,                   -- freeform per-entry note

  position          int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index wins_by_workspace on wins (workspace_id, position);

create trigger wins_updated_at
  before update on wins
  for each row execute function update_updated_at();

alter table wins enable row level security;

create policy "wins: owner access"
  on wins for all
  using (workspace_id = auth_workspace_id());
