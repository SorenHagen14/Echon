-- 017_default_model_to_haiku.sql — see db/migrations/ for full notes.

alter table agent_configs
  alter column model_tier set default 'fast';

update agent_configs
   set model_tier = 'fast'
 where model_tier = 'balanced';
