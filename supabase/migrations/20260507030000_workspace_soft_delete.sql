-- Soft-delete + 14-day recovery for workspaces.
-- See db/migrations/016_workspace_soft_delete.sql for full notes.

alter table workspaces
  add column if not exists deleted_at          timestamptz,
  add column if not exists scheduled_purge_at  timestamptz,
  add column if not exists deletion_reason     text;

create index if not exists workspaces_scheduled_purge_at_idx
  on workspaces (scheduled_purge_at)
  where scheduled_purge_at is not null;

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

alter table archived_calls enable row level security;

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
    null;
end $$;
