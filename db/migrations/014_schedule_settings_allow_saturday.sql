-- 014_schedule_settings_allow_saturday.sql
--
-- Allow Saturday as a week-start option on /schedule. Migration 013
-- shipped the column with a 'sun' | 'mon' check; this widens it.

alter table workspace_settings
  drop constraint if exists workspace_settings_week_start_check;

alter table workspace_settings
  add constraint workspace_settings_week_start_check
  check (week_start in ('sat', 'sun', 'mon'));
