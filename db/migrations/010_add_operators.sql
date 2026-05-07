-- 010_add_operators.sql
--
-- Adds the Team / operators schema:
--
-- 1. `operators` — workspace-scoped people who do the work (techs / dispatch /
--    owners). The voice agent doesn't pick operators; humans do, on the
--    customer profile and on the call detail for booked calls. Per-operator
--    calendars are future work — for v1 an operator is just an assignable name
--    with a color so the dashboard can color-code things later.
--
-- 2. `appointments.assigned_operator_id` — nullable FK into `operators`.
--    Nullable because (a) historical appointments may have no assignment, and
--    (b) the AI books appointments unassigned by default; a human assigns
--    afterwards.

create table operators (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,

  name  text not null,
  email text,
  phone text,
  role  text,                                                -- free-text "Tech", "Dispatch", "Owner" — no enum yet
  color text not null default '#64748b'                      -- hex; UI uses for the avatar dot / calendar color
    check (color ~ '^#[0-9a-fA-F]{6}$'),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index operators_by_workspace on operators (workspace_id);

create trigger operators_updated_at
  before update on operators
  for each row execute function update_updated_at();

alter table operators enable row level security;

create policy "operators: owner access"
  on operators for all
  using (workspace_id = auth_workspace_id());

alter table appointments
  add column if not exists assigned_operator_id uuid
    references operators(id) on delete set null;

create index if not exists appointments_by_operator
  on appointments (assigned_operator_id)
  where assigned_operator_id is not null;

comment on column appointments.assigned_operator_id is
  'Operator assigned to this appointment. Nullable — appointments are unassigned by default and a human picks the operator from the customer profile or call detail.';
