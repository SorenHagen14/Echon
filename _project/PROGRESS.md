# Echon — Progress Tracker

## Current Phase
**Phase 6 — Dashboard + Cases MVP, foundation tight as of 2026-05-07.**

The "client app" surface has substantially shipped. Top nav order is now
**Dashboard · Cases · Calls · Customers · Schedule · Settings**. Phase 4
(Vapi webhook DB writes + Inngest post-call job) is still explicitly
held until pilot intake — the local data model is solid enough that
flipping to live Vapi data is now mostly a webhook-handler exercise.

**Where we are (2026-05-07):**

- **`/schedule` shipped end-to-end (2026-05-07).** Google-Calendar-style
  week grid, RLS-scoped, sourced from the case → technician relationship.
  Pill-row operator filter (`All` default, plus `Unassigned`). Prev /
  Today / Next via `?week=`. Day · Week · Month switcher with only Week
  active. Block click opens the case in a modal (`?case=<id>`). New
  in-page Settings tab + Settings → Schedule both write the same row
  (`workspace_settings.week_start`, `schedule_time_range`).

- **Cases concept shipped end-to-end.** A "case" is one issue for one
  customer that can span multiple calls and appointments. Each case has
  three nullable role slots: `cs_rep_id`, `technician_id`,
  `manager_id`. New routes: `/cases` (list, defaults to Open) and
  `/cases/[id]` (detail). Auto-assign uses deterministic logic
  (eligibility flags + scheduling-conflict check + per-role priority
  1–10). Confirmation dialog. Per-case **Recommended action** now lives
  on the case (not per call) — Haiku call aggregates every call's
  transcript + summary into one operator briefing. Merge-cases dialog
  for fixing AI mis-grouping.
- **Modal pattern consolidated.** Customers AND calls open in
  URL-driven modals (`?customer=<id>`, `?call=<id>`). Standalone pages
  exist for direct links and refresh; both render a shared body so the
  modal and page can never drift. CustomerLink + CallLink each clear
  the other's param so only one modal is open at a time. Modals
  mounted once in `(app)/layout`. Wide rollout — every "click a call"
  or "click a customer name" anywhere goes through the modal.
- **`(app)/` route group** holds every authed surface
  (`dashboard/`, `cases/`, `calls/`, `customers/`, `settings/`) under
  one shared layout (auth gate + TopNav + both modals).
- **Settings → Team** with eligibility checkboxes (Customer service /
  Technician / Manager), per-role priority 1–10 (default 5, only shown
  for checked roles), color picker. Free-text Role field was removed
  — eligibility flags are the single source of role information; the
  team list shows pills derived from them. The DB column
  `operators.role` still exists but is unused (left for now; harmless).
- **Customer profile modal** — full profile (notes, equipment,
  history) rendered as an overlay everywhere a customer name is
  clicked. Standalone `/customers/[id]` stays for direct links.
- **Call detail body** — transcript, summary, extracted fields,
  flag-for-review, recording slot. Recommended action is gone from
  this body (moved to case level). View-case link in the header meta
  row when the call belongs to a case.

**Migrations applied to Supabase:** 001–012. **013 pending apply.**
- 010: operators table
- 011: cases table + `calls.case_id`/`appointments.case_id`,
  drops `appointments.assigned_operator_id`, adds operator
  eligibility booleans + per-role priorities
- 012: `cases.recommended_action` + backfill, drops
  `calls.recommended_action`
- 013 (pending): `workspace_settings.week_start` + `schedule_time_range`
  for the /schedule calendar preferences

**Next session (recommended order):**

1. **Phase 4 webhook DB writes + Inngest post-call job** — the data
   model is now ready. Webhook receiver exists at
   `src/app/api/webhooks/vapi/route.ts` but currently only verifies
   signatures and skips DB writes. Needs:
   - Upsert `calls` row on `status-update` events (call `ensureCaseForCall` after insert)
   - Insert `call_events` rows for transitions
   - Inngest job triggered by `end-of-call-report`: Anthropic Sonnet
     extracts structured fields from transcript, updates `customers`,
     writes `calls.summary` + `outcome`, links the appointment if
     booked, fires after-hours notifications.
2. **Voice tool handlers** — `src/app/api/voice/tools/` for
   `lookup_customer` / `check_availability` / `book_appointment` /
   `escalate_to_human` / `transfer_call`.

**Still parked (see BACKLOG):**
- Step 10 Google Calendar OAuth (GCP verification blocked — see URGENT.md)
- Step 11 number-provisioning polish (area-code coverage + geocoding)
- Concierge call scheduler embed
- Notify operators on case assignment (email + SMS) — needs SMTP + SMS
- Role-based workspace access (Manager / CSR / Tech invites)
- Theme switcher in Settings → Appearance
- Realtime dashboard updates
- Subscription tiers + gating "Recommended action"
- Beta-test outreach — car detailing buddy

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

### Phase 3 — Schema reset ✅ (applied 2026-05-04)

- [x] Write `db/migrations/004_pivot_to_voice.sql` and mirror to
      `supabase/migrations/20260501120000_pivot_to_voice.sql`
- [x] Apply: `npx supabase db push` (single transaction; rolled back
      cleanly when constraint violations surfaced during the
      onboarding-v2 work)
- [x] Verify: signup → onboarding flow works end-to-end with the new
      schema (the `handle_new_workspace` trigger provisions both
      `workspace_settings` and `agent_configs`)
- [x] Follow-on migrations applied today:
  - 005 (`onboarding_v2.sql`) — Step 9 sub-flow columns + per-vertical
    catalog support + phone_numbers source enum
  - 006 (`add_business_type.sql`) — recreated business_type enum +
    columns; widened onboarding_step to 1..12

What the migration does:

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
2. Drop old enum types (`business_type`, `offer_type`, `win_outcome`,
   `referral_source`)
3. Create new enum types (`call_direction`, `call_outcome`,
   `urgency_level`, `appointment_status`, `after_hours_mode`,
   `phone_number_status`, `integration_provider`, `integration_status`)
4. Create new tables
5. Create indexes (workspace_id on every table; phone E164 lookup;
   call started_at desc; appointment scheduled_for; partial index on
   processing calls; partial index on customer-linked calls)
6. Enable RLS + create policies for each new table
7. Update `handle_new_workspace` trigger to also provision the
   `agent_configs` row alongside `workspace_settings`

### Phase 4 — Vapi integration (onboarding portion ✅ 2026-05-04)

Done — onboarding-blocking surface:
- [x] `src/lib/voice/` — `VoiceProvider` interface + Vapi adapter via REST.
      App code imports `voice` from `@/lib/voice` only.
- [x] `src/app/api/webhooks/vapi/route.ts` — webhook receiver with
      timing-safe header verification (`x-vapi-secret`). Routes
      `status-update`, `end-of-call-report`, `tool-calls`. Test calls
      flagged via `metadata.test=true` skip DB writes.
- [x] Onboarding Steps 4-8 + Step 9 sub-steps 1-3 sync the assistant to
      Vapi on save (`src/app/onboarding/_voice-sync.ts`). Soft-fails
      logged but don't block the wizard. Defensive `agent_configs` upsert
      in `saveAndAdvance` covers workspaces without trigger-provisioned
      rows.
- [x] Step 9 sub-step 4 in-browser test call via `@vapi-ai/web` — live
      WebRTC, transcript, confetti on end. (`_components/TestCallButton.tsx`)
- [x] Step 11 number provisioning — single-button "Get my number" claims
      a Vapi-managed Twilio number in the requested area code, attaches
      it to the assistant, inserts `phone_numbers` row. Surfaces Vapi's
      area-code hint on rejection.
- [x] Dev-only "Skip to dashboard" button in onboarding layout (TEST_MODE
      gated) for fast iteration.

Still to land (non-blocking for Phase 6 dashboard work):
- [ ] `src/app/api/voice/tools/` — function-call handlers invoked mid-call:
  - `lookup_customer` — phone lookup, returns existing record or null
  - `check_availability` — calendar availability for a date range
  - `book_appointment` — creates appointment + GCal event
  - `escalate_to_human` — fires SMS/push to on-call; returns ack
  - `transfer_call` — Vapi live transfer to on-call number
- [x] Webhook DB writes (2026-05-07, **verified end-to-end with a real
      Vapi call**): upserts `calls` row on `status-update` (workspace
      resolved via `phone_numbers.e164_number = callee_phone`, customer
      linked via `customers.primary_phone`), inserts `call_events` per
      event, attaches the call to a case via a service-role variant of
      `ensureCaseForCall`. `end-of-call-report` writes `ended_at`,
      `duration_sec`, `recording_url`, `transcript`, `cost_cents`, and
      the raw payload. Outcome stays at `processing` until the Inngest
      summarization job lands. Service-role client at
      `src/lib/supabase/service.ts`. Required env vars:
      `SUPABASE_SERVICE_ROLE_KEY`, `VAPI_WEBHOOK_SECRET`. Vapi-side
      config: Server URL = `<domain>/api/webhooks/vapi` + custom HTTP
      header `x-vapi-secret: <same value as VAPI_WEBHOOK_SECRET>` (Vapi
      doesn't have a built-in "Server URL Secret" field — you add it
      via the Headers section).
- [x] Post-call processing (2026-05-07): Haiku extracts `summary`,
      `outcome`, `urgency`, `service_address`, `service_requested`,
      `system_type`, customer name, appointment time/duration, and a
      `flagged_for_review` flag from the transcript. Wired via Next's
      `after()` so it runs post-200 without blocking Vapi. Lives at
      `src/server/process-call-end.ts` + `src/lib/ai/post-call.ts`.
      Pure orchestration design — easy to lift into a real Inngest
      function later if/when retry/observability matter.
      **Not yet:** notifications (after-hours alerts, escalation acks)
      — needs SMTP + SMS infra. Tracked separately.
  - Anthropic Sonnet extracts structured fields from transcript
  - Updates `customers`, writes `calls.summary` + `outcome`, links
    appointment if booked
  - Fires notifications (after-hours alerts, escalation acks)
- [ ] Number provisioning polish (BACKLOG): geocode `business_address`
      to default area code; decide Vapi-managed vs BYO Twilio for full
      area-code coverage

### Phase 5 — Onboarding v2 ✅ substantially complete (2026-05-04)

Wizard rewritten end-to-end. Account creation moved OUT of the wizard
(`/signup` is its own page). Per-vertical service catalogs added so the
flow is usable for any service business (narrow-then-wide). New flow:

1. Welcome (7-min copy)
2. Where did you hear about us? *(new — referral source)*
3. What kind of business? *(new — narrow-then-wide infrastructure)*
4. Business info
5. Services offered *(per-vertical catalog driven by Step 3)*
6. Business hours *(timezone dropdown)*
7. After-hours *(messages-only / escalate)*
8. Quote rules
9. Build your agent *(sub-flow with side panel + Phase 4 test placeholder)*
10. Calendar connect *(Phase 4 placeholder)*
11. Number provisioning *(Phase 4 placeholder)*
12. You're all set *("Go answer every call.")*

Done:
- [x] Migrations 005 + 006 applied (Step 9 sub-flow columns, business_type
      enum, phone_numbers source enum)
- [x] All 12 step components built and wired
- [x] `saveAndAdvance` populated with per-step Zod schemas + writes to
      `workspaces` (Steps 2, 3) and `agent_configs` (Steps 4-8)
- [x] `saveAgentBuilderSubStep` action for the Step 9 sub-flow with
      `builder_substep` resume tracking
- [x] Test mode (`NODE_ENV !== 'production'`) loosens required-field
      validation in dev with a banner
- [x] Back navigation between steps + between sub-steps in Step 9
- [x] Wireframe `_wireframes/onboarding.md` rewritten for v2

Phase-4-blocked (placeholders shipped, real integration deferred):
- [ ] Step 9 sub-step 4: in-browser WebRTC test call (needs Vapi)
- [ ] Step 10: real Google OAuth + calendar picker (needs GCP + verified
      consent screen)
- [ ] Step 11: real Vapi number-buying + Calendly-style scheduler embed
- [ ] Steps 4-8 propagating to a Vapi assistant on save (needs Vapi)

### Phase 6 — Dashboard MVP (in progress 2026-05-04)
Wireframes in `_wireframes/`: `dashboard.md`, `call_log.md`,
`call_detail.md`, `voice_agent_config.md`, `settings.md`.

Done:
- [x] Top nav component (`Dashboard · Calls · Schedule · Settings`,
      centered) — `src/app/_components/TopNav.tsx`
- [x] Auth-gated dashboard layout — `src/app/dashboard/layout.tsx`
      (redirects unauthed → `/login`, unfinished-onboarding → wizard)
- [x] Theme provider (`next-themes`, default = system) at root
- [x] Sign-out action
- [x] `/dashboard` Section 4 — Recent calls (last 10, server-rendered
      with customer joins, outcome badges, empty state)
- [x] TEST_MODE seeder (`seedFakeCalls` / `clearFakeCalls`) — 10 mixed
      calls + 3 customers, tagged for safe cleanup
- [x] Functional Refresh button on dashboard

To do:
- [x] `/dashboard` Section 1 — Metrics tiles (calls handled / appointments
      booked / new customers) with sparkline + conversion bars + ratio
      bars + delta badges, window picker dropdown — 2026-05-05
- [x] `/dashboard` Section 3 — Upcoming appointments (today + tomorrow,
      grouped headers, max 8) — 2026-05-05
- [x] `/dashboard` Section 2 — Needs attention list (flagged > escalated >
      repeat caller > quote-requested, deduped by phone, max 5) — 2026-05-05
- [x] `/dashboard` Needs attention — per-row "Resolved" button to dismiss
      hallucinated/already-handled items (call stays in Recent Calls + detail);
      resolves all calls from same caller_phone in 14d window — 2026-05-05
- [x] `/calls/[id]` — call detail: header + 2-col body, summary
      bullets, extracted fields table, linked appointment, flag-for-review
      action. Transcript + recording slots ship as empty states until
      Phase 4 webhooks populate them (2026-05-05)
- [x] `/calls` — basic table view (last 50, newest first, all wireframe
      columns) shipped 2026-05-05. Filters / search / CSV export still TODO
- [x] `/schedule` — Google-Calendar-style week view, operator pill filter,
      week nav, case-modal-on-block-click, in-page Settings tab synced
      with Settings → Schedule (2026-05-07)
- [ ] `/settings` — 9 sections per `_wireframes/settings.md` (Account ✅,
      Voice agent ✅, Business hours ✅ 2026-05-08, Services & pricing ✅
      2026-05-08, After-hours & escalation, Integrations, Notifications,
      Team ✅, Billing) + Theme/Appearance picker. Both new sections write
      to `agent_configs` and re-sync the Vapi assistant on save.
- [ ] When 2nd authed route lands: lift `dashboard/layout.tsx` auth gate
      into a route group `(app)/` so all four routes share it
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
