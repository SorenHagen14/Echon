-- Mirror of db/migrations/022_notifications.sql.
-- See that file for the full design notes.

alter table agent_configs
  add column if not exists notification_prefs jsonb not null default
    jsonb_build_object(
      'emergency_escalation', true,
      'quote_request',        true,
      'flagged_for_review',   true,
      'ai_failed',            true,
      'contact_email',        null
    );

create table if not exists notification_events (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  event_type      text not null,
  call_id         uuid references calls(id) on delete set null,
  case_id         uuid references cases(id) on delete set null,
  customer_id     uuid references customers(id) on delete set null,
  status          text not null default 'queued'
    check (status in ('queued','sent','failed','skipped')),
  channel         text not null default 'inapp'
    check (channel in ('inapp','email','sms')),
  recipient       text,
  subject         text,
  body            text,
  error           text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists notification_events_by_workspace
  on notification_events (workspace_id, created_at desc);
create index if not exists notification_events_by_call
  on notification_events (call_id) where call_id is not null;

alter table notification_events enable row level security;

create policy notification_events_select_own
  on notification_events for select
  using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );

create policy notification_events_insert_own
  on notification_events for insert
  with check (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
    )
  );
