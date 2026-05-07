-- 018_voice_speed.sql — see db/migrations/ for full notes.

alter table agent_configs
  add column if not exists voice_speed numeric(3,2) not null default 1.00
    check (voice_speed between 0.5 and 2.0);
