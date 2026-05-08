-- 020_voice_settings_holes.sql
--
-- Bundle of fixes for the voice-receptionist gaps surfaced in the
-- 2026-05-08 review:
--   • Per-business state (2-char US code). Drives state-based recording
--     disclosure — California, Florida, Massachusetts, etc. are
--     two-party consent and need an explicit on-call disclosure.
--   • Multi-trade. Primary trade still lives on workspaces.business_type;
--     additional trades layer on top here so the prompt can cover a
--     shop that does HVAC + plumbing without forcing one to be picked.
--   • Escalation pills — what to escalate on, what *not* to escalate on.
--     Settings → Escalation surfaces these as toggleable phrases; the
--     system prompt injects them verbatim.
--   • Drift indicator. vapi_synced_at gets bumped after every successful
--     PATCH; if updated_at > vapi_synced_at the UI shows a "your changes
--     aren't on Vapi yet" banner.

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
