-- 016_voice_persona_settings.sql — see db/migrations/ for full notes.

alter table agent_configs
  add column if not exists use_custom_system_prompt bool not null default false,
  add column if not exists custom_system_prompt text,
  add column if not exists previous_custom_system_prompt text,

  add column if not exists temperature numeric(3,2) not null default 0.70
    check (temperature between 0 and 1),
  add column if not exists model_tier text not null default 'balanced'
    check (model_tier in ('fast', 'balanced', 'best')),
  add column if not exists max_tokens int not null default 250
    check (max_tokens between 50 and 1000),
  add column if not exists end_call_phrases text[] not null
    default array['goodbye','bye','have a good day','thank you bye']::text[],
  add column if not exists interruption_threshold_sec numeric(3,2) not null default 0.50
    check (interruption_threshold_sec between 0.1 and 3.0),
  add column if not exists backchanneling_enabled bool not null default true;
