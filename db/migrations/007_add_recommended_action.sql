-- 007_add_recommended_action.sql
--
-- Adds a `recommended_action` column to `calls` for the post-call AI to
-- write a short action plan aimed at the human operator who picks up the
-- handoff. Distinct from `summary` (what happened on the call) — this is
-- what to do next.
--
-- Populated by the same Inngest post-call processing job that fills
-- `summary`, `outcome`, and the extracted-fields columns. RLS already
-- covers this column via the existing workspace-scoped policy on `calls`.

alter table calls
  add column if not exists recommended_action text;

comment on column calls.recommended_action is
  'Anthropic-generated action plan for the human handing the call off — short bullet list of next steps.';
