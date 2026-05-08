-- 020_voice_settings_holes.sql — see db/migrations/ for full notes.

alter table agent_configs
  add column if not exists business_state text,
  add column if not exists vapi_synced_at timestamptz,
  add column if not exists escalation_triggers text[] not null default array[
    'Caller explicitly asks for a human, a representative, or to speak to a person',
    'Caller asks to speak to the owner or manager',
    'Caller is upset, cursing, or threatening to leave a review',
    'Caller mentions one of the trade emergency keywords (see prompt)',
    'Caller has called multiple times about the same unresolved issue',
    'Caller mentions legal action, an attorney, or the BBB',
    'Caller has an issue outside the services we offer',
    'Caller is calling from outside our service area'
  ]::text[],
  add column if not exists escalation_non_triggers text[] not null default array[
    'Caller is asking about pricing',
    'Caller is asking about hours of operation',
    'Caller wants to leave a message after-hours',
    'Caller is asking whether we offer a particular service',
    'Caller is rescheduling an existing appointment',
    'Caller is confirming an existing booking'
  ]::text[];

alter table workspaces
  add column if not exists additional_trades text[] not null default '{}'::text[];
