-- 008_add_attention_resolved_at.sql
--
-- Adds `attention_resolved_at` to `calls` so a human can dismiss a call
-- from the dashboard's "Needs attention" list when the AI flagged something
-- that's already been handled offline (or hallucinated a problem). The
-- call still appears in Recent Calls / call detail; only the dashboard
-- triage queue filters it out.
--
-- RLS already covers this column via the existing workspace-scoped policy.

alter table calls
  add column if not exists attention_resolved_at timestamptz;

comment on column calls.attention_resolved_at is
  'When a human dismissed this call from the dashboard "Needs attention" queue. Null = still surfacing.';
