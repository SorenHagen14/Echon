-- 017_default_model_to_haiku.sql
--
-- Default every workspace's voice agent model to Haiku ("fast" tier).
-- Higher tiers (Sonnet, Opus) will reappear in the UI gated behind a
-- subscription tier — see BACKLOG: subscription-tier gating. Until then
-- the model picker is hidden and every assistant runs on Haiku.
--
-- Migrates existing rows that were on the old default ('balanced') so
-- nobody is silently still on Sonnet after this lands.

alter table agent_configs
  alter column model_tier set default 'fast';

update agent_configs
   set model_tier = 'fast'
 where model_tier = 'balanced';
