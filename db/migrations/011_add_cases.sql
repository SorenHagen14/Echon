-- 011_add_cases.sql
--
-- Introduces the "case" concept: one issue for one customer, spanning all the
-- calls and appointments that belong to it. Replaces per-appointment operator
-- assignment (which migration 010 introduced just one day prior — no real
-- data has been written through it yet).
--
-- A case has up to three role slots:
--   - cs_rep_id     — customer-facing person handling communication
--   - technician_id — the field worker (HVAC tech, landscaper, roofer, etc.
--                     — the slot is vertical-agnostic; the column name follows
--                     the dominant service-business term)
--   - manager_id    — supervisor / case owner
--
-- Slots are nullable; cases open empty and humans (or the deterministic
-- "auto-assign" action) fill them. Eligibility for each slot is enforced in
-- app code via the `is_*` flags on `operators`. Free-text `operators.role`
-- is preserved for display ("Senior Tech, Owner"), the flags drive matching,
-- and per-role priority drives ranking.
--
-- Auto-creation rule (in app code, not the DB):
--   - if the customer already has an open case → attach the new call to it
--   - else create a new case (status=open) and attach the call

create type case_status as enum ('open', 'closed');

create table cases (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete restrict,

  status        case_status not null default 'open',
  title         text,                                              -- short label, defaults from first call's service_requested
  notes         text,

  cs_rep_id     uuid references operators(id) on delete set null,
  technician_id uuid references operators(id) on delete set null,
  manager_id    uuid references operators(id) on delete set null,

  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index cases_by_workspace_status on cases (workspace_id, status);
create index cases_by_customer         on cases (customer_id);

create trigger cases_updated_at
  before update on cases
  for each row execute function update_updated_at();

alter table cases enable row level security;

create policy "cases: owner access"
  on cases for all
  using (workspace_id = auth_workspace_id());


-- Calls + appointments link into a case. Nullable because (a) calls without
-- a customer_id can never have a case, and (b) calls/appointments that
-- pre-date this migration get backfilled below.
alter table calls
  add column if not exists case_id uuid references cases(id) on delete set null;
create index if not exists calls_by_case
  on calls (case_id) where case_id is not null;

alter table appointments
  add column if not exists case_id uuid references cases(id) on delete set null;
create index if not exists appointments_by_case
  on appointments (case_id) where case_id is not null;


-- The case's technician_id replaces per-appointment operator assignment.
alter table appointments
  drop column if exists assigned_operator_id;


-- Operator eligibility + per-role priority.
--   is_*           — boolean flags drive auto-assign matching and the case
--                    slot dropdowns; an operator only appears in a slot's
--                    dropdown if the corresponding flag is true
--   priority_*     — 1..10, higher wins; only meaningful when the matching
--                    is_* flag is true. The Team UI shows each priority
--                    input only for roles the operator is eligible for.
alter table operators
  add column if not exists is_cs_rep      boolean  not null default false,
  add column if not exists is_technician  boolean  not null default false,
  add column if not exists is_manager     boolean  not null default false,
  add column if not exists priority_cs        smallint not null default 5
    check (priority_cs        between 1 and 10),
  add column if not exists priority_tech      smallint not null default 5
    check (priority_tech      between 1 and 10),
  add column if not exists priority_manager   smallint not null default 5
    check (priority_manager   between 1 and 10);


-- Backfill: each existing call with a customer becomes its own case.
-- Coarse but safe — humans can merge with the new merge UI if the AI
-- (or this backfill) groups things wrong. Calls without a customer_id
-- are skipped (they never had a case).
do $$
declare
  c record;
  new_case_id uuid;
begin
  for c in
    select calls.id as call_id,
           calls.workspace_id,
           calls.customer_id,
           calls.started_at,
           calls.service_requested,
           customers.name as customer_name
    from calls
    join customers on customers.id = calls.customer_id
    where calls.case_id is null
  loop
    insert into cases (workspace_id, customer_id, title, opened_at)
    values (
      c.workspace_id,
      c.customer_id,
      coalesce(nullif(c.service_requested, ''), c.customer_name, 'Case'),
      c.started_at
    )
    returning id into new_case_id;

    update calls
      set case_id = new_case_id
      where id = c.call_id;

    update appointments
      set case_id = new_case_id
      where call_id = c.call_id;
  end loop;
end$$;
