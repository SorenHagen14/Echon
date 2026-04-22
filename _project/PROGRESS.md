# Echon — Progress Tracker

## Current Phase
**Phase 1 — Project Scaffolding**
Next.js initialized, Supabase schema live, auth flow built, onboarding wireframe approved.
Onboarding wizard build (Part 2) is the immediate next task.

---

## Completed
- [x] Project folder structure created
- [x] ARCHITECTURE.md — full stack, modules, directory map, data flow
- [x] DECISIONS.md — Next.js and Supabase decisions logged
- [x] WORKFLOWS.md — WF-01 (Inbound DM) defined; WF-02 and WF-03 pending
- [x] BACKLOG.md — populated with future features and integrations
- [x] Wireframe: Dashboard
- [x] Wireframe: Conversation View (Messages tab)
- [x] Wireframe: CRM Lead Record
- [x] Wireframe: Onboarding
- [x] Wireframe: Settings
- [x] CHANGELOG.md initialized

---

## In Progress
- [ ] WF-02: Keyword Trigger / Lead Magnet workflow — needs to be defined
- [ ] WF-03: 23-Hour Follow-Up workflow — needs to be defined

---

## Up Next (Phase 1 — Project Scaffolding)
- [x] Initialize Next.js project with App Router
- [x] Set up Supabase project (database + auth)
- [ ] Configure Tailwind CSS
- [ ] Set up GitHub repo
- [ ] Define database schema (leads, conversations, messages, users)
- [ ] Set up Inngest for background jobs
- [x] Create .env.example with all required environment variables
- [x] Run initial database migration (supabase db push — all 11 tables + RLS live)
- [ ] Connect Meta Graph API (Instagram OAuth + webhook endpoint)

---

## Backlog Highlights (not yet scheduled)
- Instagram Meta API integration (imperative — app cannot function without it)
- Workflows section (lead magnets, follow-up sequences)
- Subscription tier definitions (Solo / Premium / Enterprise)
- Calendly / Cal.com integration
- WhatsApp integration
- Bot / spam deletion
- Multi-account support

---

## Action Items — 2026-04-21
- [x] Replace Next.js boilerplate in `src/app/layout.tsx` (title, metadata) and `src/app/page.tsx`
- [x] Build Supabase Auth flow — login and signup pages for Client side
- [ ] Build onboarding wizard — Steps 1–9 per approved [[onboarding]] wireframe (Part 2 approved, pending build)
- [x] Define database schema: workspaces, users, leads, conversations, messages, warmth_scores
- [x] Write RLS policies for every Client-scoped table (enforce from first migration — see [[DECISIONS]])
- [ ] Configure Tailwind CSS (verify v4 setup is working correctly in the scaffolded project)
- [ ] Set up GitHub repo and push initial commit
- [ ] Set up Inngest for background jobs
- [ ] Define feature scope and wireframe for Developer Panel (admin-side internal dashboard)
- [ ] Complete WF-02: Keyword Trigger / Lead Magnet workflow definition in [[WORKFLOWS]]
- [ ] Complete WF-03: 23-Hour Follow-Up workflow definition in [[WORKFLOWS]]
- [x] Audit `_wireframes/onboarding.md` for stale Admin/Client role terminology (resolved in 9-step rewrite)
- [ ] Audit `_wireframes/settings.md` for stale Admin/Client role terminology
- [ ] Submit Meta Developer App for review — needed before any DM functionality can go live (see [[URGENT]])

---

## Action Items — 2026-04-22
- [ ] Run onboarding Part 2: database migration (propose first, apply on approval)
- [ ] Run onboarding Part 2: /onboarding/[step] dynamic route + 9 step components
- [ ] Run onboarding Part 2: OnboardingProgressBar, StepCompleteOverlay, Confetti, WinEntry, WinsNagBanner components
- [ ] Run onboarding Part 2: server actions for each step + middleware resume logic
- [ ] Run onboarding Part 2: Step 8 Instagram connect UI + OAuth-initiate scaffold (no webhook wiring)
- [ ] Build /dashboard stub page (auth redirects there post-login; currently 404)
- [ ] Wireframe and build Developer Panel — tabs: Workspaces, Client Data, Platform Health, Billing (billing tab scaffold only)
- [ ] Decide how wins data is consumed by the AI engine at conversation time (system prompt injection vs. embedding/retrieval vs. tone-only reference)
- [ ] Submit Meta Developer App for review — already listed, confirm still open (see [[URGENT]])
- [ ] Set up GitHub repo and push initial commit
- [ ] Set up Inngest for background jobs
- [ ] Configure Tailwind CSS v4 (verify setup is correct in scaffolded project)

---

## Notes for Claude
- Stack: Next.js (App Router) + Supabase + Anthropic API + Inngest
- All wireframes are in _wireframes/ — read these before building any UI
- DECISIONS.md explains why certain tech choices were made
- BACKLOG.md contains features that are explicitly parked — do not build these
  unless the user asks
- **Admin** = the Echon developer (internal platform dashboard, not an end-user role).
  **Client** = the paying end user of Echon. Do not conflate these with "agency owner" or
  "limited viewer" — those definitions are obsolete.
- A future "workspace owner vs. team member" role within Client is deferred — do not build it.
- AI mode (Manual / Hybrid / Auto) lives in the Messages tab, not the top nav
- Default AI mode on first Client load: **Hybrid**
- Auto mode locks the send box for everyone — user must switch to Manual or Hybrid to type
- RLS (Row-Level Security) is required on every Supabase table holding Client-scoped data.
  Never defer RLS or rely on app-layer filtering alone. Each Client is scoped to their own
  workspace; no cross-Client data access is permitted.
