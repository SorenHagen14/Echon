-- 020_add_holidays.sql
--
-- One-off closure dates (Christmas, July 4, Memorial Day, etc.). Stored as
-- a jsonb array on agent_configs alongside business_hours. Each entry:
--   { "date": "YYYY-MM-DD", "label": "Christmas Day" }
--
-- "closed all day" is the only behavior for now — partial-day holiday
-- hours can come later if shops ask for it. Defaults to []. The
-- VoiceProvider reads this when synthesizing the assistant's
-- in-/out-of-hours rules.

alter table agent_configs
  add column if not exists holidays jsonb not null default '[]'::jsonb;
