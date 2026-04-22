-- =============================================================================
-- Echon — Initial Schema
-- Migration: 001
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Reusable updated_at trigger function
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- User profiles (extends auth.users with display name fields)
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();


-- One workspace per Client account (scoping boundary for all data)
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);


-- All Client-configurable settings: business profile, offer, brand voice, AI config, notifications
create table workspace_settings (
  id                         uuid primary key default gen_random_uuid(),
  workspace_id               uuid not null unique references workspaces(id) on delete cascade,

  -- Business profile (onboarding Step 2 / Settings → Offer & Brand Voice)
  business_type              text not null default 'other'
    check (business_type in ('coaching','agency','saas','ecommerce','consulting','creator','real_estate','fitness','other')),
  business_type_other        text,                        -- free text if business_type = 'other'

  -- Offer (onboarding Step 3)
  offer_type                 text,
  offer_type_other           text,                        -- free text if offer_type = 'other'
  offer_url                  text,

  -- Brand voice (onboarding Step 4)
  tone_tags                  text[] not null default '{}', -- up to 3 from preset list
  tone_description           text,

  -- AI configuration (Settings → AI Configuration)
  default_ai_mode            text not null default 'hybrid'
    check (default_ai_mode in ('manual','hybrid','auto')),
  urgency_warmth_threshold   int  not null default 70
    check (urgency_warmth_threshold between 0 and 100),
  urgency_sla_value          int  not null default 2,
  urgency_sla_unit           text not null default 'hours'
    check (urgency_sla_unit in ('minutes','hours')),

  -- Notification preferences (Settings → Notifications; all on by default)
  notif_urgent_lead          bool not null default true,
  notif_lead_booked          bool not null default true,
  notif_ai_review            bool not null default true,

  -- Onboarding state
  onboarding_completed       bool not null default false,

  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create trigger workspace_settings_updated_at
  before update on workspace_settings
  for each row execute function update_updated_at();


-- Meta / Instagram OAuth credentials (treated as secrets; isolated from workspace_settings)
create table instagram_connections (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null unique references workspaces(id) on delete cascade,
  instagram_handle     text not null,
  instagram_user_id    text not null,   -- Meta user ID
  page_id              text not null,   -- Meta Page ID
  page_access_token    text not null,   -- long-lived page access token
  token_expires_at     timestamptz,
  connected_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger instagram_connections_updated_at
  before update on instagram_connections
  for each row execute function update_updated_at();


-- Example DM responses (onboarding Step 4 / Settings → Brand Voice)
create table dm_examples (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  content      text not null,
  position     int  not null default 0,  -- display ordering within the workspace
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger dm_examples_updated_at
  before update on dm_examples
  for each row execute function update_updated_at();


-- Individual Instagram users who have messaged a Client's account
create table leads (
  id                       uuid primary key default gen_random_uuid(),
  workspace_id             uuid not null references workspaces(id) on delete cascade,

  -- Instagram identity
  instagram_psid           text not null,  -- Meta page-scoped user ID (stable identifier)
  instagram_handle         text,
  instagram_profile_photo_url text,

  -- Lead state
  status                   text not null default 'new'
    check (status in ('new','engaged','warm','booked')),
  warmth_score             int  not null default 0
    check (warmth_score between 0 and 100),
  warmth_score_overridden  bool not null default false,  -- true when Client manually set the score

  -- Per-lead AI mode override (null = use workspace global default)
  ai_mode_override         text check (ai_mode_override in ('manual','hybrid','auto')),

  -- Activity tracking
  first_contact_at         timestamptz not null default now(),
  last_message_at          timestamptz,
  total_messages           int not null default 0,

  -- CRM metadata
  offer_responded_to       text,
  trigger_source           text,                          -- post or keyword that brought them in
  objection_tags           text[] not null default '{}', -- AI-classified: price, timing, trust, etc.
  notes                    text,                          -- freeform manual notes

  -- Urgency
  is_urgent                bool not null default false,

  -- AI-generated summary (updated after each message exchange)
  ai_summary               text,
  ai_summary_updated_at    timestamptz,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (workspace_id, instagram_psid)
);

create index leads_by_warmth    on leads (workspace_id, warmth_score desc);
create index leads_by_recency   on leads (workspace_id, last_message_at desc);
create index leads_urgent       on leads (workspace_id) where is_urgent = true;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();


-- One conversation thread per lead at MVP; keyed to lead + platform for future expansion
create table conversations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id      uuid not null unique references leads(id) on delete cascade,
  platform     text not null default 'instagram' check (platform in ('instagram')),
  phase        text,  -- AI-classified conversation phase (internal; hidden from Clients)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();


-- Every message in a conversation (inbound and outbound)
create table messages (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  conversation_id  uuid not null references conversations(id) on delete cascade,

  direction        text not null check (direction in ('inbound','outbound')),
  content          text not null,
  sent_by          text not null check (sent_by in ('ai','human','system')),

  -- Meta dedup: partial unique so NULLs are allowed for outbound messages we send
  meta_message_id  text,

  -- AI metadata (internal; hidden from Clients)
  ai_classification text,   -- Haiku intent/phase classification tag
  ai_suggestions    jsonb,  -- { a: "...", b: "...", c: "..." } — Hybrid mode options
  chosen_suggestion text check (chosen_suggestion in ('a','b','c')),  -- null if Client typed custom
  training_feedback text,   -- "Why did you choose this?" free text from Client

  sent_at    timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index messages_meta_message_id_unique
  on messages (meta_message_id)
  where meta_message_id is not null;

create index messages_by_conversation on messages (conversation_id, sent_at desc);


-- Audit trail for warmth score changes (AI-driven and manual)
create table warmth_score_history (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id      uuid not null references leads(id) on delete cascade,
  score        int  not null check (score between 0 and 100),
  changed_by   text not null check (changed_by in ('ai','human')),
  created_at   timestamptz not null default now()
);

create index warmth_history_by_lead on warmth_score_history (lead_id, created_at desc);


-- Lead magnets (Workflows; schema included because CRM lead record tracks deliveries)
create table lead_magnets (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  url              text not null,  -- Google Drive, YouTube, etc. — no file uploads
  keyword_trigger  text,           -- keyword that triggers automatic delivery
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger lead_magnets_updated_at
  before update on lead_magnets
  for each row execute function update_updated_at();


-- Per-lead lead magnet delivery tracking (visible in CRM Lead Record → Section 3)
create table lead_magnet_deliveries (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  lead_id          uuid not null references leads(id) on delete cascade,
  lead_magnet_id   uuid not null references lead_magnets(id) on delete cascade,
  sent_at          timestamptz not null default now(),
  opened           bool,  -- null = unknown; true/false if link-click tracked
  follow_up_1_sent_at timestamptz,
  follow_up_2_sent_at timestamptz,
  created_at       timestamptz not null default now()
);

create index lead_magnet_deliveries_by_lead on lead_magnet_deliveries (lead_id);


-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table profiles               enable row level security;
alter table workspaces             enable row level security;
alter table workspace_settings     enable row level security;
alter table instagram_connections  enable row level security;
alter table dm_examples            enable row level security;
alter table leads                  enable row level security;
alter table conversations          enable row level security;
alter table messages               enable row level security;
alter table warmth_score_history   enable row level security;
alter table lead_magnets           enable row level security;
alter table lead_magnet_deliveries enable row level security;


-- Resolves the authenticated user's workspace ID.
-- SECURITY DEFINER so it can read workspaces under RLS without recursion.
create or replace function auth_workspace_id()
returns uuid
language sql
security definer
stable
as $$
  select id from workspaces where owner_id = auth.uid() limit 1;
$$;


-- profiles: own row only
create policy "profiles: owner access"
  on profiles for all
  using (id = auth.uid());

-- workspaces: own workspace only
create policy "workspaces: owner access"
  on workspaces for all
  using (owner_id = auth.uid());

-- workspace_settings
create policy "workspace_settings: owner access"
  on workspace_settings for all
  using (workspace_id = auth_workspace_id());

-- instagram_connections
create policy "instagram_connections: owner access"
  on instagram_connections for all
  using (workspace_id = auth_workspace_id());

-- dm_examples
create policy "dm_examples: owner access"
  on dm_examples for all
  using (workspace_id = auth_workspace_id());

-- leads
create policy "leads: owner access"
  on leads for all
  using (workspace_id = auth_workspace_id());

-- conversations
create policy "conversations: owner access"
  on conversations for all
  using (workspace_id = auth_workspace_id());

-- messages
create policy "messages: owner access"
  on messages for all
  using (workspace_id = auth_workspace_id());

-- warmth_score_history
create policy "warmth_score_history: owner access"
  on warmth_score_history for all
  using (workspace_id = auth_workspace_id());

-- lead_magnets
create policy "lead_magnets: owner access"
  on lead_magnets for all
  using (workspace_id = auth_workspace_id());

-- lead_magnet_deliveries
create policy "lead_magnet_deliveries: owner access"
  on lead_magnet_deliveries for all
  using (workspace_id = auth_workspace_id());


-- ---------------------------------------------------------------------------
-- Bootstrap triggers (auto-create rows on signup)
-- ---------------------------------------------------------------------------

-- When a new user signs up, provision their profile and workspace automatically.
-- The workspace trigger below then creates workspace_settings.
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles  (id)          values (new.id);
  insert into workspaces (owner_id)   values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- When a workspace is created, provision its settings row with all defaults.
create or replace function handle_new_workspace()
returns trigger language plpgsql security definer as $$
begin
  insert into workspace_settings (workspace_id) values (new.id);
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on workspaces
  for each row execute function handle_new_workspace();
