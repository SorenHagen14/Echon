-- 021_operator_role_and_access_tier.sql
--
-- Per-operator custom role label + access tier. See db/migrations/021_*
-- for the full rationale.

alter table operators
  add column if not exists role_label text,
  add column if not exists access_tier text not null default 'view_only'
    check (access_tier in ('full_access', 'case_resolver', 'view_only'));
