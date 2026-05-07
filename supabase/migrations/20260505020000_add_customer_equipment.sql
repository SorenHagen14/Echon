-- 20260505020000_add_customer_equipment.sql
-- Mirror of db/migrations/009_add_customer_equipment.sql.

alter table customers
  add column if not exists equipment jsonb not null default '[]'::jsonb;

comment on column customers.equipment is
  'Array of equipment items installed/serviced for this customer. Trade-agnostic shape; see migration 009 for the item schema.';
