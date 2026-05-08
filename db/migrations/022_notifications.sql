-- 022_notifications.sql
--
-- Two pieces:
--
-- 1. agent_configs.notification_prefs — per-workspace toggles for which
--    in-app/email events fire alerts. SMS is in BACKLOG (no SMS infra
--    yet) so we don't surface a channel field; the dispatcher always
--    falls back to "in-app + email" when transports are wired.
--
--    Default: all four event types on, route to the workspace owner's
--    auth email.
--
-- 2. notification_events — append-only audit of every alert the
--    dispatcher tries to fire. Even before SMTP/SMS infra lands this is
--    the system of record: post-call code calls notify(), a row gets
--    written, and once Resend/Twilio are wired the same row gets a
--    delivery status update. RLS-scoped to workspace.

-- ---------------------------------------------------------------------------
-- 1. notification_prefs column
-- ---------------------------------------------------------------------------

alter table agent_configs
  add column if not exists notification_prefs jsonb not null default
    jsonb_build_object(
      'emergency_escalation', true,
      'quote_request',        true,
      'flagged_for_review',   true,
      'ai_failed',            true,
      'contact_email',        null
    );


-- ---------------------------------------------------------------------------
-- 2. notification_events table
-- ---------------------------------------------------------------------------

create table if not exists notification_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,

  -- What happened: 'emergency_escalation' | 'quote_request' |
  -- 'flagged_for_review' | 'ai_failed' | 'after_hours_message' |
  -- 'escalation_requested'
  event_type      text not null,

  -- Optional links so the dashboard can deep-link.
  call_id         uuid references calls(id) on delete set null,
  case_id         uuid references cases(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,

  -- Delivery state. 'queued' = recorded, no transport yet.
  --                 'sent'   = email/SMS dispatched OK.
  --                 'failed' = transport errored (see error).
  --                 'skipped'= prefs disabled or no recipient configured.
  status          text not null default 'queued'
    check (status in ('queued','sent','failed','skipped')),

  -- Where it went. 'inapp' is always implicit (the dashboard reads
  -- flagged_for_review etc. directly); we track 'email' / 'sms' when
  -- those transports run.
  channel         text not null default 'inapp'
    check (channel in ('inapp','email','sms')),

  recipient       text,            -- email or e164, depending on channel
  subject         text,
  body            text,
  error           text,

  -- Anything extra (urgency, reason, transcript snippets, etc.).
  payload         jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists notification_events_by_workspace
  on notification_events (workspace_id, created_at desc);
create index if not exists notification_events_by_call
  on notification_events (call_id) where call_id is not null;

alter table notification_events enable row level security;

-- Only members of the workspace can see their own alerts. Today
-- "member" == owner (no Team invites yet) — the policy uses the same
-- shape every other table uses so it'll keep working when invites land.
create policy notification_events_select_own
  on notification_events for select
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

-- Inserts come from the service-role client (post-call processing) or
-- from server actions that already scope by workspace. We still want a
-- defensive insert policy so app code with the anon key can't write
-- arbitrary rows.
create policy notification_events_insert_own
  on notification_events for insert
  with check (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );
