# Echon — Claude Code Instructions

## Read These First (Every Session)
Before doing anything, read these files in order:

1. `_project/PROGRESS.md` — current phase, what's done, what's next, and key behavioral notes
2. `_project/ARCHITECTURE.md` — full stack, modules, directory map, auth, data flow
3. `_project/DECISIONS.md` — why certain tech choices were made (don't re-litigate these)
4. `_project/URGENT.md` — urgent tasks that are stalled on external dependencies. Check this before planning work.
5. `_project/BACKLOG.md` — features that are explicitly parked. Do NOT build these unless the user asks
6. `_project/WORKFLOWS.md` — step-by-step user journeys the system must support
7. `docs/CHANGELOG.md` — history of all meaningful changes

## Read When Building UI
Before writing any frontend code, read the relevant wireframe in `_wireframes/`:
- `dashboard.md` — main dashboard
- `conversation_view.md` — 3-column DM feed (Messages tab)
- `crm_lead_record.md` — individual lead profile page
- `onboarding.md` — first-time setup wizard
- `settings.md` — all settings sections

## Key Rules
- Stack is finalized: Next.js (App Router) + Supabase + Anthropic API + Inngest + Vercel. Do not suggest alternatives.
- Two roles: **Admin** = the Echon developer (internal platform dashboard). **Client** = the paying end user of the app. These are not agency-owner vs. viewer — they are developer vs. customer. Always respect this boundary.
- Every Supabase table holding Client-scoped data must have Postgres RLS enabled with an explicit policy. Never rely on application-layer filtering alone for data isolation.
- AI mode (Manual / Hybrid / Auto) lives in the Messages tab as a segmented bar — not the top nav.
- Default AI mode on first Client app load: **Hybrid**.
- Auto mode locks the send box for everyone (Client and Admin) — switching to Manual or Hybrid is required to type. This is a user-error prevention rule, not a permissions rule.
- Top nav order: Dashboard · Messages · Workflows · Settings
- Do not build anything in BACKLOG.md unless explicitly asked.
- Update `_project/PROGRESS.md` whenever a phase or task is completed.
- Log all meaningful changes to `docs/CHANGELOG.md` with a date and description.
