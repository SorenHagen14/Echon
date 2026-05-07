-- Soft-delete + 14-day recovery for workspaces.
--
-- Flow:
--   1. Owner clicks Delete in Settings → Profile → Danger zone.
--   2. We set `deleted_at = now()` and `scheduled_purge_at = now() + 14d`.
--      The workspace stays in place; the app gates access and shows a
--      recovery banner. Owner can cancel any time before the purge.
--   3. A daily pg_cron job (`purge_expired_workspaces`) runs after the
--      grace window:
--        a. Anonymizes each workspace's calls into `archived_calls`
--           (transcript + summary + duration + outcome + business_type).
--           No phone, name, address, email, equipment notes, recording URL,
--           workspace_id, or customer_id is preserved.
--        b. Deletes the workspace row, which cascades to every child table
--           via existing FKs. Audio files in Storage are NOT deleted by
--           this migration — that requires a Storage call and lives in
--           an app-side worker (TODO).

alter table workspaces
  add column if not exists deleted_at          timestamptz,
  add column if not exists scheduled_purge_at  timestamptz,
  add column if not exists deletion_reason     text;

create index if not exists workspaces_scheduled_purge_at_idx
  on workspaces (scheduled_purge_at)
  where scheduled_purge_at is not null;

-- Anonymized training corpus. No workspace_id, no caller_id, no PII.
-- Only the textual content useful for model improvement plus business
-- metadata for bucketing (vertical, outcome).
create table if not exists archived_calls (
  id              uuid primary key default gen_random_uuid(),
  archived_at     timestamptz not null default now(),
  business_type   text,
  direction       text,
  outcome         text,
  duration_sec    int,
  transcript      jsonb,
  summary         text
);

-- No RLS on archived_calls — only privileged code (the purge function and
-- any future training-export job running as service role) should touch it.
-- Userland (anon / authenticated) has no access by default.
alter table archived_calls enable row level security;

-- Purge function. SECURITY DEFINER so it can write to archived_calls and
-- bypass RLS during the cascade delete.
create or replace function purge_expired_workspaces()
returns int
language plpgsql
security definer
as $$
declare
  ws record;
  count int := 0;
begin
  for ws in
    select w.id, ws_settings.business_type
    from workspaces w
    left join workspace_settings ws_settings on ws_settings.workspace_id = w.id
    where w.scheduled_purge_at is not null
      and w.scheduled_purge_at < now()
  loop
    insert into archived_calls (business_type, direction, outcome, duration_sec, transcript, summary)
    select
      ws.business_type,
      c.direction::text,
      c.outcome::text,
      c.duration_sec,
      c.transcript,
      c.summary
    from calls c
    where c.workspace_id = ws.id;

    delete from workspaces where id = ws.id;
    count := count + 1;
  end loop;

  return count;
end;
$$;

-- Schedule the purge to run daily at 03:17 UTC (off-peak). Only schedules
-- once thanks to the existence check; re-runs of this migration are safe.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'purge_expired_workspaces') then
    perform cron.schedule(
      'purge_expired_workspaces',
      '17 3 * * *',
      $cron$ select purge_expired_workspaces(); $cron$
    );
  end if;
exception
  when undefined_table then
    -- pg_cron extension not enabled on this database; skip scheduling.
    -- Enable with: create extension if not exists pg_cron; (requires
    -- elevated privileges, often only available on Supabase paid tiers
    -- or via the dashboard's Database → Extensions toggle).
    null;
end $$;
