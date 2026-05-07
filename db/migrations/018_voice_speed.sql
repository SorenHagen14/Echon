-- 018_voice_speed.sql
--
-- Voice output speed (TTS rate). Separate from `speaking_rate` which is a
-- coarse enum baked into the system prompt; this controls how fast the
-- voice provider actually plays audio.
--
-- 0.8..1.3 covers "noticeably slow" through "noticeably fast" without
-- straying into territory that sounds robotic. Default 1.0.

alter table agent_configs
  add column if not exists voice_speed numeric(3,2) not null default 1.00
    check (voice_speed between 0.5 and 2.0);
