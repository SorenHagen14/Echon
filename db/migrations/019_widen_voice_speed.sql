-- 019_widen_voice_speed.sql
--
-- Vapi's OpenAI voice provider accepts speed 0.25..4.0. We constrain to
-- 0.25..2.0 to keep the slider usable — anything past 2x sounds clipped.
-- Migration 018 shipped with a tighter 0.5..2.0 check; widen to match
-- the Settings UI which now goes down to 0.25.

alter table agent_configs
  drop constraint if exists agent_configs_voice_speed_check;

alter table agent_configs
  add constraint agent_configs_voice_speed_check
  check (voice_speed between 0.25 and 2.0);
