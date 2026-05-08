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

## Read When Talking Sales / Pitch / Marketing
If the user's question is about positioning, outreach, pitching to a
potential customer, vertical expansion, pricing ideas, or anything sales
or marketing flavored, read `_project/GROWTH.md` first. It holds warm
leads, the core pitch, vertical shortlist, and positioning notes. Update
it when new ideas, leads, or angles come up — that file is the home for
all sales/marketing thinking.

## Read When Building UI
Before writing any frontend code, read the relevant wireframe in `_wireframes/`:
- `dashboard.md` — main dashboard
- `call_log.md` — `/calls` list view
- `call_detail.md` — `/calls/[id]` detail view
- `voice_agent_config.md` — Settings → Voice agent detail page
- `onboarding.md` — first-time setup wizard
- `settings.md` — all settings sections

## Product
Echon is an **AI voice receptionist** for blue-collar service businesses.
Initial vertical: **HVAC** (independent shops, 3-15 trucks). Other
verticals (plumbing, roofing, electrical, deck/fence) are explicit future
expansion — not MVP scope. The product pivoted from an Instagram DM setter
on 2026-05-01; do not reintroduce DM/messaging concepts.

## Key Rules
- Stack is finalized: Next.js (App Router) + Supabase + Anthropic API + Inngest + Vercel + **Vapi** (telephony). Do not suggest alternatives.
- All Vapi access goes through `src/lib/voice/` — application code never imports the Vapi SDK directly. The `VoiceProvider` interface is the only voice-layer abstraction; keep it thin.
- Two roles: **Admin** = the Echon developer (internal platform dashboard). **Client** = the paying HVAC business using Echon. Always respect this boundary.
- Within a Client workspace, plan for **three internal roles** (not yet built — see BACKLOG.md): **Manager** (full control), **CSR** (can resolve cases the AI didn't auto-resolve, no settings/billing), **Tech** (read-only on the case + who's on it + job details). Before building any feature that touches case state, assignments, settings, billing, or customer data, **ask the user clarifying questions** about which role(s) should see/act on it — don't assume. Each role will also connect their own calendar (Google / Outlook / native phone).
- Every Supabase table holding Client-scoped data must have Postgres RLS enabled with an explicit policy. Never rely on application-layer filtering alone for data isolation.
- Top nav order: **Dashboard · Cases · Calls · Customers · Schedule**. Settings, theme toggle, and Sign out live in a profile dropdown in the top-right (`src/app/_components/ProfileMenu.tsx`).
- Voice agent settings live under Settings → Voice agent (see `_wireframes/voice_agent_config.md`).
- Three core workflows (see `_project/WORKFLOWS.md`): WF-01 (book), WF-02 (quote request), WF-03 (after-hours triage). Workflow selection is implicit (driven by agent prompt + tools + Client config), not branched in code.
- Do not build anything in BACKLOG.md unless explicitly asked.
- Update `_project/PROGRESS.md` whenever a phase or task is completed.
- Log all meaningful changes to `docs/CHANGELOG.md` with a date and description.
