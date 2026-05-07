-- 20260506000000_add_attention_resolved_at.sql
-- Mirror of db/migrations/008_add_attention_resolved_at.sql.

alter table calls
  add column if not exists attention_resolved_at timestamptz;

comment on column calls.attention_resolved_at is
  'When a human dismissed this call from the dashboard "Needs attention" queue. Null = still surfacing.';
