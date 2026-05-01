# Echon — Progress Tracker

## Current Phase
**Pivot Phase 2 complete (2026-05-01). Phase 3 (schema reset) is next.**
Product pivoted from Instagram DM setter to AI voice receptionist for HVAC
on 2026-05-01 (see [[DECISIONS]]). Phases 0-2 complete; Phase 3 has not
started. Code currently compiles clean (`tsc --noEmit` passes), but the
database still holds the pre-pivot schema (workspace_settings columns,
offers, dm_examples, wins, referral_source). No code references those
tables anymore — they get dropped in Phase 3.

---

## Pivot Phases (post-2026-05-01)

### Phase 0 — Decision lock & backlog archive ✅ (2026-05-01)
- [x] DECISIONS.md updated: pivot to HVAC voice receptionist, Vapi telephony,
      VoiceProvider abstraction, stack unchanged
- [x] BACKLOG.md: all 12 pre-pivot items moved to "Archived — pre-pivot
      direction" section

### Phase 1 — Doc rewrite (in progress)
- [x] ARCHITECTURE.md rewritten — voice stack, Vapi, modules, directory map,
      data flow
- [x] WORKFLOWS.md rewritten — WF-01 (book), WF-02 (quote request),
      WF-03 (after-hours triage)
- [x] PROGRESS.md rewritten (this file)
- [x] URGENT.md rewritten — Meta items archived, new pre-pilot blockers
- [x] Wireframes rewritten: dashboard, onboarding, settings; deleted:
      conversation_view, crm_lead_record; added: call_log, call_detail,
      voice_agent_config
- [x] CLAUDE.md updated — drop Manual/Hybrid/Auto + Messages tab; add
      HVAC + Vapi rules; new top nav

### Phase 2 — Code deletion ✅ (2026-05-01)
- [x] Deleted `src/app/api/webhooks/meta/` (Meta webhook receiver)
- [x] Deleted DM-specific onboarding step forms: `Step2BusinessForm`,
      `Step3OfferForm`, `Step4AvatarForm`, `Step5PainPointForm`,
      `Step6BrandVoiceForm`
- [x] Slimmed `src/app/onboarding/_constants.ts` — `TOTAL_STEPS` bumped to
      12; new HVAC step labels + overlay messages; DM-era enums
      (`BUSINESS_TYPE_OPTIONS`, `OFFER_OPTIONS_BY_BUSINESS`,
      `TONE_TAG_OPTIONS`, demographic enums) all removed; `SKIPPABLE_STEPS`
      now `{9}` (Calendar)
- [x] Slimmed `src/app/onboarding/actions.ts` — removed all DM-specific Zod
      schemas + Step 2-6 save branches. `saveAndAdvance` retained as a
      cursor-only scaffold (Step 1 uses it for the overlay UX); Phase 5
      will populate the per-step `switch` for Steps 3-11. `advanceStep`
      uses `TOTAL_STEPS` constant.
- [x] Rewrote `src/app/onboarding/[step]/page.tsx` — Step 1 has real
      content (Welcome); Steps 2-12 render placeholder with Continue (and
      Skip on Step 9). All imports of deleted forms removed.
- [x] Slimmed `src/app/dashboard/actions.ts` — `resetOnboarding` reduced to
      a cursor-only reset (no longer touches dropped columns/tables)
- [x] Updated `src/app/dashboard/page.tsx` copy
- [x] Verified: grep for DM-era identifiers in `src/` returns nothing;
      `tsc --noEmit` passes
- [x] `package.json` audit: no Meta SDK was actually a dep — nothing to
      remove. Deps unchanged.
- [x] `Manual/Hybrid/Auto` and Messages-tab: never made it into code, so no
      removal needed (they only existed in pre-pivot wireframes/docs)

**Files preserved as-is in Phase 2** (not pivoted yet, will be reshaped in
later phases): auth flow (`src/app/(auth)/`), middleware, Supabase clients
(`src/lib/supabase/`), root layout + page, onboarding shell components
(progress bar, overlay, confetti, submit button, step shell),
`Step1Welcome.tsx`, dashboard placeholder.

### Phase 3 — Schema reset (not started — NEXT UP)
Write a single migration `004_pivot_to_voice.sql` that does the swap
cleanly. Pre-launch, so destructive changes are safe.

**Drop** (from migrations 001 + 002):
- Tables: `offers`, `dm_examples`, `wins` (+ any leads/conversations/
  messages/warmth_scores tables if present in 001 — verify by inspecting
  `db/migrations/001_initial_schema.sql` first)
- Columns on `workspaces`: `referral_source`, `referral_source_other`
- Columns on `workspace_settings`: `business_type`, `business_type_other`,
  `avatar_description`, `avatar_demographics`, `avatar_channels`,
  `avatar_notes`, `primary_pain`, `tried_solutions`, `cost_of_inaction`,
  `tone_tags`, `tone_description`, `wins_nag_dismissed`
  (Keep: `onboarding_completed` — still relevant)

**Add** (all RLS-scoped to client workspace):
- `customers` — id, workspace_id, name, phone, email, address, notes,
  timestamps
- `phone_numbers` — provisioned Vapi/Twilio numbers per workspace
  (workspace_id, e164_number, vapi_number_id, status, created_at)
- `calls` — id, workspace_id, customer_id (nullable), vapi_call_id,
  direction, started_at, ended_at, duration_sec, recording_url,
  transcript (jsonb), summary (text), outcome (enum), cost_cents
- `call_events` — call_id, event_type, payload (jsonb), occurred_at
  (structured tool-call traces + state transitions)
- `agent_configs` — workspace_id (1:1), vapi_assistant_id, agent_name,
  voice_preset, tone, greeting, system_prompt_addendum, services (jsonb),
  business_hours (jsonb), after_hours_mode (enum), oncall_numbers (jsonb),
  quote_rules (jsonb), recording_enabled (bool), all the per-call behavior
  toggles from `_wireframes/voice_agent_config.md`
- `appointments` — id, workspace_id, customer_id, call_id, service_type,
  scheduled_for, duration_min, status, gcal_event_id, notes
- `integrations` — workspace_id, provider (enum: google_calendar, jobber,
  housecall_pro, ...), oauth_tokens (jsonb encrypted), config (jsonb),
  status, connected_at

**RLS policies** on every new table from migration day one. No exceptions.

**Order of operations** (the migration runs in one transaction):
1. Drop old tables / columns
2. Create new tables
3. Create indexes (workspace_id on every table; phone E164 lookup;
   call started_at desc)
4. Enable RLS + create policies for each table

### Phase 4 — Vapi integration (not started)
**Prerequisite:** Vapi account + test number provisioned. See [[URGENT]]
— this becomes a hard blocker the moment Phase 4 starts.

- [ ] `src/lib/voice/` — `VoiceProvider` interface + Vapi adapter. App
      code never imports the Vapi SDK directly; goes through this layer.
- [ ] `src/app/api/webhooks/vapi/route.ts` — call lifecycle webhook
      (status updates + end-of-call reports)
- [ ] `src/app/api/voice/tools/` — function-call handlers invoked
      mid-call by the agent:
  - `lookup_customer` — phone lookup, returns existing record or null
  - `check_availability` — calendar availability for a date range
  - `book_appointment` — creates appointment + GCal event
  - `escalate_to_human` — fires SMS/push to on-call; returns ack
  - `transfer_call` — Vapi live transfer to on-call number
- [ ] Inngest job: post-call processing
  - Anthropic Sonnet extracts structured fields from transcript
  - Updates `customers`, writes `calls.summary` + `outcome`, links
    appointment if booked
  - Fires notifications (after-hours alerts, escalation acks)

### Phase 5 — HVAC-shaped onboarding (not started)
Rewrite wizard per `_wireframes/onboarding.md` (12 steps).

- [ ] Build the 11 new step forms (Step 2 = account creation; Steps 3-11
      land in `src/app/onboarding/_steps/`)
  - Step 2: Account creation (email/password + Google OAuth)
  - Step 3: Business info (name, phone, service area, address)
  - Step 4: Services offered (multi-select with book-direct toggle +
    pricing note per service)
  - Step 5: Business hours (day × hours grid + timezone)
  - Step 6: After-hours behavior (3-option radio + on-call numbers)
  - Step 7: Quote rules (toggles + free-text custom rules)
  - Step 8: Voice agent persona (name, voice, tone, greeting + preview)
  - Step 9: Calendar connect (Google OAuth — skippable)
  - Step 10: Number provisioning (claim a Vapi/Twilio number)
  - Step 11: Test call (live wait + transcript + outcome)
  - Step 12: All set (status checklist + finale)
- [ ] Populate `saveAndAdvance` in `actions.ts` with per-step Zod schemas +
      writes to `agent_configs` (and `phone_numbers` for Step 10,
      `integrations` for Step 9)
- [ ] Steps 3-8: every save also propagates relevant fields to the Vapi
      assistant (debounced ~3s if from Settings; immediate from onboarding)
- [ ] Step 11 test-call: server-rendered live status using Supabase
      realtime on the `calls` table
- [ ] Update `[step]/page.tsx` to render real forms instead of the Phase 2
      placeholder

### Phase 6 — Dashboard MVP (not started)
Wireframes in `_wireframes/`: `dashboard.md`, `call_log.md`,
`call_detail.md`, `voice_agent_config.md`, `settings.md`.

- [ ] `/dashboard` — 4-tile snapshot, needs-attention list, upcoming
      appointments, recent calls (Supabase realtime updates)
- [ ] `/calls` — sortable filterable call log with outcome badges + search
- [ ] `/calls/[id]` — call detail: transcript with tool-call highlights,
      extracted fields panel (editable), recording player, action buttons
      (Edit fields / Flag for review / Call back)
- [ ] `/schedule` — calendar/list view of upcoming appointments + linked
      customer/call records
- [ ] `/settings` — 9 sections per `_wireframes/settings.md`: Account,
      Voice agent, Business hours, Services & pricing, After-hours &
      escalation, Integrations, Notifications, Team (placeholder), Billing
- [ ] Top nav component: `Dashboard · Calls · Schedule · Settings`
- [ ] Verified: real test call from a pilot HVAC shop produces the right
      data on every screen

---

## Carryover from pre-pivot (still valid)
Reusable scaffolding that survives the pivot:
- [x] Next.js + App Router project structure
- [x] Supabase project + Auth (email/password + Google OAuth)
- [x] Multi-tenant RLS pattern
- [x] Vercel deployment (https://echon-eight.vercel.app)
- [x] GitHub repo + initial commit
- [x] Onboarding wizard shell — `/onboarding/[step]` dynamic route, progress
      bar, step-complete overlay, advance-step server action, middleware
      resume/skip-ahead/replay guards (Steps 1-6 form fields wired)
- [x] Migrations 001-003 applied (auth + workspaces + signup-trigger fix)
- [x] /dashboard stub page

## State of the repo at end of Phase 2 (2026-05-01)
For a fresh Claude session picking this up cold:

- **Branch:** main (pivot work uncommitted as of writing — see `git status`)
- **Builds:** `npx tsc --noEmit` clean. Dev server should start fine.
- **Live URL:** https://echon-eight.vercel.app (pre-pivot — do not deploy
  current state until at least Phase 3 lands; Phase 2 alone leaves the
  database holding orphan DM-era columns/tables that the new code doesn't
  reference)
- **Database state:** migrations 001-003 applied. Pre-pivot schema still
  present (workspace_settings columns, offers/dm_examples/wins tables,
  referral_source columns). Phase 3 is the migration that drops these +
  adds the voice schema.
- **Code state:** auth + onboarding shell + Step 1 welcome work.
  Steps 2-12 render a placeholder. `/dashboard` is a stub. No Vapi /
  Calendar / voice code yet — that's Phase 4.
- **Env vars in Vercel** (pre-pivot, some now obsolete): `META_*` vars are
  unused by current code. Don't delete them yet — Phase 4 setup will add
  `VAPI_*`, `GOOGLE_*`, `ANTHROPIC_API_KEY` (if not already), and we can
  clean Meta vars then.

## Action Items — 2026-05-01 (post-pivot)
- [ ] Configure custom SMTP for transactional email (Resend / Postmark /
      SendGrid) — still relevant; transactional email needs to come from
      Echon's domain before launch
- [ ] Set up Inngest for background jobs (was open pre-pivot; now needed
      for Phase 4 post-call processing)
- [ ] Configure Tailwind CSS v4 (verify scaffolded setup is correct)
- [ ] Rename `src/middleware.ts` → `src/proxy.ts` per Next.js 16 deprecation
- [ ] Resolve duplicate lockfile warning (set `turbopack.root` in
      `next.config` or remove stray `~/package-lock.json`)
- [ ] Add `.obsidian/` and `.claude/settings.local.json` to `.gitignore`
- [ ] Decide whether to amend initial commit author identity
- [ ] Create Vapi account and provision test number (Phase 4 prerequisite —
      see [[URGENT]])
- [ ] Set up Google Cloud project for Calendar OAuth + submit consent screen
      for verification (Phase 4 prerequisite — see [[URGENT]])

---

## Archived — pre-pivot action items
The full pre-pivot history is preserved in git. The action items below were
the active task list for the Instagram DM setter product as of 2026-04-23.
They are archived here for context only.

<details>
<summary>Pre-pivot action items (2026-04-21 through 2026-04-23)</summary>

### 2026-04-21
- [x] Replace Next.js boilerplate; build Supabase Auth flow; define schema;
      RLS on all Client-scoped tables; audit onboarding for stale role terms
- [ ] Audit `_wireframes/settings.md` for stale Admin/Client role terminology
      *(now obsolete — settings.md fully rewritten in Phase 1)*
- [ ] Submit Meta Developer App for review *(obsolete — pivot)*

### 2026-04-22
- [x] Onboarding 2b.1 components; advanceStep server action; middleware
      guards; /dashboard stub; Meta webhook receiver; Vercel deploy; webhook
      configured in Meta dashboard
- [ ] Step 8 IG OAuth scaffold *(obsolete — pivot)*
- [ ] Wireframe Developer Panel *(deferred — still potentially useful, but
      not in Phase 2-6 scope)*
- [ ] Privacy Policy + Data Deletion endpoints for Meta App Review *(obsolete)*
- [ ] Build IG Login OAuth + long-lived token exchange *(obsolete — pivot)*

### 2026-04-23
- [x] Migration 003 signup trigger fix; Onboarding 2b.2 form fields + zod;
      StepCompleteOverlay wiring; Step 1 welcome semantics
- [ ] Onboarding 2b.3 (WinEntry, IG OAuth, referral grid, finale,
      WinsNagBanner) *(IG OAuth obsolete; the rest are obsolete because the
      onboarding wizard is being rewritten for HVAC in Phase 5)*

</details>

---

## Notes for Claude
- Stack: Next.js (App Router) + Supabase + Anthropic API + Inngest + Vercel
  + **Vapi** (telephony). Locked — see [[DECISIONS]].
- Vertical: **HVAC** (independent shops, 3-15 trucks). Other blue-collar
  verticals are explicit future expansion, not MVP scope.
- Read all `_wireframes/` before building UI. Wireframes were rewritten
  2026-05-01 — old ones (conversation_view, crm_lead_record) are deleted.
- Top nav: **Dashboard · Calls · Schedule · Settings**.
- All Vapi access goes through `src/lib/voice/` (`VoiceProvider` interface).
  Application code never imports the Vapi SDK directly.
- RLS on every Client-scoped table from migration day one.
- Update this file whenever a phase or task is completed.
- Log meaningful changes to `docs/CHANGELOG.md` with date + description.
