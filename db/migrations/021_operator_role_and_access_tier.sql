-- 021_operator_role_and_access_tier.sql
--
-- Per-operator custom role label + access tier.
--
-- `role_label` is a free-text label for roles outside the three baked-in
-- eligibility flags (CS rep / Technician / Manager). It's display-only —
-- routing still uses the eligibility booleans + per-role priority.
--
-- `access_tier` is the planned permission level for when this operator
-- becomes an actual workspace user (login + RLS). Today it's data-only —
-- nothing reads it for enforcement yet. Tiers:
--   full_access    — manager / owner. Everything.
--   case_resolver  — CSR. Resolve cases, edit customer info, manage
--                    appointments. No settings/billing/team.
--   view_only      — tech. Read-only on assigned cases + customer info.
--
-- Default for new operators is `view_only` (lowest tier) — adding a
-- person to the team shouldn't accidentally grant them admin rights.

alter table operators
  add column if not exists role_label text,
  add column if not exists access_tier text not null default 'view_only'
    check (access_tier in ('full_access', 'case_resolver', 'view_only'));
