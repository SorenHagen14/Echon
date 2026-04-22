# Echon — Changelog

All meaningful changes to the project are logged here.

---

## [2026-04-22] — GitHub Repo Live

### Added
- Repo created at https://github.com/SorenHagen14/Echon (private)
- Initial commit pushed: 57 files, 10,849 lines — full Phase 1 scaffolding
  (Next.js + Supabase schema + project docs + wireframes)
- Git identity configured globally (Soren Hagen / sorenhagen14@gmail.com)
- GitHub CLI (`gh`) installed via Homebrew; credential helper wired up via `gh auth setup-git`

### Fixed
- Removed stray `~/.git` repo that had been treating the entire home directory
  as a git tree — would have caused a sensitive-file leak if it had successfully
  pushed. Replaced with a proper repo at the Echon project root.

---

## [2026-04-21] — Database Schema

### Added
- `db/migrations/001_initial_schema.sql` — full initial Postgres schema
  - **Tables:** `profiles`, `workspaces`, `workspace_settings`, `instagram_connections`,
    `dm_examples`, `leads`, `conversations`, `messages`, `warmth_score_history`,
    `lead_magnets`, `lead_magnet_deliveries`
  - **RLS:** enabled on all 11 tables; `auth_workspace_id()` helper function scopes
    every policy to the authenticated user's own workspace
  - **Bootstrap triggers:** `on_auth_user_created` auto-provisions `profiles` +
    `workspaces`; `on_workspace_created` auto-provisions `workspace_settings`
  - **Performance indexes:** warmth score, recency, urgency (leads); conversation
    order (messages); warmth history (lead); lead magnet deliveries (lead)
  - **`updated_at` triggers** on all mutable tables

---

## [2026-04-21] — Project Foundation

### Added
- Full project folder structure created under `/Users/sorenhagen/Documents/Claude Code/Echon`
- `_project/ARCHITECTURE.md` — stack, key dependencies, core modules, directory map, auth strategy, data flow
- `_project/DECISIONS.md` — decisions logged for Next.js (frontend) and Supabase (database)
- `_project/WORKFLOWS.md` — WF-01 (Inbound DM Received) defined; WF-02 and WF-03 stubbed
- `_project/BACKLOG.md` — future features and integrations documented
- `_project/PROGRESS.md` — living progress tracker for phases, completed work, and next steps
- `_wireframes/dashboard.md` — dashboard layout, hot leads panel, warm lead summaries, role views
- `_wireframes/conversation_view.md` — 3-column DM feed, Manual/Hybrid/Auto modes, urgency logic, per-lead mode override
- `_wireframes/crm_lead_record.md` — full lead profile, status tags, warmth override, lead magnet tracking
- `_wireframes/onboarding.md` — 6-step wizard, business type, offer, brand voice, Instagram connection, confirmation screen
- `_wireframes/settings.md` — account, connections, AI config, offer & brand voice, notifications, billing tiers
- `docs/CHANGELOG.md` — this file

### Decisions
- Stack finalized: Next.js + Supabase + Anthropic API + Inngest + Vercel
- Two user roles defined: Admin and Client
- AI mode toggle lives in Messages tab (not top nav); global default set in Settings
- Top nav: Dashboard · Messages · Workflows · Settings
- Notifications: in-app only at launch (email/push in backlog)
- Lead urgency logic: flagged when 2+ of 4 conditions are true (warmth, recency, intent, SLA)

---

## [2026-04-21] — Phase 1 Scaffolding Begins

### Added
- Next.js 16 project initialized with App Router, TypeScript, Tailwind CSS v4, ESLint
- `src/` directory structure in place
- `package.json` — name: echon, Next.js 16.2.4, React 19
- Build confirmed clean (static prerender passes, TypeScript passes)

---

## [2026-04-21] — Blocked Tasks Tracker

### Added
- `_project/URGENT.md` — new file for urgent tasks stalled on external blockers
- Meta Graph API logged as first urgent item: critical dependency, requires Meta
  app review before production DM access is granted
- CLAUDE.md updated to include URGENT.md in the required reading list

---

## [2026-04-21] — Role Terminology Correction & RLS Decision

### Changed
- Corrected role definitions across ARCHITECTURE.md, CLAUDE.md, PROGRESS.md, and DECISIONS.md:
  - **Admin** now correctly refers to the Echon developer's internal platform dashboard.
  - **Client** now correctly refers to the paying end user of the application.
  - Previous definitions ("Admin = agency owner", "Client = limited viewer, no AI config") are
    obsolete and removed.
- Added "workspace owner vs. team member" as an acknowledged future distinction within the Client
  role — explicitly deferred and out of scope until post-MVP.

### Added
- ARCHITECTURE.md: new **Data Isolation** subsection documenting RLS requirement, Client
  workspace scoping, and prohibition on Client session impersonation.
- DECISIONS.md: new entry logging both the terminology correction and the RLS decision with rationale.
- CLAUDE.md: added rules for RLS requirement, Hybrid as default mode on first load, and Auto-mode
  send-box lock behavior.

### Decisions
- RLS (Postgres Row-Level Security) is mandatory on every Supabase table holding Client-scoped
  data. Must be in place from the first migration — never deferred.
- No cross-Client data access is permitted under any circumstance.
- Impersonation of Client sessions is prohibited. Structured logging and opt-in diagnostics are
  the approved debugging alternatives.

---

## [2026-04-21] — Default Mode Decision

### Decisions
- New accounts default to Hybrid mode (not Auto) to prevent AI errors on real leads before the user has reviewed any output
- Global default is changeable in Settings → AI Configuration
- Mode can also be switched from the Messages tab segmented bar
- Per-conversation overrides remain available at all times
- Onboarding Step 6 now surfaces a notice explaining the Hybrid default
