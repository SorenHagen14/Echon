-- 013_add_schedule_settings.sql
--
-- Per-workspace preferences for the /schedule calendar view. Surfaced in
-- two places that share the same row: the Settings tab inside /schedule
-- and the Settings → Schedule section.
--
--   week_start           — 'sun' (default, US convention) or 'mon'
--   schedule_time_range  — 'business' (6 AM – 8 PM, default) or 'full' (24h)

alter table workspace_settings
  add column if not exists week_start text not null default 'sun'
    check (week_start in ('sun', 'mon')),
  add column if not exists schedule_time_range text not null default 'business'
    check (schedule_time_range in ('business', 'full'));
