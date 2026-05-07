-- 012_per_case_recommended_action.sql
--
-- Recommended action moves from per-call to per-case. The operator briefing
-- ("here's what to say when you call them back") makes more sense at the
-- case level — when a case has multiple calls about the same issue, you
-- want one brief covering all of them, not one per call that the rep has
-- to mentally merge.
--
-- Steps:
--   1. Add `cases.recommended_action`
--   2. Backfill: for each case, copy the most-recent call's
--      `recommended_action` (if any) onto the case
--   3. Drop `calls.recommended_action`

alter table cases
  add column if not exists recommended_action text;

do $$
declare
  rec record;
begin
  for rec in
    select cs.id as case_id,
           (
             select calls.recommended_action
             from calls
             where calls.case_id = cs.id
               and calls.recommended_action is not null
             order by calls.started_at desc
             limit 1
           ) as latest_action
    from cases cs
  loop
    if rec.latest_action is not null then
      update cases set recommended_action = rec.latest_action where id = rec.case_id;
    end if;
  end loop;
end$$;

alter table calls
  drop column if exists recommended_action;
