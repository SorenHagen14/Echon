-- 20260505000000_add_recommended_action.sql
-- Mirror of db/migrations/007_add_recommended_action.sql.

alter table calls
  add column if not exists recommended_action text;

comment on column calls.recommended_action is
  'Anthropic-generated action plan for the human handing the call off — short bullet list of next steps.';
