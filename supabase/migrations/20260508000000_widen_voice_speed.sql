-- 019_widen_voice_speed.sql — see db/migrations/ for full notes.

alter table agent_configs
  drop constraint if exists agent_configs_voice_speed_check;

alter table agent_configs
  add constraint agent_configs_voice_speed_check
  check (voice_speed between 0.25 and 2.0);
