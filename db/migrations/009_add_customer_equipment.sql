-- 009_add_customer_equipment.sql
--
-- Adds an `equipment` jsonb column to `customers` for storing trade-agnostic
-- equipment / installation history. HVAC has units + thermostats, plumbing
-- has water heaters + fixtures, electrical has panels + circuits, roofing
-- has materials, etc. — a strict relational schema can't express all of
-- those without N tables and per-trade migrations. JSONB lets the UI
-- evolve fields per trade without further schema changes.
--
-- Item shape (enforced in app code, not by Postgres):
--   { id: uuid, type: text, brand?: text, model?: text,
--     install_date?: date (ISO yyyy-mm-dd), notes?: text, created_at: timestamptz }
--
-- RLS already covers this via the existing workspace-scoped policy on
-- `customers`.

alter table customers
  add column if not exists equipment jsonb not null default '[]'::jsonb;

comment on column customers.equipment is
  'Array of equipment items installed/serviced for this customer. Trade-agnostic shape; see migration 009 for the item schema.';
