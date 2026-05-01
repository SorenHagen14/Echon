# Echon — Changelog

All meaningful changes to the project are logged here.

---

## [2026-05-01] — Phase 3 follow-up: OAuth tokens via Supabase Vault

Updated migration 004 (still unapplied) to store OAuth tokens encrypted in
Supabase Vault rather than plain-text columns. Done as an in-place edit
since the migration hasn't been applied yet — keeps the change history
clean (no follow-up migration to apply).

### Changed in migration 004
- Added `create extension if not exists supabase_vault;` at the top
- `integrations` table: replaced `oauth_access_token text` and
  `oauth_refresh_token text` with `oauth_secret_id uuid` (pointer into
  `vault.secrets`). Tokens are stored as a JSON blob
  `{ access_token, refresh_token }` inside the vault secret.
- New trigger `integrations_delete_vault_secret` (BEFORE DELETE) removes
  the vault secret automatically when an integration row is deleted —
  prevents orphaned secrets.
- Inline comment block in the migration documents the access pattern
  (write via `vault.create_secret`, read via `vault.decrypted_secrets`).

### Security model
- `vault.decrypted_secrets` view is restricted to `postgres` /
  `service_role`. Userland (`anon` / `authenticated`) cannot decrypt
  tokens even if it bypasses RLS on `integrations`.
- All OAuth read/write happens server-side using the Supabase service
  role. Tokens are never sent to the client.
- A Supabase database compromise exposes only the `oauth_secret_id`
  uuids, not the tokens — an attacker would also need the Vault root key
  (managed by Supabase, not stored in the database).

### URGENT.md
- "Encrypt OAuth tokens" item moved from active to "Resolved" section.

---

## [2026-05-01] — Pivot Phase 3: Schema reset (migration written, not yet applied)

Wrote `db/migrations/004_pivot_to_voice.sql` (and the timestamped Supabase
mirror `supabase/migrations/20260501120000_pivot_to_voice.sql`). The
migration drops the entire DM-era schema and replaces it with the
voice-receptionist schema in a single transaction. Pre-launch — no
production data to preserve. **Not yet applied** to the database; apply
with `npx supabase db push --linked`.

### Dropped
- **Tables:** `lead_magnet_deliveries`, `lead_magnets`,
  `warmth_score_history`, `messages`, `conversations`, `leads`, `wins`,
  `dm_examples`, `offers`, `instagram_connections`
- **Enum types:** `business_type`, `offer_type`, `win_outcome`,
  `referral_source`
- **`workspaces` columns:** `referral_source`, `referral_source_other`
- **`workspace_settings` columns:** `business_type`,
  `business_type_other`, `tone_tags`, `tone_description`,
  `default_ai_mode`, `urgency_warmth_threshold`, `urgency_sla_value`,
  `urgency_sla_unit`, `notif_urgent_lead`, `notif_lead_booked`,
  `notif_ai_review`, `avatar_description`, `avatar_demographics`,
  `avatar_channels`, `avatar_notes`, `primary_pain`, `tried_solutions`,
  `cost_of_inaction`, `wins_nag_dismissed`

### Changed
- `workspaces.onboarding_step` check constraint widened from `1..10` to
  `1..12` to match the new wizard
- `handle_new_workspace` trigger now also provisions the `agent_configs`
  row when a workspace is created, alongside `workspace_settings`

### Added
- **Enum types:** `call_direction`, `call_outcome`, `urgency_level`,
  `appointment_status`, `after_hours_mode`, `phone_number_status`,
  `integration_provider`, `integration_status`
- **`workspace_settings` columns** (HVAC notification toggles, all default
  true): `notif_emergency_escalation`, `notif_quote_request_received`,
  `notif_call_flagged_review`, `notif_call_failed`
- **Tables** (all RLS-scoped to workspace via `auth_workspace_id()`):
  - `agent_configs` (1:1 with workspace) — full voice agent config
    mirroring onboarding Steps 3-8 + Settings → Voice agent: Vapi
    assistant id, business identity, services, business hours,
    after-hours mode, oncall numbers, emergency keywords, quote rules,
    voice persona, behavior toggles, recording settings
  - `phone_numbers` — provisioned Vapi/Twilio numbers per workspace
    (e164 unique, status, area code, provisioned/released timestamps)
  - `customers` — name, primary/secondary phone, email, address, notes
    (indexed by workspace_id and primary_phone for `lookup_customer`
    tool performance)
  - `calls` — Vapi call id, direction, caller/callee phones, timing,
    recording, transcript jsonb, summary, outcome, urgency, extracted
    HVAC fields (service_address, service_requested, system_type), cost,
    raw end-of-call payload, flag-for-review fields. Indexed by
    workspace+started_at desc; partial indexes on processing calls and
    customer-linked calls.
  - `call_events` — structured trace of mid-call activity (tool
    invocations, transfers, escalations) for the call detail UI's
    inline highlights
  - `appointments` — workspace, customer, call (nullable), service type,
    scheduled_for, duration, status, gcal event id, notes
  - `integrations` — workspace + provider unique; OAuth tokens stored
    encrypted in Supabase Vault (`oauth_secret_id uuid` pointer into
    `vault.secrets`); `oauth_expires_at`, config jsonb, status,
    last_error. A BEFORE DELETE trigger removes the vault secret
    automatically when an integration row is deleted.

### Pending
- Run `npx supabase db push --linked` to apply
- After apply: verify signup end-to-end (trigger now creates 2 rows);
  verify `agent_configs` exists for any pre-existing test workspaces
  (the migration does NOT backfill — see "Caveats" below)

### Caveats
- **No backfill of existing workspaces.** The trigger only fires on
  *new* workspace inserts. Any test workspace created before this
  migration applies will not have an `agent_configs` row. For pre-launch
  this is fine (just delete the test user and resignup), but if real
  pilot users exist before Phase 3 applies, run a one-shot:
  `INSERT INTO agent_configs (workspace_id) SELECT id FROM workspaces WHERE id NOT IN (SELECT workspace_id FROM agent_configs);`

---

## [2026-05-01] — Pivot Phase 2: Code deletion

Removed all DM-era code from `src/`. Repo now compiles clean (`tsc --noEmit`)
with the pre-pivot scaffolding (auth, onboarding shell, Supabase clients,
middleware, dashboard stub) intact and the new HVAC step constants in
place. Database still holds the pre-pivot schema — that gets reset in
Phase 3.

### Deleted
- `src/app/api/webhooks/meta/route.ts` (and the now-empty `webhooks/` /
  `api/` parent directories) — Meta Graph API webhook receiver, including
  the GET handshake + POST HMAC-SHA256 signature verification
- `src/app/onboarding/_steps/Step2BusinessForm.tsx`
- `src/app/onboarding/_steps/Step3OfferForm.tsx`
- `src/app/onboarding/_steps/Step4AvatarForm.tsx`
- `src/app/onboarding/_steps/Step5PainPointForm.tsx`
- `src/app/onboarding/_steps/Step6BrandVoiceForm.tsx`

### Changed
- `src/app/onboarding/_constants.ts` — `TOTAL_STEPS` bumped to 12; new step
  labels + overlay microcopy aligned to `_wireframes/onboarding.md`;
  removed all DM-era option enums (`BUSINESS_TYPE_OPTIONS`,
  `OFFER_OPTIONS_BY_BUSINESS`, `TONE_TAG_OPTIONS`, age/gender/location/
  income/channel option arrays); `SKIPPABLE_STEPS` now `{9}` (Calendar);
  `CONFETTI_STEPS` now `{5, 12}` (after Services + finale)
- `src/app/onboarding/actions.ts` — stripped all per-step Zod schemas
  (`Step2Schema`-`Step6Schema`) and the saveAndAdvance switch branches.
  `saveAndAdvance` retained as a cursor-only scaffold so Step 1 keeps the
  overlay UX; Phase 5 will populate the per-step switch for Steps 3-11.
  `advanceStep` references `TOTAL_STEPS` constant (was hardcoded 10).
- `src/app/onboarding/[step]/page.tsx` — Step 1 renders `Step1Welcome` as
  before; Steps 2-12 render a single placeholder with `Continue` (and
  `Skip` on Step 9). All imports of deleted forms + workspace_settings /
  offers / dm_examples reads removed.
- `src/app/dashboard/actions.ts` — `resetOnboarding` reduced to a cursor
  reset. No longer touches `business_type`, `avatar_*`, `primary_pain`,
  `tone_tags`, `dm_examples`, `wins`, `referral_source*` (those columns
  still exist in DB until Phase 3 but no code path hits them).
- `src/app/dashboard/page.tsx` — placeholder copy updated for new top nav
  (`Calls / Schedule / Settings`); reset-onboarding tooltip rewritten

### Verified
- `grep` for DM-era identifiers (`Step[2-6]Form`, `BUSINESS_TYPE_OPTIONS`,
  `business_type`, `avatar_`, `primary_pain`, `tone_tags`, `dm_examples`,
  `referral_source`, `META_*`, `Manual.*Hybrid.*Auto`) across `src/`
  returns no matches
- `npx tsc --noEmit` passes (after `rm -rf .next` to clear stale type
  generation referencing the deleted webhook route)

### Not changed in Phase 2
- `package.json` — no Meta SDK was actually installed; deps untouched
- Auth flow (`src/app/(auth)/`), Supabase clients, middleware, root layout
  — preserved as-is for Phase 5/6 to build on
- Onboarding shell components (`OnboardingProgressBar`,
  `StepCompleteOverlay`, `StepShell`, `Confetti`, `SubmitButton`) — kept;
  reused by the new flow
- `Step1Welcome.tsx` — kept; maps directly to new Step 1
- Database schema — Phase 3 territory; migrations 001-003 still applied

### What's next
Phase 3 — schema reset. Single migration `004_pivot_to_voice.sql` that
drops the DM tables/columns and adds the voice schema (`customers`,
`phone_numbers`, `calls`, `call_events`, `agent_configs`, `appointments`,
`integrations`) with RLS policies on every new Client-scoped table. See
`_project/PROGRESS.md` for the full drop/add list.

---

## [2026-05-01] — Pivot Phases 0 + 1: Decision lock & doc rewrite

Echon pivoted from an AI Instagram DM setter (for coaches / agencies / SMMAs)
to an **AI phone receptionist for HVAC businesses**. The product now answers
inbound calls for independent HVAC shops, qualifies callers, and either books
appointments or routes to a human for a quote. Phase 0 (decision lock) and
Phase 1 (doc rewrite) of the migration are complete in this commit. Code,
schema, and dependencies are unchanged so far — those land in Phases 2-6.

### Decisions locked (DECISIONS.md)
- **Vertical:** HVAC (independent shops, 3-15 trucks). Other blue-collar
  verticals are explicit future expansion, not MVP scope.
- **Telephony provider:** Vapi (BYO-LLM, Anthropic stays as the brain).
  Wrapped behind a `VoiceProvider` interface in `src/lib/voice/` so future
  migration to LiveKit + raw providers is a known 1-2 day swap, not a
  rewrite.
- **Stack unchanged:** Next.js + Supabase + Anthropic + Inngest + Vercel.
  Roughly 40-50% of pre-pivot scaffolding (auth, RLS, onboarding shell,
  dashboard shell) carries over directly.
- The pre-pivot decision "Default AI mode = Hybrid" is marked superseded.
  Manual / Hybrid / Auto modes no longer exist.

### Docs rewritten
- `_project/ARCHITECTURE.md` — voice stack, Vapi layer, new modules, new
  directory map, new data flow (customer call → Vapi → tools → end-of-call
  webhook → Inngest summarization → CRM/appointment write)
- `_project/WORKFLOWS.md` — three workflows: WF-01 (book), WF-02 (quote
  request), WF-03 (after-hours triage)
- `_project/PROGRESS.md` — pivot phases 0-6; pre-pivot action items archived
  in collapsible details block
- `_project/URGENT.md` — Meta integration archived; new urgent items: Vapi
  account, Google Calendar OAuth verification, custom SMTP for transactional
  email
- `_project/BACKLOG.md` — all 12 pre-pivot items moved to "Archived —
  pre-pivot direction" section
- `CLAUDE.md` — updated read-list, top nav now Dashboard · Calls · Schedule
  · Settings, dropped Manual/Hybrid/Auto and Messages-tab rules, added HVAC
  vertical and Vapi abstraction rules

### Wireframes
- **Deleted:** `_wireframes/conversation_view.md`,
  `_wireframes/crm_lead_record.md`
- **Rewritten:** `_wireframes/dashboard.md` (today's call snapshot + needs-
  attention queue + upcoming appointments + recent calls);
  `_wireframes/onboarding.md` (12-step HVAC-shaped wizard ending in a real
  test call); `_wireframes/settings.md` (account, voice agent, business
  hours, services & pricing, after-hours, integrations, notifications,
  team, billing)
- **Added:** `_wireframes/call_log.md` (filterable call list at /calls);
  `_wireframes/call_detail.md` (transcript + extracted fields + recording
  player at /calls/[id]); `_wireframes/voice_agent_config.md` (Settings →
  Voice agent detail page)

### What's next
Phase 2 (code deletion: Meta webhook, IG-shaped tables, DM-specific
onboarding sections) is queued. See `_project/PROGRESS.md` for the full
phase list.

---

## [2026-04-24] — Onboarding 2b.2: Real Form Fields (Steps 1–6)

Wired real form content and server-side validation for onboarding Steps 1–6. The `StepCompleteOverlay` is now live — it fires on every Continue click with the microcopy from the wireframe, then navigates to the next step after 1.2 s.

### Added
- `zod` dependency — server-side FormData validation for all step save actions
- `src/app/onboarding/actions.ts`:
  - `StepResult` type exported for client form state typing
  - `saveAndAdvance` server action — validates, saves, and returns `{ ok, nextStep, message }` (no server-side redirect; client handles navigation after overlay)
  - Per-step Zod schemas inlined (Step2–Step6); Step1 is cursor-advance only
- `src/app/onboarding/_components/SubmitButton.tsx` — shared submit button using `useFormStatus` to disable during pending state
- `src/app/onboarding/_steps/` directory:
  - `StepShell.tsx` — shared overlay + `router.push` wrapper; fires overlay on `state.ok`, navigates on dismiss
  - `Step1Welcome.tsx` — personalised welcome screen (repurposes "Account Creation" step; account already exists at this point)
  - `Step2BusinessForm.tsx` — business type card grid + conditional "Describe your type" text input
  - `Step3OfferForm.tsx` — offer type card grid (filtered by business_type) + optional offer URL; free-text mode when business_type = other
  - `Step4AvatarForm.tsx` — avatar description (required) + demographic pill selectors (age, gender, location, income) + channel pills + notes
  - `Step5PainPointForm.tsx` — primary pain textarea (required) + tried solutions + cost of inaction
  - `Step6BrandVoiceForm.tsx` — tone tag multi-select (max 3, disables unchosen when full) + voice description + 3 DM example textareas

### Changed
- `src/app/onboarding/[step]/page.tsx` — server component now fetches step-specific data and renders the correct form component for Steps 1–6; Steps 7–10 keep the 2b.1 placeholder
- `src/app/onboarding/_components/StepClientPieces.tsx` — stripped down to confetti-only; inert overlay reference removed (overlay lives in StepShell now)
- `src/app/onboarding/_constants.ts` — added `OVERLAY_MESSAGES`, `OVERLAY_MESSAGES_SKIP`, and all data constants for Steps 2–6 (BUSINESS_TYPE_OPTIONS, OFFER_OPTIONS_BY_BUSINESS, AGE_RANGE_OPTIONS, GENDER_OPTIONS, LOCATION_OPTIONS, INCOME_OPTIONS, CHANNEL_OPTIONS, TONE_TAG_OPTIONS)

### Data saved per step
| Step | Table(s) | Columns |
|------|----------|---------|
| 1 | — | (welcome only — no new data) |
| 2 | workspace_settings | business_type, business_type_other |
| 3 | offers | offer_type, offer_type_other, offer_url (delete+insert) |
| 4 | workspace_settings | avatar_description, avatar_demographics (jsonb), avatar_channels (text[]), avatar_notes |
| 5 | workspace_settings | primary_pain, tried_solutions, cost_of_inaction |
| 6 | workspace_settings + dm_examples | tone_tags, tone_description; dm_examples cleared + reinserted |

### Verified
- `npm run build` passes — TypeScript + all 10 onboarding routes collected

### Out of Scope (reserved for 2b.3)
- Steps 7–10 real content (WinEntry, Instagram OAuth, referral card grid, finale checklist)
- WinsNagBanner on /dashboard

---

## [2026-04-24] — Migration 003: Signup Trigger Fix

### Fixed
- `handle_new_user()` and `handle_new_workspace()` recreated with `SET search_path = public, pg_temp`
- Root cause: both functions were `SECURITY DEFINER` with `proconfig = NULL`, so they inherited the caller's search_path. GoTrue's `supabase_auth_admin` role has `rolconfig: search_path = auth`, making all unqualified references to `profiles`, `workspaces`, and `workspace_settings` (all in `public`) fail with "relation does not exist" — surfaced to the client as "Database error saving new user."
- Bug was latent since migration 001 — the auth.users table had zero rows so the trigger never successfully ran in production.

### Verified Post-Apply
- Both functions show `proconfig = {search_path=public, pg_temp}` in `pg_proc`
- End-to-end signup → onboarding shell confirmed working

### Open Follow-Up
- Custom SMTP not yet configured: confirmation emails currently send from Supabase's domain. Needs Resend, Postmark, or SendGrid wired in before launch so transactional email comes from Echon's own domain.

---

## [2026-04-23] — Onboarding Shell (Part 2b.1)

Built the onboarding plumbing layer: routing, progress bar, overlay/confetti components, middleware resume/skip-ahead/replay guards, and the step-advancement server action. Placeholder Continue buttons only — no real form content yet.

### Added
- `src/app/onboarding/` route tree:
  - `layout.tsx` — outer onboarding container
  - `page.tsx` — bare `/onboarding` redirects to `/onboarding/{onboarding_step}`
  - `[step]/layout.tsx` — wraps each step with the persistent `OnboardingProgressBar`
  - `[step]/page.tsx` — placeholder heading + Continue / Skip forms
  - `actions.ts` — `advanceStep` server action; enforces anti-skip, bumps `workspaces.onboarding_step`, and on Step 10 sets `workspace_settings.onboarding_completed = true` + redirects to `/dashboard`
  - `_constants.ts` — single source of truth for step labels, confetti steps (4, 8, 10), skippable steps (7, 8, 9)
- Components in `src/app/onboarding/_components/`:
  - `OnboardingProgressBar.tsx` — server component; proportional fill, step label
  - `StepCompleteOverlay.tsx` — client component; fade + auto-dismiss at 1200ms
  - `Confetti.tsx` — client component; one burst on mount via `canvas-confetti`, unmounts after 2s
  - `StepClientPieces.tsx` — thin client wrapper so the server step page can render Confetti + inert StepCompleteOverlay without crossing the server/client function-prop boundary
- `src/app/dashboard/page.tsx` — placeholder dashboard (replaces 404 after onboarding)
- Extended `src/middleware.ts`:
  - Incomplete onboarding + app route → redirect to `/onboarding/{onboarding_step}`
  - Completed onboarding + onboarding route → redirect to `/dashboard` (replay prevention)
  - Bare `/onboarding` → canonicalized to `/onboarding/{step}`
  - `/onboarding/{N}` where `N > onboarding_step` → redirect to current (skip-ahead guard)
- `canvas-confetti` + `@types/canvas-confetti` added to dependencies

### Verified
- `npm run build` passes (TypeScript + route collection). All 10 routes registered under `/onboarding/[step]`.

### Out of Scope (reserved for 2b.2 / 2b.3)
- Real form fields per step
- Wiring StepCompleteOverlay to fire on Continue
- WinEntry component + wins nag banner
- Instagram OAuth on Step 8

### Known Follow-Ups
- Two pre-existing warnings surfaced during build: Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` (rename task, no logic change); multiple lockfile warning from `~/package-lock.json` — setting `turbopack.root` in `next.config` or removing the stray root lockfile is the fix.

---

## [2026-04-23] — Migration 002 Applied

Migration 002 applied: onboarding enums, offers split, avatar/pain/wins columns, referral source tracking.

### Added
- Enums: `business_type`, `offer_type`, `win_outcome`, `referral_source` (derived verbatim from `_wireframes/onboarding.md` Steps 2, 3, 7, 9)
- `offers` table (split out of `workspace_settings` for future multi-offer support per [[BACKLOG]]); FK + trigger + RLS policy `offers: owner access`
- `wins` table (Step 7 data store, 1:many per workspace); FK + trigger + RLS policy `wins: owner access`
- `workspaces.referral_source`, `workspaces.referral_source_other`, `workspaces.onboarding_step` (int 1–10, default 1)
- `workspace_settings` gained: `avatar_description`, `avatar_demographics` (jsonb), `avatar_channels` (text[]), `avatar_notes`, `primary_pain`, `tried_solutions`, `cost_of_inaction`, `wins_nag_dismissed`

### Changed
- `workspace_settings.business_type` migrated from `text + CHECK` to `business_type` enum (simple cast — pre-apply checks confirmed no legacy `agency`/`creator`/`fitness` rows)
- Dropped `offer_type`, `offer_type_other`, `offer_url` from `workspace_settings` (moved to `offers` table; pre-apply check confirmed zero rows with offer data)

### Verified Post-Apply
- All 4 enums present with expected value sets and order
- All new columns on `workspaces` and `workspace_settings` present with correct types, nullability, and defaults
- `offers` and `wins` tables created with expected columns, FKs (ON DELETE CASCADE), indexes, triggers
- RLS enabled on both new tables; policies reference `auth_workspace_id()` helper from migration 001
- `onboarding_step` CHECK constraint in place (1–10)

---

## [2026-04-22] — Meta Webhook Live (end-to-end)

### Added
- `src/app/api/webhooks/meta/route.ts` — Meta webhook receiver:
  - GET: verification handshake (echoes `hub.challenge` when verify token matches)
  - POST: HMAC-SHA256 signature verification against `META_APP_SECRET` using `timingSafeEqual`
  - Payload currently logged; Inngest enqueue is the next step (see [[WORKFLOWS]] WF-01)
- Vercel deployment live at `https://echon-eight.vercel.app` — Hobby tier, GitHub integration auto-deploys on push
- Vercel env vars: Supabase keys, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
- Meta Developer Dashboard → Webhooks: callback URL + verify token verified successfully
- Field subscriptions enabled: `messages`, `messaging_postbacks`, `messaging_referral`, `messaging_seen`, `message_reactions`

### Tested
- Verification handshake returns 200 with challenge echoed
- Wrong verify token returns 403
- POST without signature returns 401

### Notes
- Webhook receiver is the first half of the Meta integration; Instagram Login OAuth flow is the
  second half and is still pending (blocks onboarding Step 8 from being fully wired).
- Production DM traffic is still blocked by Meta App Review (see [[URGENT]]).

---

## [2026-04-22] — GitHub Repo Live

### Added
- Repo created at https://github.com/SorenHagen14/Echon (private)
- Initial commit pushed: 57 files, 10,849 lines — full Phase 1 scaffolding per [[ARCHITECTURE]]
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
