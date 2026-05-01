-- =============================================================================
-- Echon — Pivot to AI voice receptionist (HVAC)
-- Migration: 004
-- =============================================================================
-- Drops the entire DM-era schema (leads / conversations / messages / wins /
-- offers / lead_magnets / etc.) and replaces it with the voice-receptionist
-- schema (customers / calls / call_events / appointments / agent_configs /
-- phone_numbers / integrations).
--
-- workspace_settings is preserved as a table but stripped down to the columns
-- relevant to the voice product (onboarding_completed + new notification
-- toggles). Pre-pivot DM-shaped columns are removed.
--
-- workspaces.onboarding_step survives but its check constraint is widened
-- from 1-10 to 1-12 to match the new wizard.
--
-- Pre-launch migration. No production data to preserve. Safe to run as a
-- single transaction; if any step fails the whole migration rolls back.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Drop pre-pivot tables (FK-safe order)
-- ---------------------------------------------------------------------------
-- DROP TABLE cascades triggers, indexes, RLS policies, and FK references on
-- the dropped tables themselves, so no separate cleanup is needed.

drop table if exists lead_magnet_deliveries;
drop table if exists lead_magnets;
drop table if exists warmth_score_history;
drop table if exists messages;
drop table if exists conversations;
drop table if exists leads;
drop table if exists wins;
drop table if exists dm_examples;
drop table if exists offers;
drop table if exists instagram_connections;


-- ---------------------------------------------------------------------------
-- 2. Strip pre-pivot columns from preserved tables
-- ---------------------------------------------------------------------------

-- workspaces: drop referral_source* columns; widen onboarding_step range
alter table workspaces
  drop column if exists referral_source,
  drop column if exists referral_source_other;

alter table workspaces
  drop constraint if exists workspaces_onboarding_step_check;

alter table workspaces
  add constraint workspaces_onboarding_step_check
  check (onboarding_step between 1 and 12);


-- workspace_settings: drop every DM-era column; keep onboarding_completed,
-- timestamps, workspace_id, id. Replace the DM-shaped notif toggles with
-- HVAC-relevant ones.
alter table workspace_settings
  -- Business profile (DM-era)
  drop column if exists business_type,
  drop column if exists business_type_other,
  -- Brand voice (DM-era)
  drop column if exists tone_tags,
  drop column if exists tone_description,
  -- AI configuration (DM-era — Manual/Hybrid/Auto + warmth/SLA urgency)
  drop column if exists default_ai_mode,
  drop column if exists urgency_warmth_threshold,
  drop column if exists urgency_sla_value,
  drop column if exists urgency_sla_unit,
  -- Notification toggles (DM-era — replaced below)
  drop column if exists notif_urgent_lead,
  drop column if exists notif_lead_booked,
  drop column if exists notif_ai_review,
  -- Avatar + pain point (DM-era)
  drop column if exists avatar_description,
  drop column if exists avatar_demographics,
  drop column if exists avatar_channels,
  drop column if exists avatar_notes,
  drop column if exists primary_pain,
  drop column if exists tried_solutions,
  drop column if exists cost_of_inaction,
  -- Wins nag banner state (DM-era)
  drop column if exists wins_nag_dismissed;

-- Add HVAC notification toggles (Settings → Notifications, _wireframes/settings.md §7)
alter table workspace_settings
  add column notif_emergency_escalation     bool not null default true,
  add column notif_quote_request_received   bool not null default true,
  add column notif_call_flagged_review      bool not null default true,
  add column notif_call_failed              bool not null default true;


-- ---------------------------------------------------------------------------
-- 3. Drop pre-pivot enum types
-- ---------------------------------------------------------------------------
-- Safe to drop now that no column references them.

drop type if exists referral_source;
drop type if exists win_outcome;
drop type if exists offer_type;
drop type if exists business_type;


-- ---------------------------------------------------------------------------
-- 4. New enum types (voice product)
-- ---------------------------------------------------------------------------

create type call_direction as enum (
  'inbound',
  'outbound'
);

-- Outcome reflects what the agent accomplished by end of call. `processing`
-- is the transient state between Vapi's end-of-call webhook firing and the
-- Inngest summarization job completing; the dashboard renders it as
-- "Processing..."
create type call_outcome as enum (
  'booked',
  'quote_requested',
  'escalated',
  'no_action',
  'hung_up',
  'failed',
  'processing'
);

create type urgency_level as enum (
  'emergency',
  'urgent',
  'routine'
);

create type appointment_status as enum (
  'booked',
  'confirmed',
  'completed',
  'cancelled',
  'no_show'
);

-- Per-Client behavior when a call comes in outside business hours
-- (onboarding Step 6 / Settings → After-hours & escalation).
create type after_hours_mode as enum (
  'messages_only',
  'escalate',
  'live_transfer'
);

create type phone_number_status as enum (
  'active',
  'released',
  'porting_in',
  'porting_out',
  'failed'
);

create type integration_provider as enum (
  'google_calendar',
  'jobber',
  'housecall_pro',
  'service_titan'
);

create type integration_status as enum (
  'connected',
  'disconnected',
  'error',
  'expired'
);


-- ---------------------------------------------------------------------------
-- 5. New tables (voice product)
-- ---------------------------------------------------------------------------

-- 5a. agent_configs ----------------------------------------------------------
-- Per-workspace voice agent configuration. 1:1 with workspaces. Mirrors the
-- onboarding wizard (Steps 3-8) and Settings → Voice agent. Application code
-- propagates relevant fields to the Vapi assistant on every save (debounced
-- ~3s from Settings, immediate from onboarding — see _wireframes/settings.md).

create table agent_configs (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null unique references workspaces(id) on delete cascade,

  -- Vapi linkage
  vapi_assistant_id       text,                              -- null until Step 8 (or first Settings save) provisions it

  -- Business identity (onboarding Step 3)
  business_name           text,
  business_phone          text,                              -- existing number (for forwarding-back if needed)
  business_address        text,
  service_area            jsonb,                             -- { zip_codes: [...], radius_miles: int, center: address }

  -- Services (onboarding Step 4)
  -- Shape: [{ key: 'ac_repair', label: 'AC repair', book_directly: true,  pricing_note: '...' }, ...]
  services                jsonb not null default '[]'::jsonb,

  -- Hours (onboarding Step 5)
  -- Shape: { mon: { open: '08:00', close: '17:00', closed: false }, ... }
  business_hours          jsonb,
  timezone                text,
  holiday_schedule        jsonb,

  -- After-hours behavior (onboarding Step 6)
  after_hours_mode        after_hours_mode not null default 'messages_only',
  oncall_numbers          jsonb not null default '[]'::jsonb, -- [{ phone, label, rotation_window? }, ...]
  emergency_keywords      text[] not null default '{gas,water,smoke,leak,fire,carbon monoxide}',

  -- Quote rules (onboarding Step 7)
  quote_rule_replacement  bool not null default true,         -- auto-route full system replacement to WF-02
  quote_rule_commercial   bool not null default true,
  quote_rule_insurance    bool not null default true,
  quote_rule_custom       text,                               -- free-text rules

  -- Voice persona (onboarding Step 8 / Settings → Voice agent)
  agent_name              text not null default 'Riley',
  voice_preset            text,                               -- Vapi voice id
  tone                    text not null default 'friendly'
    check (tone in ('friendly','professional','direct')),
  speaking_rate           text not null default 'normal'
    check (speaking_rate in ('slow','normal','fast')),
  greeting                text,
  system_prompt_addendum  text,

  -- Behavior toggles (Settings → Voice agent → Behavior rules)
  confirm_address         bool not null default true,
  repeat_phone            bool not null default true,
  offer_sms_confirmation  bool not null default true,
  max_call_duration_sec   int  not null default 480
    check (max_call_duration_sec between 180 and 900),
  silence_timeout_sec     int  not null default 5
    check (silence_timeout_sec between 3 and 10),

  -- Recording (Settings → Voice agent → Recording & disclosure)
  recording_enabled       bool not null default true,
  recording_disclosure    text,                               -- override; auto-injected per state when null

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger agent_configs_updated_at
  before update on agent_configs
  for each row execute function update_updated_at();


-- 5b. phone_numbers ----------------------------------------------------------

create table phone_numbers (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,

  e164_number       text not null unique,                    -- e.g. '+15125551234'
  vapi_number_id    text unique,
  twilio_sid        text,
  status            phone_number_status not null default 'active',

  area_code         text,
  provisioned_at    timestamptz not null default now(),
  released_at       timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index phone_numbers_by_workspace on phone_numbers (workspace_id);

create trigger phone_numbers_updated_at
  before update on phone_numbers
  for each row execute function update_updated_at();


-- 5c. customers --------------------------------------------------------------
-- Customer records, populated mid-call (lookup_customer tool) or post-call
-- (summarization job). E.164 phone is the de-facto unique identifier per
-- workspace, but we don't constrain it as unique because the same phone may
-- belong to two distinct customers (spouses sharing a number, etc.) — the
-- application decides how to merge/split.

create table customers (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,

  name            text,
  primary_phone   text,                                      -- E.164
  secondary_phone text,
  email           text,
  address         text,                                      -- service address (most useful HVAC field)
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index customers_by_workspace on customers (workspace_id);
create index customers_by_phone     on customers (workspace_id, primary_phone);

create trigger customers_updated_at
  before update on customers
  for each row execute function update_updated_at();


-- 5d. calls ------------------------------------------------------------------
-- One row per call. Created when Vapi fires the first webhook event for the
-- call; populated as the call progresses; finalized by the Inngest post-call
-- summarization job.

create table calls (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references workspaces(id) on delete cascade,
  customer_id              uuid references customers(id) on delete set null,

  -- Vapi linkage
  vapi_call_id             text not null unique,

  direction                call_direction not null default 'inbound',
  caller_phone             text,                             -- E.164; useful when customer_id is null
  callee_phone             text,                             -- which Echon number was dialed

  started_at               timestamptz not null default now(),
  ended_at                 timestamptz,
  duration_sec             int,

  recording_url            text,
  transcript               jsonb,                            -- Vapi rich transcript (turns + speaker labels + timestamps)
  summary                  text,                             -- Anthropic-generated 2-3 sentence summary

  outcome                  call_outcome not null default 'processing',
  urgency                  urgency_level,

  -- Extracted structured fields (post-call summarization)
  service_address          text,
  service_requested        text,
  system_type              text,                             -- HVAC: AC / furnace / heat pump / mini-split / etc.

  cost_cents               int,                              -- vapi + llm + tts + stt + twilio, summed
  raw_end_of_call_report   jsonb,                            -- raw Vapi payload for debugging
  flagged_for_review       bool not null default false,
  flag_reason              text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index calls_by_workspace_started on calls (workspace_id, started_at desc);
create index calls_by_customer          on calls (customer_id) where customer_id is not null;
create index calls_processing           on calls (workspace_id) where outcome = 'processing';

create trigger calls_updated_at
  before update on calls
  for each row execute function update_updated_at();


-- 5e. call_events ------------------------------------------------------------
-- Structured trace of mid-call activity: tool invocations, transfers,
-- escalations, state transitions. Used by the call detail UI to render
-- inline highlights ("[Agent looked up customer]"), and by Echon admin for
-- debugging agent behavior. workspace_id denormalized for RLS efficiency.

create table call_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  call_id         uuid not null references calls(id) on delete cascade,

  event_type      text not null,                             -- e.g. tool_invoked, tool_returned, transfer_initiated, escalation_fired
  payload         jsonb,
  occurred_at     timestamptz not null default now(),

  created_at      timestamptz not null default now()
);

create index call_events_by_call on call_events (call_id, occurred_at);


-- 5f. appointments -----------------------------------------------------------

create table appointments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  customer_id       uuid not null references customers(id) on delete restrict,
  call_id           uuid references calls(id) on delete set null,

  service_type      text not null,
  service_address   text,
  scheduled_for     timestamptz not null,
  duration_min      int not null default 60
    check (duration_min between 15 and 480),
  status            appointment_status not null default 'booked',

  gcal_event_id     text,                                    -- Google Calendar event id; null if calendar disconnected
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index appointments_by_workspace_scheduled on appointments (workspace_id, scheduled_for);
create index appointments_by_customer            on appointments (customer_id);
create index appointments_by_call                on appointments (call_id) where call_id is not null;

create trigger appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at();


-- 5g. integrations -----------------------------------------------------------
-- Third-party connections per workspace (Google Calendar today; Jobber /
-- Housecall Pro / ServiceTitan future).
--
-- TODO: oauth_access_token / oauth_refresh_token are stored as plain text
-- here. Before the first non-test Client connects a real Google account,
-- wrap these with pgsodium (Supabase's column-level encryption) or store
-- via Supabase Vault. Tracked in URGENT.md.

create table integrations (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references workspaces(id) on delete cascade,
  provider              integration_provider not null,

  oauth_access_token    text,                                -- TODO: encrypt before non-test usage
  oauth_refresh_token   text,                                -- TODO: encrypt before non-test usage
  oauth_expires_at      timestamptz,

  config                jsonb not null default '{}'::jsonb,  -- e.g. { calendar_id, calendar_name } for google_calendar
  status                integration_status not null default 'connected',
  last_error            text,

  connected_at          timestamptz not null default now(),
  disconnected_at       timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (workspace_id, provider)
);

create index integrations_by_workspace on integrations (workspace_id);

create trigger integrations_updated_at
  before update on integrations
  for each row execute function update_updated_at();


-- ---------------------------------------------------------------------------
-- 6. Row-Level Security
-- ---------------------------------------------------------------------------
-- Every Client-scoped table gets RLS enabled with an explicit policy from
-- migration day one. auth_workspace_id() resolves the authenticated user's
-- workspace via SECURITY DEFINER and is unchanged from migration 001.

alter table agent_configs enable row level security;
alter table phone_numbers enable row level security;
alter table customers     enable row level security;
alter table calls         enable row level security;
alter table call_events   enable row level security;
alter table appointments  enable row level security;
alter table integrations  enable row level security;

create policy "agent_configs: owner access"
  on agent_configs for all
  using (workspace_id = auth_workspace_id());

create policy "phone_numbers: owner access"
  on phone_numbers for all
  using (workspace_id = auth_workspace_id());

create policy "customers: owner access"
  on customers for all
  using (workspace_id = auth_workspace_id());

create policy "calls: owner access"
  on calls for all
  using (workspace_id = auth_workspace_id());

create policy "call_events: owner access"
  on call_events for all
  using (workspace_id = auth_workspace_id());

create policy "appointments: owner access"
  on appointments for all
  using (workspace_id = auth_workspace_id());

create policy "integrations: owner access"
  on integrations for all
  using (workspace_id = auth_workspace_id());


-- ---------------------------------------------------------------------------
-- 7. Bootstrap: auto-provision agent_configs on workspace creation
-- ---------------------------------------------------------------------------
-- Mirrors the existing handle_new_workspace pattern that auto-creates
-- workspace_settings on workspace insert (see migration 001 + 003). We
-- extend that function rather than add a second trigger so the two rows are
-- created in the same statement.

create or replace function handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into workspace_settings (workspace_id) values (new.id);
  insert into agent_configs      (workspace_id) values (new.id);
  return new;
end;
$$;


commit;
