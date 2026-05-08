# Echon — Changelog

All meaningful changes to the project are logged here.

---

## [2026-05-08] — Dashboard: simpler, more direct

Round of cleanup driven by "I like everything super simple and easy to read":

### Tiles
- Delta badges now color-encode direction: green for +N%, red for −N%, zinc for flat. Sign is shown explicitly (`+15%` / `−12%`).
- Removed the "new" badge (the prior=0 case). When there's nothing to compare against, no badge — the raw count is the signal.
- Sparkline + conversion bars kept; user wanted to keep the per-tile visual variety.
- Comparison window already aligns to the picker (last 7d vs the 7d before, etc.) — confirmed, no math change needed.

### Recent calls
- Cut from 10 rows to 5.
- Dropped the per-call summary bullets and duration. Each row is now one line: name · outcome badge (with appointment time when booked) · relative time.
- Customer name no longer opens the customer modal — the entire row is a CallLink to the call detail.
- Added a "View all in Calls →" link below the list.
- Empty state simplified (one neutral line, no celebratory copy).

### Needs attention
- Empty state replaced with a single green line: `All caught up.`
- When non-empty, section header uses an amber tone and the list gets a 2px amber border so the section stands out as actionable.
- Removed the redundant reason-description sentence — the pill (Flagged / Escalated / Repeat caller / Quote requested) is the explanation.

### Upcoming appointments
- Rows without a `call_id` no longer get a hover state — they're plainly non-clickable.

### Header
- Refresh button removed. `Cmd-R` exists for free.

Two new columns on `operators` (migration 021):
- `role_label text` — free-text custom role, displayed as a pill
  alongside the eligibility-derived role pills. Lets owners label a
  person as e.g. "Dispatcher" or "Foreman" without it being a real role
  type for routing.
- `access_tier text not null default 'view_only'` — planned permission
  level. Three tiers, friendly names:
  - **Full Access** (`full_access`) — manager/owner. Settings, team,
    billing, all cases.
  - **Case Resolver** (`case_resolver`) — CSR. Resolve cases, edit
    customer info, manage appointments. No settings/billing/team.
  - **View Only** (`view_only`) — tech. Read-only on assigned cases +
    customer info. Default for new operators.

This is **data-only**. No RLS or app-layer enforcement is wired yet —
the column is captured and displayed, that's it. Real enforcement waits
on the role-based workspace access feature (login invites + RLS).

### Holidays
- New US holiday quick-add chip set (Memorial Day, July 4, Labor Day,
  Thanksgiving, Christmas Eve / Day, NYE/NYD). Custom date picker.
- Voice prompt now injects `HOLIDAYS — CLOSED ALL DAY` with the next 12
  upcoming dates (past auto-filtered) so the agent can say "we're closed
  today for {label}".
- Dropped Juneteenth from defaults.

---

## [2026-05-08] — Settings → Hours and Services & pricing

Two more settings sections come out of placeholder. Both write to
`agent_configs` and re-sync the Vapi assistant on save (soft-fails as
"Partial save" if Vapi rejects).

### Hours (`/settings/hours`)
- Day × hours grid + closed checkbox per day, mirroring onboarding Step 6
- Timezone dropdown (auto-detected from browser, US zones)
- Holidays surfaced as a "coming soon" tile (needs schema column)

### Services & pricing (`/settings/services`)
- Editable per-vertical list backed by `agent_configs.services`
- Per-row: label edit · Book directly toggle · pricing note · remove · ▲▼ reorder
- Add from the vertical catalog (chips of unselected options) or add a
  custom service (slugified key, dedup-on-collision)
- Vertical badge shows the business type so users know why their catalog
  looks the way it does

### New files
- `src/app/(app)/settings/hours-actions.ts`
- `src/app/(app)/settings/services-actions.ts`
- `src/app/(app)/settings/_components/HoursSection.tsx`
- `src/app/(app)/settings/_components/ServicesSection.tsx`

---

## [2026-05-08] — Voice tool handlers (Phase 4 step 3)

The agent can now do things mid-call instead of just taking notes for
post-call processing. Five tools registered on the Vapi assistant:

- **`lookup_customer`** — phone-keyed customer lookup; returns name,
  address, and a one-line recent-call summary. Lets the agent skip
  re-asking ("calling about the AC again?").
- **`check_availability`** — finds 60-min slots inside business hours
  excluding existing appointments. Returns 2-4 candidate times in the
  workspace timezone. Computed from the local `appointments` table —
  real Google Calendar integration is deferred until GCP OAuth is
  unblocked.
- **`book_appointment`** — writes the appointment row in real time,
  upserts the customer if new, conflict-checks the slot, links the
  call to a case. The caller hangs up with a real booking, not a
  promise. Returns the confirmation phrasing for the agent to read
  back.
- **`escalate_to_human`** — flags the call (`flagged_for_review=true`,
  `outcome=escalated`), writes an `escalation_requested` event with
  reason + urgency, returns the callback-window phrasing the agent
  should use. SMS/email notifications still deferred (blocks on SMTP +
  SMS provider).
- **`transfer_call`** — live PSTN transfer to
  `agent_configs.oncall_numbers[0]` via Vapi's `destination` response
  block. Marks the call escalated, logs a `transfer_initiated` event.

### New
- `src/server/voice-tools/`:
  - `types.ts` — `ToolHandler`, `ToolContext`, `ToolResult` shapes.
  - `lookup-customer.ts` · `check-availability.ts` ·
    `book-appointment.ts` · `escalate-to-human.ts` · `transfer-call.ts`
    — one handler + one Vapi tool definition per file.
  - `dispatch.ts` — JSON-arg-parsing dispatch table; mirrors Vapi's
    expected response shape (`{ results: [{ toolCallId, result, ... }] }`).

### Changed
- `src/app/api/webhooks/vapi/route.ts` — `type: 'tool-calls'` no longer
  a no-op. Resolves workspace + the existing call row, hands off to
  the dispatch table, returns Vapi's response synchronously.
- `src/lib/voice/vapi.ts` — `buildVapiPayload` now includes
  `model.tools: [...]` with the five tool definitions. The agent
  config push (onboarding + Settings save) propagates them to Vapi.

---

## [2026-05-07] — Post-call summarization (Phase 4 step 2)

When a call ends, Haiku reads the transcript and writes back a
2-3-sentence summary, the call's outcome (booked / quote_requested /
escalated / no_action / hung_up / failed), urgency, service address,
service requested, system type, and — when the agent confirmed a
specific time — the appointment row. The processor also upserts the
caller's customer record and re-runs case linking once the customer
is known.

`outcome` finally turns from `processing` into a real value, which is
what `/calls`, `/dashboard`, and the Cases tab all key off.

### New
- `src/lib/ai/post-call.ts` — `extractCallFields` runs Haiku with a
  strict-JSON system prompt against the transcript, defends against
  unparseable output, returns a typed `PostCallExtraction`.
- `src/server/process-call-end.ts` — orchestration that stitches the
  extraction into the DB: writes calls row updates, upserts customer,
  inserts appointment when booked, links case via the existing
  service-role `ensureCaseForCallServer`. Idempotent on the call row.
- `MODELS.sonnet` registered in `src/lib/ai/anthropic.ts` for future
  use.

### Changed
- `src/app/api/webhooks/vapi/route.ts` — on `end-of-call-report`, after
  persisting the row + 200ing Vapi, hands off `processCallEnd(callId)`
  via Next's `after()` helper. Vercel keeps the function alive while
  Haiku runs (~2-4s) without delaying the webhook ack.

### Not in this PR
- Inngest. Built as plain orchestration so the LLM call doesn't depend
  on extra infra. Migrating to a real Inngest function is straightforward
  if retry/observability becomes worth it.
- Notifications (after-hours SMS, escalation email). Blocked on SMTP +
  SMS provider selection; tracked in PROGRESS.

---

## [2026-05-07] — Settings restructure + phone number provisioning

Cut Settings from 10 sections to **5**: Account · Business · Receptionist ·
Connections · Billing. Each top-level section page renders multiple
subsections inline, so most controls are one click deep instead of two.

### New
- `src/app/(app)/settings/_components/PhoneNumberSection.tsx` — client
  component for Settings → Connections → Echon phone number. Wraps the
  existing `claimNumber` server action from
  `src/app/onboarding/actions.ts` so onboarding Step 11 and Settings hit
  the same provisioning path. Shows the existing `phone_numbers` row if
  one exists; otherwise renders an area-code input + "Get my number"
  button. Limit 1 number per workspace; "need more, contact support"
  copy uses the new `SUPPORT_CONTACT` constant.
- `SUPPORT_CONTACT` constant in `src/app/(app)/settings/_constants.ts`
  — single string the whole app references when telling users to
  contact support. Currently a placeholder ("support (coming soon)");
  flip when the real address exists (BACKLOG: Customer support email).

### Changed
- `src/app/(app)/settings/_constants.ts` rewritten — 5 slugs:
  `account`, `business`, `receptionist`, `connections`, `billing`.
- `src/app/(app)/settings/[section]/page.tsx` rewritten — dispatches
  on the 5 slugs and renders subsection stacks. Mappings:
  - **Account** → Profile + Notifications (placeholders)
  - **Business** → Hours + Services & pricing + Schedule + Team. Schedule
    shares the `ScheduleSettingsForm` with the gear modal on `/schedule`
    so they stay synced (one DB row).
  - **Receptionist** → Voice & persona + After-hours + Escalation
    (placeholders, were "Voice agent" and "After-hours & escalation")
  - **Connections** → Echon phone number (real, working) + Calendar +
    Other integrations
  - **Billing** → Plan & payment

### Backlog (added)
- **Customer support email + intake** — pre-pilot.
- **Settings panel for Recommended action** — deferred; revisit only
  on pilot demand.

---

## [2026-05-07] — Vapi webhook DB writes (Phase 4 step 1)

The Vapi webhook receiver no longer drops events on the floor. Calls show
up in the dashboard the moment Vapi rings the agent, get enriched as the
call progresses, and are finalized on `end-of-call-report` with recording
URL + transcript + duration + raw payload. LLM-driven extraction
(summary, outcome, structured fields) is still pending — `outcome` stays
at `processing` until the Inngest job lands.

### New
- `src/lib/supabase/service.ts` — RLS-bypassing service-role client for
  webhook flows. Reads `SUPABASE_SERVICE_ROLE_KEY` (server-only env var
  that you must add in Vercel + `.env.local`).
- `src/app/api/webhooks/vapi/_lib/parse.ts` — defensive accessors for
  Vapi message fields (caller / callee phone, started/ended at,
  recording url, transcript, duration, cost) that handle both the
  current and older payload shapes.
- `src/app/api/webhooks/vapi/_lib/db.ts`:
  - `workspaceIdForNumber` — resolves the dialled Echon number to a
    workspace via `phone_numbers.e164_number`.
  - `customerIdByPhone` — resolves the caller's phone to an existing
    customer in the workspace.
  - `ensureCaseForCallServer` — service-role variant of the existing
    `ensureCaseForCall` server action; the webhook can't redirect to
    `/login`, so it needs an unauthenticated path.

### Changed
- `src/app/api/webhooks/vapi/route.ts` rewritten:
  - `status-update`: upsert `calls` (insert on first event, partial
    update on later events so `started_at` doesn't get clobbered),
    insert `call_events` row tagged `status:<status>`, link to a case
    once the customer is known.
  - `end-of-call-report`: persist `ended_at`, `duration_sec`,
    `recording_url`, `transcript`, `cost_cents`, plus the raw payload in
    `raw_end_of_call_report`. Insert `call_events` row tagged
    `end_of_call_report`. `outcome` stays at `processing`.
  - Test calls (`metadata.test === true`) still skip DB writes.
  - Errors logged but webhook always 200s so Vapi doesn't retry on bad
    payloads.

### Required action
- Add `SUPABASE_SERVICE_ROLE_KEY` (the service-role JWT from Supabase
  → Project Settings → API) to `.env.local` and Vercel.

---

## [2026-05-07] — `/schedule` week view + case modal

`/schedule` is no longer a 404. Google-Calendar-style week grid keyed off
the existing case → technician relationship, with a pill-row operator
filter (default = All), prev/today/next week navigation via `?week=`,
and a Day · Week · Month switcher with only Week active. Block colour
inherits the assigned technician's swatch (zinc for unassigned). Click a
block → opens the case in a new modal.

Cases now have a modal pattern matching customers and calls — `?case=<id>`
opens an overlay anywhere in the app. Customer/call modals close cleanly
when a case opens, so only one modal is ever visible.

### New
- Migration `db/migrations/013_add_schedule_settings.sql` (Supabase mirror
  `supabase/migrations/20260507000000_add_schedule_settings.sql`) —
  **pending apply**: adds `workspace_settings.week_start` ('sun' default,
  'mon') and `workspace_settings.schedule_time_range` ('business' default
  = 6 AM – 8 PM, or 'full' = 24h).
- `src/app/(app)/schedule/`:
  - `page.tsx` — server-fetches the week's appointments + technicians +
    settings, RLS-scoped, joins case → technician for colouring + filter.
  - `_components/WeekCalendar.tsx` — client-side calendar grid with
    overlap math (cluster-then-column layout), hour gridlines, today
    column highlight, dense vs full block formatting.
  - `_components/OperatorFilter.tsx` — pill row (`All` · technicians ·
    `Unassigned`) driving `?tech=`.
  - `_components/WeekNav.tsx` — prev/today/next + week label.
  - `_components/ViewSwitcher.tsx` — Day · Week · Month placeholder.
  - `_components/Tabs.tsx` — Calendar / Settings tab toggle.
  - `_components/ScheduleSettingsForm.tsx` — shared form used by both the
    `/schedule` Settings tab and Settings → Schedule.
  - `actions.ts` — `updateScheduleSettings` server action.
  - `_lib/week.ts` — week-math helpers (`startOfWeek`, `parseWeekParam`,
    `formatWeekLabel`, `addDays`, `timeRangeBounds`).
- `src/app/_components/cases/`:
  - `CaseDetailBody.tsx` — extracted from `/cases/[id]/page.tsx`; shared
    by the page and the new modal.
  - `CaseLink.tsx` — client `<button>` that adds `?case=<id>` and clears
    `?customer` + `?call` (one modal at a time).
  - `CaseDetailModal.tsx` — URL-driven overlay, watches `?case=<id>`.
  - `loadCaseDetail.ts` — server-action wrapper around `fetchCaseDetail`.
  - `RecommendedActionCard.tsx` — moved from
    `(app)/cases/[id]/_components/` so the modal and page can share it.

### Changed
- `src/app/_components/calls/CallLink.tsx` and
  `src/app/_components/customer-profile/CustomerLink.tsx` now also
  clear `?case=` when opening, so the three modals stay mutually
  exclusive.
- `src/app/(app)/layout.tsx` mounts `CaseDetailModal` alongside the
  existing customer/call modals.
- `src/app/(app)/cases/[id]/page.tsx` reduces to a thin wrapper around
  `CaseDetailBody` plus the back-link.
- `src/app/(app)/settings/_constants.ts` adds a `schedule` section.
- `src/app/(app)/settings/[section]/page.tsx` renders the shared
  `ScheduleSettingsForm` for the new section, hitting the same row that
  the in-page Settings tab writes.

### Removed
- `src/app/(app)/cases/[id]/_components/RecommendedActionCard.tsx` (moved
  to the shared `_components/cases/` folder).

---

## [2026-05-06] — Cases tab + call modal pattern

Splits the conflated `Calls` surface into two tabs: `Cases` (issue-level)
and `Calls` (raw log). Calls everywhere now open in a URL-driven modal
(`?call=<id>`) — same pattern as the customer profile modal — instead of
navigating away from whatever you were doing. Recommended action moves
from per-call to per-case so reps get one brief covering every call on
the issue.

### New
- Migration `db/migrations/012_per_case_recommended_action.sql` (Supabase
  mirror `supabase/migrations/20260506030000_per_case_recommended_action.sql`)
  — **pending apply**:
  - Adds `cases.recommended_action`
  - Backfills from each case's most-recent call's `recommended_action`
  - Drops `calls.recommended_action`
- `src/app/_components/calls/` — call modal pattern, mirrors the
  customer-profile module:
  - `types.ts` — isomorphic `CallDetail` shape
  - `data.ts` — `fetchCallDetail` (server)
  - `actions.ts` — `loadCallDetail` server-action wrapper
  - `CallLink.tsx` — client `<button>` that adds `?call=<id>` to the URL
    and clears `?customer` (one modal at a time)
  - `CallDetailBody.tsx` — shared body used by both the modal and the
    standalone `/calls/[id]` page (header + transcript + summary +
    extracted fields + flag-for-review). Also surfaces a "View case →"
    link in the meta row when the call belongs to a case.
  - `CallDetailModal.tsx` — URL-driven overlay mounted in `(app)/layout`
- `src/app/(app)/cases/page.tsx` — Cases list, default filter Open. One
  row per case: status pill · title · 3 colored slot dots · customer
  name (CustomerLink — opens customer modal) · opened relative · counts
  of linked calls/appointments. Status toggle (Open / All) + search.
- `src/app/(app)/cases/[id]/page.tsx` — Case detail. Reuses
  `<CaseSection>` (with new `hideItemsList` prop) for the header + slot
  dropdowns + auto-assign + merge + close, then dedicated sections for
  linked calls (open in call modal) · linked appointments · notes
  (editable). Sidebar: per-case Recommended action card.
- `src/app/(app)/cases/[id]/_components/RecommendedActionCard.tsx` —
  client card with Generate / Regenerate button calling
  `generateCaseRecommendedAction`.
- `src/app/_components/cases/actions.ts` — added
  `generateCaseRecommendedAction(caseId)` (aggregates every call's
  transcript + summary in the case, oldest first, sends to Haiku with
  the trade-aware operator briefing prompt) and `updateCaseNotes`.

### Changed
- `src/app/_components/TopNav.tsx` — added Cases between Dashboard and
  Calls. New nav order: Dashboard · Cases · Calls · Customers ·
  Schedule · Settings.
- `src/app/(app)/calls/[id]/page.tsx` — reverted to plain call detail.
  Renders `<CallDetailBody>`. Back link is context-aware: prefers
  `?from=customer`, falls back to the call's case, then dashboard.
  CaseSection no longer rendered here.
- `src/app/(app)/calls/[id]/actions.ts` — `generateRecommendedAction`
  removed (per-case version replaces it). `toggleFlagForReview` stays.
- `src/app/_components/cases/CaseSection.tsx` — added `hideItemsList`
  prop so the case detail page can suppress the inline items list (it
  renders dedicated sections instead). Items list links use `CallLink`.
- `src/app/_components/cases/types.ts` — added `recommended_action` to
  `CaseRecord`.
- All call links across the app swapped to `<CallLink>` (wide rollout):
  dashboard `RecentCalls` + `NeedsAttention`, the `/calls` table,
  customer profile timeline call cards (also drops `?from=customer`
  query param since the modal closes naturally on Escape/X). Customer
  profile rows now have a customer-name button (opens customer modal)
  separate from the call body (opens call modal) — no nested
  buttons-in-anchors.
- `src/app/_components/customer-profile/CustomerLink.tsx` — clears any
  `?call` param when adding `?customer` so only one modal renders at a
  time (and vice versa in `CallLink`).
- `src/app/(app)/layout.tsx` — mounts `<CallDetailModal />` alongside
  `<CustomerProfileModal />`.

### Removed
- `src/app/(app)/calls/[id]/_components/GenerateActionButton.tsx` — the
  per-call generator. Replaced by the per-case
  `RecommendedActionCard`.

---

## [2026-05-06] — Customer profile: collapsible per-call transcripts (DD/MM/YYYY)

Each call card in the customer profile timeline now has an expandable
"Transcript" toggle (HTML `<details>`) that reveals the full Vapi turn
transcript inline. The toggle's right-side label shows the call date in
DD/MM/YYYY format so the user can scan history without expanding every
row. Empty-transcript calls render an inline placeholder; the toggle
itself still works.

### Added
- `transcript` selected on the calls query in
  `src/app/_components/customer-profile/data.ts` + `TranscriptTurn` type
  exported from there.
- Transcript `<details>` block in `CallTimelineCard` of
  `src/app/_components/customer-profile/CustomerProfileBody.tsx`, plus a
  `formatDateDMY` helper.

### Backlog
- Added tier-gating note: "Recommended action" on call detail should
  eventually be a higher-tier feature. Parked until pilot feedback
  defines the tier structure — see BACKLOG.md.

---

## [2026-05-06] — Cases (one issue per customer; replaces per-appointment operator assignment)

`/calls/[id]` is now a case-centric view: a "case" is one issue for one
customer that can span multiple calls and appointments. Each case has up
to three nullable role slots — CS rep, Technician (vertical-agnostic
field worker), Manager. Per-appointment operator assignment from
yesterday's migration 010 is removed; the case's `technician_id` is the
single source of truth.

### New
- Migration `db/migrations/011_add_cases.sql` (Supabase mirror
  `supabase/migrations/20260506020000_add_cases.sql`) — **pending
  apply**, run `npx supabase db push --include-all`.
  - `case_status` enum (`open`, `closed`)
  - `cases` table with RLS, three operator FK slots
    (`cs_rep_id` / `technician_id` / `manager_id`), `title`, `notes`,
    `opened_at` / `closed_at`
  - `calls.case_id`, `appointments.case_id` (nullable, on delete set null)
  - **Drops** `appointments.assigned_operator_id` (yesterday's column)
  - `operators` gains `is_cs_rep` / `is_technician` / `is_manager`
    booleans + `priority_cs` / `priority_tech` / `priority_manager`
    smallints (1–10, default 5, check-constrained)
  - Backfill: each existing call with a customer becomes its own case
    (coarse — humans merge with the new merge UI when needed)
- `src/app/_components/cases/` — new module:
  - `data.ts` — `fetchCaseDetail` (case + customer + linked calls +
    linked appointments + workspace operators), `fetchMergeCandidates`
    (recent calls for the same customer in *other* cases)
  - `actions.ts` — `ensureCaseForCall` (lazy-create / attach),
    `setCaseStatus`, `updateCaseTitle`, `assignCaseSlot`,
    `recommendAutoAssign` (deterministic, no LLM — eligibility flag +
    no scheduling overlap + per-role priority), `confirmAutoAssign`,
    `mergeCases`, `loadMergeCandidates`
  - `CaseSection.tsx` — renders the "case" card on `/calls/[id]`:
    customer + status + opened date + three slot dropdowns + Auto-assign
    button + Merge button + Mark closed/Reopen + the list of every
    call/appointment in this case (focused call marked "viewing")
  - `CaseSlotPicker.tsx` — client `<select>` per slot. Only operators
    marked eligible for that slot appear in the dropdown.
  - `AutoAssignDialog.tsx` — client modal that pulls deterministic
    recommendations on open, lets the user toggle individual slots
    off, and applies via `confirmAutoAssign`. Surfaces per-slot
    explanations ("No technician available — Mike is booked at 2:30")
    when no eligible+available operator was found.
  - `MergeCasesDialog.tsx` — client modal showing this customer's
    recent calls grouped by case; click a candidate, confirm, and the
    other case's calls + appointments move into this one.

### Changed
- `src/app/(app)/calls/[id]/page.tsx` — calls `ensureCaseForCall` on
  render; renders `<CaseSection>` above the existing call header.
  Per-appointment operator picker block removed.
- `src/app/(app)/settings/_components/OperatorForm.tsx` — split out as
  a client component. New eligibility checkboxes (`Customer service` /
  `Technician` / `Manager`); Advanced `<details>` with per-role
  priority `<select>`s 1–10 — only the inputs for *checked* roles are
  shown. Info icon (hover-tooltip) on the Role field explaining
  free-text + comma-separated multi-roles.
- `src/app/(app)/settings/_components/TeamSection.tsx` — operator list
  now shows eligibility tags (CS / Tech / Manager pills) inline.
- `src/app/(app)/settings/actions.ts` — operator create/update payload
  carries the new eligibility booleans + per-role priorities, with a
  `checkboxBool` helper (handles the hidden-default + checked-true
  pattern needed for unchecked checkboxes to post `false`).
- `src/app/_components/customer-profile/data.ts` + `CustomerProfileBody.tsx`
  — dropped `assigned_operator_id` and the per-appointment operator
  picker (column gone; case is now the source of truth).

### Removed
- `src/app/_components/operators/` — `AssignedOperatorPicker` and its
  `assignOperator` action are obsolete; deleted.

### Backlog
- New entry: notify operators on case assignment (email + SMS) — needs
  SMTP + SMS providers wired first; deferred to pre-pilot.

---

## [2026-05-06] — Settings page + Team / operators

First authed `/settings` surface lands under the `(app)/` group, plus
the operator schema that lets humans assign appointments. Per-operator
calendars are explicit future work; v1 is just the assignment plumbing.

### New
- Migration `db/migrations/010_add_operators.sql` (Supabase mirror
  `supabase/migrations/20260506010000_add_operators.sql`) — creates
  `operators (id, workspace_id, name, email, phone, role, color,
  created_at, updated_at)` with RLS, plus
  `appointments.assigned_operator_id` nullable FK + partial index.
  **Pending apply** — run `npx supabase db push --include-all`.
- `src/app/(app)/settings/page.tsx` — placeholder cards for all 9
  sections per `_wireframes/settings.md` (Account, Voice agent,
  Business hours, Services & pricing, After-hours, Integrations,
  Notifications, Team, Billing) with a sticky left-rail anchor nav.
  Only Team is functional in v1.
- `src/app/(app)/settings/_components/TeamSection.tsx` — operator
  list + add/edit/remove forms + 9-color preset picker.
- `src/app/(app)/settings/actions.ts` — `createOperator`,
  `updateOperator`, `deleteOperator` server actions with hex-color
  validation.
- `src/app/_components/operators/AssignedOperatorPicker.tsx` —
  client `<select>` that auto-submits on change. Renders a colored
  dot for the currently-assigned operator. Empty option = unassigned.
  When no operators exist, renders a link into Settings.
- `src/app/_components/operators/actions.ts` — `assignOperator`
  server action; revalidates dashboard / calls / customers paths
  since the modal mounts on every authed page.

### Changed
- `src/app/_components/customer-profile/data.ts` — appointment
  entries now include `assigned_operator_id`; profile data carries
  the workspace's operator list. Added 4th parallel query.
- `CustomerProfileBody` — appointment cards in the timeline now
  render an `AssignedOperatorPicker` underneath the appointment
  details.
- `src/app/(app)/calls/[id]/page.tsx` — for booked calls, fetches
  the workspace's operators and renders the picker beneath the
  Extracted-fields panel.

---

## [2026-05-06] — Lift authed routes into shared `(app)/` group

Pure refactor. Three routes (`dashboard`, `calls`, `customers`) each
had a near-identical `layout.tsx` running the same auth gate +
TopNav + CustomerProfileModal mount. Consolidated into one
`src/app/(app)/layout.tsx`. URLs unchanged — `(app)` is a Next.js
route group, not a path segment.

### Changed
- `src/app/dashboard/`, `src/app/calls/`, `src/app/customers/` →
  moved under `src/app/(app)/`. Per-route `layout.tsx` files deleted.
- `src/app/(app)/layout.tsx` — single auth gate + chrome for every
  authed surface. Future Settings / Schedule pages drop in here.
- `src/app/_components/customer-profile/CustomerProfileBody.tsx` —
  updated server-action import path to `@/app/(app)/customers/[id]/actions`.

---

## [2026-05-06] — Customer profile modal

Customer names across the dashboard, calls list, customers list, and
call detail header now open the profile in a URL-driven modal overlay
(`?customer=<id>`) instead of navigating to `/customers/[id]`. The
standalone page still works for direct links / shareability — both
render the same body.

### New
- `src/app/_components/customer-profile/` — shared module:
  - `data.ts` — `fetchCustomerProfile(id)` (customer + merged
    timeline of calls and appointments, workspace-scoped).
  - `CustomerProfileBody.tsx` — renders header, history timeline,
    notes form, equipment editor. Used by both the page and the modal.
  - `actions.ts` — `loadCustomerProfile` server action wrapper for
    the modal's client-side fetch.
  - `CustomerLink.tsx` — client `<button>` that pushes
    `?customer=<id>` onto the current URL. Implemented as a button
    so it can sit inside row-level Links without nesting `<a>` tags.
  - `CustomerProfileModal.tsx` — client overlay that watches
    `?customer=<id>` via `useSearchParams`, fetches via the action,
    handles Escape, click-outside, X button, body scroll lock. Closes
    by removing the param via `router.push` so refresh keeps it open
    and back/forward navigates between open and closed states.

### Changed
- `src/app/customers/[id]/page.tsx` — slimmed to a thin wrapper
  around `CustomerProfileBody` + back-link. All the rendering logic
  moved to the shared body so the page and modal can never drift.
- `src/app/dashboard/_components/RecentCalls.tsx`,
  `NeedsAttention.tsx` — customer name now wrapped in `CustomerLink`
  when a customer record exists; row meta still links to `/calls/[id]`.
  NeedsAttention split the row Link so the name button isn't nested
  inside an anchor.
- `src/app/calls/page.tsx` — Customer cell uses `CustomerLink` when
  the call has a linked customer; falls back to a `/calls/[id]` Link
  for unknown callers.
- `src/app/customers/page.tsx` — every cell in the table swapped from
  `Link href="/customers/[id]"` to `CustomerLink` so clicking
  anywhere on a row opens the modal.
- `src/app/calls/[id]/page.tsx` — header customer name wraps in
  `CustomerLink` when the call is linked to a customer.
- `dashboard/`, `calls/`, `customers/` layouts each mount
  `<CustomerProfileModal />` so the overlay is available wherever a
  `CustomerLink` lives. Task 2 (lift to `(app)/`) will dedupe.

---

## [2026-05-05] — Customers list + customer profile (records, not archive)

Built customer records instead of an archive. The "look up Sarah's
HVAC history a year from now" use case is a customer-record need, not
a stash-completed-things one — completed appointments still appear on
the customer's profile, and on `/calls` and the future `/schedule`.

### New
- Migration `db/migrations/009_add_customer_equipment.sql` (Supabase
  mirror `supabase/migrations/20260505020000_add_customer_equipment.sql`)
  — adds `customers.equipment jsonb default '[]'`. Trade-agnostic
  shape: `{ id, type, brand?, model?, install_date?, notes?, created_at }`.
  Strict columns can't fit HVAC + plumbing + electrical + roofing
  without N tables; JSONB lets the per-trade UI evolve without
  another migration. Applied via `supabase db push --include-all`.
- `src/app/customers/layout.tsx` — auth gate (mirrors dashboard +
  calls). 4th authed surface; lift to a shared `(app)` route group
  is now overdue (tracked).
- `src/app/customers/page.tsx` — list view, server-rendered. Columns:
  Name, Phone, Last contact (relative), Calls (count), Status (Open
  follow-up pill or em-dash). Per-row link to the profile.
  - Sort dropdown: Most recent contact (default), Most frequent
    caller, Name (A-Z).
  - Open follow-up filter button. A customer is "open follow-up" if
    they have a `quote_requested` call AND no booked/completed
    appointment scheduled after that call's start time.
  - Search input (name / phone / email / address, case-insensitive).
- `src/app/customers/_components/sort-options.ts` — neutral module
  with `SORT_OPTIONS` + `SortKey`. Same pattern as the dashboard's
  `window-options.ts` (avoids the client-component-export-as-proxy
  trap that bit us before).
- `src/app/customers/_components/SortPicker.tsx`,
  `OpenFollowUpToggle.tsx` — client components updating `?sort=` and
  `?open=` URL params via `router.replace`.
- `src/app/customers/[id]/page.tsx` — profile page:
  - Header card: name, phone, secondary phone, email, address,
    "customer since" date, history count line.
  - Left column: chronological timeline of calls + appointments
    interleaved (newest first). Call cards show outcome badge +
    service + first 2 summary bullets and link to `/calls/[id]`.
    Appointment cards show status + service type + service address
    and link to the source call when one exists.
  - Right column: free-text notes (textarea + Save button) and an
    equipment list with collapsible "+ Add equipment" form. Each
    item has a × button to delete.
- `src/app/customers/[id]/actions.ts` — server actions:
  `updateNotes`, `addEquipment`, `removeEquipment`. All scope by
  workspace_id explicitly on top of RLS. Equipment add reads-mutates-
  writes the array; small race window is acceptable (re-add is one
  click).

### Changed
- `src/app/_components/TopNav.tsx` — added `Customers` between Calls
  and Schedule.
- `CLAUDE.md` — top nav order updated to
  `Dashboard · Calls · Customers · Schedule · Settings`.
- `src/app/dashboard/actions.ts` — `SAMPLE_CUSTOMERS` now carries
  per-customer notes + equipment so the profile page renders
  meaningfully out of the seed:
  - **Sarah**: 2 Trane AC units (zoned) + Trane furnace, leak-history
    note on the upstairs unit, a "don't send Tech #4" preference.
  - **James**: Carrier furnace with intermittent pilot, gate code +
    dog warning in notes.
  - **Priya**: 8-year-old Carrier heat pump matching her quote-request
    summary, follow-up reminder in notes.
  - **Emma**: 3-year-old Lennox AC installed by a different company,
    service-plan-interest reminder in notes.
- `seedFakeCalls` insert generates `id` + `created_at` for each
  equipment item via `crypto.randomUUID()` so the trade-agnostic
  shape is fully populated.

### Notes / open items
- Equipment editing is add + delete only in v1; updating an existing
  item's fields means delete + re-add. Inline edit is a follow-up.
- Filters and search join in JS after a broad fetch — fine at MVP
  scale; Postgres view becomes worthwhile at thousands of customers.
- Route-group lift `(app)/` is now overdue with 4 authed surfaces;
  next major refactor candidate.

---

## [2026-05-05] — Dashboard Section 3: Upcoming appointments

Closes the Phase 6 dashboard MVP (all four wireframe sections now
shipped). Today + tomorrow only — anything further out lives on the
forthcoming `/schedule` page.

### New
- `src/app/dashboard/_components/UpcomingAppointments.tsx` — server
  component. Queries `appointments` joined to `customers`, filtered to
  `[startOfToday, endOfTomorrow)`, max 8 rows, sorted ascending. Rows
  are visually grouped under sticky-style "Today" / "Tomorrow"
  headers (only the first row of each bucket renders the header).
  Each row: time · customer name (or formatted phone fallback) ·
  service type + address · status pill. Whole row is a link to the
  source `calls/[id]` when `call_id` is present, no-op otherwise
  (so a manually-entered appointment doesn't dead-link).
- "View all in Schedule →" link below the list (target route
  doesn't exist yet — same intentional dead link as the wireframe).

### Status pill colors
- `booked` → emerald
- `rescheduled` → blue
- `completed` → zinc
- `canceled` → zinc + line-through
- `no_show` → amber

### Changed
- `src/app/dashboard/page.tsx` — mounts `<UpcomingAppointments>`
  between `<NeedsAttention>` and `<RecentCalls>` to match the
  wireframe order.

### Empty state
"Nothing scheduled today or tomorrow." — same dashed-border treatment
as Needs Attention's empty state for visual consistency.

---

## [2026-05-05] — Dashboard Section 1: Metrics tiles + window picker

Three at-a-glance tiles at the top of the dashboard, each with a
distinct visualization so the eye reads them differently. Time window
is user-controlled via a dropdown (URL param ?window=, no client-side
data fetching).

### New
- `src/app/dashboard/_components/WindowPicker.tsx` — client `<select>`.
  Options: Today / Past 7 days / Past 30 days / Past year / Year to
  date / All time. Updates `?window=` via `router.replace`; default is
  Past 7 days.
- `src/app/dashboard/_components/MetricsTiles.tsx` — server component.
  Three tiles, computed from a single workspace-scoped query covering
  [priorStart, now]:
  - **Calls handled** — count + sparkline (filled-area inline SVG).
    Buckets adapt to window: hourly for Today, daily for ≤30d,
    weekly for year/YTD, monthly for all-time.
  - **Appointments booked** — count + horizontal conversion bar
    ("12 of 47 calls · 26%"). Bookings as a fraction of all calls in
    window. Blue accent.
  - **New customers** — count + ratio fill bar
    ("8 of 23 callers · 35%"). A "new" caller = phone with at least
    one call in window AND no calls before window start. Violet accent.
  - Each tile has a corner **delta badge** (`↑ 18%` / `↓ 4%` / `flat`
    / `new`) computed against the prior equivalent window. All-time
    has no prior so the badge is hidden.

### Changed
- `src/app/dashboard/page.tsx` — accepts `searchParams.window`,
  validates against `WINDOW_OPTIONS`, falls back to `7d` for invalid
  or absent values. Mounts `<WindowPicker>` next to the refresh
  button and `<MetricsTiles>` above NeedsAttention.

### Notes
- New-customer detection runs on `caller_phone` rather than
  `customer_id` so it counts unknown callers too. A small extra query
  fetches phones with calls before priorStart so we can correctly
  classify both window and prior-window cohorts.
- All math runs in JS after a single broad fetch — fine for seeded
  workloads and early pilots; will need a Postgres view or RPC once
  workspaces accumulate thousands of calls.

---

## [2026-05-05] — Dashboard "Needs attention": Resolved button

Added a per-row "Resolved" checkmark to the Needs Attention list so the
human can dismiss an item the AI surfaced when it's already been handled
offline (or when the AI hallucinated urgency). The call still appears in
Recent Calls and the call detail view — only the dashboard triage queue
filters it out. Resolving a row with a known caller_phone resolves all
unresolved calls from that phone in the 14-day window, so a repeat-caller
situation goes away in one click instead of three.

### Added
- `db/migrations/008_add_attention_resolved_at.sql` (and Supabase mirror):
  new `calls.attention_resolved_at timestamptz` column, null = still surfacing.
- `resolveAttention` server action in `src/app/dashboard/actions.ts`.
- Resolved button + filter in `src/app/dashboard/_components/NeedsAttention.tsx`.

---

## [2026-05-05] — Action-plan prompt: trade-aware + communication-focused

The on-demand action plan was producing generic, rudimentary output
("identify what was tried", "check whether the same tech attended").
Rewrote the system prompt with two changes: (1) trade is now injected
from `workspaces.business_type` so the prompt is HVAC / plumbing /
roofing / electrical / etc. — not hardcoded HVAC; (2) the prompt is
explicit about what NOT to write so Haiku stops padding bullets with
filler.

### Changed
- `src/app/calls/[id]/actions.ts`:
  - System prompt is now built per-call via `buildActionPlanSystemPrompt(trade)`.
    Still cached (`cache_control: ephemeral`) — caches per trade, which
    is effectively per-workspace since one workspace = one trade.
  - `tradeLabel()` maps the `business_type` enum to natural-language
    labels (e.g. `'deck_fence'` → `'deck and fence'`,
    `'general_contractor'` → `'general contracting'`,
    `'other'` → `business_type_other` text or `'service'` fallback).
    Workspaces that haven't reached Step 3 fall back to `'service'`.
  - Workspaces select widened to include `business_type` +
    `business_type_other`.
  - Prompt structure rewritten:
    - Bullet 1 is always the **conversation opener** — exact sentence
      in quotes, addresses customer by name, leads with action not
      history, bans corporate-apology language.
    - Bullet 2 is the **root cause hypothesis** in trade-specific
      terminology (named component, not "the unit").
    - Bullet 3 is the **concrete commitment** (specific dispatch,
      specific person, specific time).
    - Bullet 4 is **anticipated pushback** + the operator's response.
    - Bullet 5 is **concession authority** — only when the call
      history actually warrants goodwill; omitted otherwise.
    - Explicit "DO NOT WRITE" list bans generic empathy advice,
      tech-side diagnostic procedures, and filler bullets.
  - `max_tokens` 400 → 500 to give room for the opener bullet.

### Why
- Trade injection: makes plumbing / electrical / roofing workspaces
  produce trade-appropriate output without four parallel prompts.
- Negative instructions: Haiku follows "DO NOT" lists well, and the
  rudimentary output the user complained about came from the model
  filling space when given vague "be concrete" guidance.
- Conversation opener as bullet 1: a rep about to call back wants the
  first sentence ready to read, not a list of procedural reminders.

---

## [2026-05-05] — On-demand AI action plan (Haiku) + escalation fix

The "Recommended action" section is now generated on demand instead of
pre-rendered. A rep clicks an AI sparkle icon to call Haiku and produce
a brief from the call's summary + transcript. Result is persisted so
subsequent loads don't re-generate. Saves tokens (most calls are never
reviewed in detail) and lets the operator decide when the brief is
worth it.

### New
- `package.json` — added `@anthropic-ai/sdk@^0.94.0`.
- `src/lib/ai/anthropic.ts` — lazy-singleton SDK client + `MODELS`
  registry (`haiku: 'claude-haiku-4-5-20251001'`). One place to swap
  models.
- `src/app/calls/[id]/_components/GenerateActionButton.tsx` — client
  component. Inline SVG sparkle icon (one big 4-point star, one small
  below-right), `useTransition` for the pending state ("Generating…"
  + pulsing icon), error alert on failure.

### Changed
- `src/app/calls/[id]/actions.ts` — added `generateRecommendedAction`
  server action. Loads the call (summary, transcript, customer,
  outcome, urgency, address, service/system type), composes a compact
  user prompt, calls Haiku with a cached system prompt
  (`cache_control: { type: 'ephemeral' }`) describing how to write a
  rep-facing brief. Persists the result to `calls.recommended_action`.
- `src/app/calls/[id]/page.tsx` — Recommended action callout now
  always renders, but the body is conditional: bullets if present
  (with a regenerate button in the corner), or a "Need a brief…"
  prompt + sparkle button if absent.

### Fixed (seed)
- Sarah Mendez call #2 now `outcome: 'escalated'` instead of
  `'no_action'`. Customer pushed back on the appointment slot ("that's
  not soon enough"); the right behavior is escalation. Summary
  rewritten to reflect that the AI escalated.
- Cleared all pre-seeded `recommended_action` text so the on-demand
  generate flow is the default UX. Operators can click the sparkle to
  produce a real Haiku-generated brief on any call.

### Backlog
- Vapi agent prompt — add an "escalate on rejection" behavioral rule
  so the live agent matches the seed (`_project/BACKLOG.md`). When a
  caller rejects the offered slot, fire `escalate_to_human` instead of
  ending the call.

---

## [2026-05-05] — Recommended action on call detail + richer summaries

When a rep clicks Review on a "Needs attention" item, they now see a
generated action plan above the transcript — the brief they\'d want
before dialing back. Distinct from `summary` (what happened) — this is
what to do next. Plus the seed summaries are now properly descriptive.

### New
- `db/migrations/007_add_recommended_action.sql` (and Supabase mirror
  `supabase/migrations/20260505000000_add_recommended_action.sql`) —
  adds `calls.recommended_action text`. Applied via `supabase db push`.
  Will eventually be populated by the same Inngest post-call job that
  writes `summary` / `outcome` / extracted fields.

### Changed
- `src/app/calls/[id]/page.tsx` — new full-width "Recommended action"
  callout (indigo) directly below the call header, rendered only when
  `recommended_action` is non-empty. Uses the same bullet-line parser
  as the summary.
- `src/app/dashboard/actions.ts` — `SeedCall` type gains an optional
  `recommendedAction` field; the Sarah-Mendez escalated call is now
  the showcase example with a 5-bullet diagnostic-leading action plan
  (refrigerant-leak hypothesis, leak-detector kit, fee-waiver
  goodwill, replacement quote escalation). James, Priya, Emma, and
  the unknown R-22 caller also get action plans. All summaries
  expanded from 2 bullets to 3-5 with concrete clinical detail
  (zones, system age, refrigerant type, symptom history) so the UI
  has something realistic to render.

### Note
- Real Vapi calls will need agent-prompt work to make the assistant
  extract this level of detail before hand-off — these seeds are the
  target shape, not what the system produces today.

---

## [2026-05-05] — Dashboard Section 2: Needs attention

Surfaces the subset of calls where a human needs to step in, ranked by
urgency. Sits above Recent calls on the dashboard so urgent items are
the first thing the operator sees.

### New
- `src/app/dashboard/_components/NeedsAttention.tsx` — server-rendered
  list, max 5 rows. Pulls calls from the last 14 days and tags each
  with a reason in priority order:
  1. `Flagged` — `flagged_for_review = true` (red pill)
  2. `Escalated` — outcome = `escalated` (amber)
  3. `Repeat caller · N×` — same `caller_phone` 2+ times in last 7d (amber)
  4. `Quote requested` — outcome = `quote_requested` (blue)
  Rows deduped by `caller_phone` so one chatty customer can't fill the
  list. Each row links into `/calls/[id]` with a "Review" CTA.
- `src/app/dashboard/page.tsx` — mounts `<NeedsAttention>` above
  `<RecentCalls>`.

### Behavior
- Empty state matches the wireframe: "Nothing needs your attention
  right now."
- "Mark done" and "Call back" CTAs from the wireframe are deferred —
  "Mark done" needs a `resolved_at` column we don't have yet, and
  outbound dialing is post-MVP. "Review" alone is enough for now.

---

## [2026-05-05] — `/calls` index page (basic)

The Calls top-nav link was 404ing. Shipped a minimal call-log index so
the link works and so all calls (not just the dashboard's last 10) are
browsable.

### New
- `src/app/calls/page.tsx` — server-rendered table view, last 50
  calls newest-first. Columns: time, customer (name + phone or just
  phone), duration, service, outcome badge, linked appointment time
  (booked rows only), recording indicator. Whole row is a single link
  target via wrapped `<Link>` cells. Empty-state copy when no calls.

### Deferred (per `_wireframes/call_log.md`)
- Filter chips (Today / This week / This month / All time)
- Outcome multi-select filter
- Server-side search (name / phone / address)
- CSV export
- Realtime prepend with highlight animation

A note on the page tells the user these are "coming next" so it's
clear it's intentionally minimal, not broken.

---

## [2026-05-05] — `/calls/[id]` call detail page

Recent-calls rows now have somewhere to land. First pass at the call
detail UI per `_wireframes/call_detail.md` — header + two-column body
(transcript left, extracted fields/actions right). Recording and
transcript show empty-state copy until Phase 4 webhooks populate them;
everything else is live.

### New
- `src/app/calls/layout.tsx` — auth gate mirroring the dashboard one
  (redirects unauthed → `/login`, unfinished-onboarding → wizard).
  Will be lifted into a shared `(app)` route group when a 3rd authed
  surface lands.
- `src/app/calls/[id]/page.tsx` — server-rendered detail page. Joins
  `customers` and `appointments`. Sections: header (name, phone,
  outcome badge, time/duration/direction, recording slot), transcript
  (renders Vapi-style `[{role, message}]` turns when present),
  summary (bullet-formatted), extracted fields table (service
  requested, system type, service address, urgency, linked
  appointment), action buttons.
- `src/app/calls/[id]/actions.ts` — `toggleFlagForReview` server
  action. Workspace-scoped update of `calls.flagged_for_review` +
  `flag_reason`. Revalidates both detail and dashboard paths.

### Behavior
- "Flag for review" is the only live action this pass — toggles
  `flagged_for_review` and (when set) `flag_reason`. "Edit fields"
  and "Call back customer" are present but disabled with tooltips
  noting they ship post-MVP.
- 404 (`notFound()`) when the call id doesn't exist or RLS hides it.
- All field values fall back to a dim em-dash placeholder when null,
  so partial post-call extraction renders cleanly.

---

## [2026-05-05] — Recent-calls richer rows + repeat-caller flag

Reworked the dashboard Recent calls section so a human handing off a
call has enough context without clicking through, and so callers who
keep dialing back get visually flagged.

### Changed
- `src/app/dashboard/_components/RecentCalls.tsx` — two-line row layout:
  customer/phone + outcome badge on top, two truncated summary bullets,
  then time + duration. Outcome rendered as a colored left border bar
  in addition to the pill. Booked rows append the appointment time
  inline ("Booked · Tomorrow 2pm"). New "Repeat caller · N×" amber tag
  when the same `caller_phone` has 2+ calls in the trailing 7 days
  (workspace-scoped query).
- `src/app/dashboard/actions.ts` `seedFakeCalls` — rewritten with a
  declarative `SEED_CALLS` table. Now seeds 10 calls including Sarah
  Mendez calling 3× in 36h (repeat-caller scenario), 3 booked calls
  with corresponding `appointments` rows (so the dashboard can render
  appointment times), and 2-bullet summaries on every call. Seeded
  appointments tagged via `notes = 'seed:N'` for clean teardown.
- `src/app/dashboard/actions.ts` `clearFakeCalls` — now also wipes
  seeded appointments before calls/customers.

### Fixed
- `seedFakeCalls` referenced a `phone` column that doesn't exist on
  `customers` (real column is `primary_phone`); insert / select / cleanup
  filter / customer lookup all corrected.

### Backlog
- Onboarding service-radius capture + at-call distance check
  (`_project/BACKLOG.md`).

---

## [2026-05-04] — Phase 6 dashboard scaffolding (in progress)

Started the dashboard MVP. Top nav + auth-gated layout shipped; first
data section (Recent calls) wired up against real Supabase queries with
a TEST_MODE seeder so the UI is tangible before real call traffic.

### New
- `src/app/_components/ThemeProvider.tsx` — wraps `next-themes` for
  system/dark/light theme support. Mounted at root with
  `defaultTheme="system"`. Theme switcher itself deferred to
  Settings → Appearance (BACKLOG).
- `src/app/_components/TopNav.tsx` — global nav for the authed app.
  3-column grid: wordmark left, links centered (Dashboard · Calls ·
  Schedule · Settings), user email + Sign out right. Active route
  highlighted. Calls / Schedule / Settings 404 until built.
- `src/app/dashboard/layout.tsx` — auth gate. Redirects unauthed
  users to `/login`, unfinished-onboarding users back into the wizard
  (gated on `workspace_settings.onboarding_completed`, not the step
  cursor — the cursor stays at TOTAL_STEPS during the final step).
- `src/app/dashboard/_components/RecentCalls.tsx` — server component
  rendering the last 10 calls for the workspace. Joined customer name,
  formatted relative time, color-coded outcome badges (`booked`,
  `quote_requested`, `escalated`, `no_action`, `hung_up`, `failed`).
  Empty state with the wireframe copy. Rows link to `/calls/[id]`
  (404 until call detail page is built).
- `src/app/dashboard/actions.ts`: `seedFakeCalls`,
  `clearFakeCalls` — TEST_MODE-only. Seeds 10 calls across mixed
  outcomes + 3 named customers. Tagged with `vapi_call_id` prefix
  `seed_` and reserved phone block `+1415555010X` so cleanup never
  touches real data.
- `src/app/(auth)/actions.ts` — added `signOut()`.
- Functional Refresh icon (inline SVG, no extra deps) on dashboard
  page — re-renders via empty server-action form post.

### Changed
- Root `src/app/layout.tsx` — added ThemeProvider, fixed stale
  `description` metadata ("Instagram DM automation" → voice
  receptionist), `suppressHydrationWarning` on `<html>` for theme.
- Dependencies: added `next-themes`. (`@vapi-ai/web` was added in the
  earlier Phase 4 entry today.)

### Decisions
- **Realtime updates: deferred.** Manual refresh button instead of
  Supabase realtime channels for MVP. Simpler, lighter, no open
  WebSocket per tab. Revisit if pilot clients ask for it.
- **Theme switcher location: Settings, not nav.** System default keeps
  the nav uncluttered. Build the picker in Settings → Appearance.
- **Route structure: kept `dashboard/layout.tsx` for now.** When `/calls`,
  `/schedule`, `/settings` land we'll lift the auth gate into a route
  group `(app)/` so all four share the same layout.

### Backlog parking
- Admin / developer panel widget ideas captured (all-workspaces view,
  system health, onboarding funnel, recent signups, flagged-calls
  inbox, pilot impersonation) — not built; per CLAUDE.md the dev
  panel is a separate internal tool, not a view inside the client
  dashboard.
- Theme switcher in Settings → Appearance.

---

## [2026-05-04] — Phase 4 Vapi integration (onboarding portion)

Wired Vapi end-to-end for the onboarding flow. Voice abstraction in
place; assistants provisioned, updated, and testable in-browser during
onboarding. Dashboard-blocking work for Phase 6 is unblocked.

### New
- `src/lib/voice/` — `VoiceProvider` interface, Vapi REST adapter,
  singleton export. App code never imports the Vapi SDK directly.
  Voice presets map to OpenAI voices (available on every Vapi account).
- `src/app/api/webhooks/vapi/route.ts` — webhook receiver with
  timing-safe `x-vapi-secret` header check. Routes `status-update`,
  `end-of-call-report`, `tool-calls`. Test calls flagged via
  `metadata.test=true` skip DB writes. DB writes + Inngest enqueue
  still TODO.
- `src/app/onboarding/_voice-sync.ts` — `syncVapiAssistant` helper.
  Soft-fails so a Vapi error doesn't block onboarding. Skips when
  `VAPI_API_KEY` is unset.
- `src/app/onboarding/_components/TestCallButton.tsx` — Step 9 sub-step
  4 in-browser WebRTC test call via `@vapi-ai/web`.
- `src/app/onboarding/actions.ts` additions: `getTestCallConfig`,
  `claimNumber`, `devSkipToDashboard` (TEST_MODE only).
- Step 11 rewritten with non-tech-friendly forwarding-model copy and a
  single-button claim flow.
- Onboarding layout: "Skip to dashboard →" button in TEST_MODE banner.

### Changed
- `saveAndAdvance` / `saveAgentBuilderSubStep` defensively upsert the
  `agent_configs` row before writing — fixes silent data loss when the
  trigger-provisioned row was missing.

### Env vars added
`VAPI_API_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `ANTHROPIC_API_KEY`,
`VAPI_WEBHOOK_SECRET` — all in Vercel + local `.env.local`. Anthropic
key registered in Vapi's Integrations tab for BYO-LLM.

### Backlog parking
Step 10 Google Calendar OAuth (blocked on GCP verification, URGENT.md);
Step 11 area-code coverage + geocoding from business address;
concierge call scheduler embed. See BACKLOG.md.

---

## [2026-05-04] — Onboarding v2 build (Phase 5 substantially complete)

Rebuilt the onboarding wizard end-to-end. All 12 steps now have real
content (with two integration-blocked steps as polished placeholders).
Account creation moved out of the wizard. New per-vertical service
catalogs make the flow usable for non-HVAC businesses from day one
(narrow-then-wide infrastructure).

### Schema — applied to Supabase

- **Migration 004 (Phase 3 pivot)** — applied today. Dropped DM-era schema
  (`offers`, `dm_examples`, `wins`, `instagram_connections`, `leads`,
  `conversations`, `messages`, `warmth_score_history`, `lead_magnets`,
  `lead_magnet_deliveries`); added voice-product schema (`agent_configs`,
  `phone_numbers`, `customers`, `calls`, `call_events`, `appointments`,
  `integrations`); RLS on every new table. See 2026-05-01 entries below.
- **Migration 005 (`onboarding_v2.sql`)** — narrowed
  `workspaces.onboarding_step` constraint to `1..11` (later widened in
  migration 006); re-added `referral_source` enum + `referral_source` /
  `referral_source_other` columns on `workspaces`; added `agent_configs`
  columns for the new Step 9 sub-flow (`tasks`, `tasks_other`,
  `typical_callers`, `typical_callers_other`, `tone_other`,
  `builder_substep`); widened `agent_configs.tone` check to
  `(professional, friendly, empathetic, concise, other)`; flipped
  `agent_configs.agent_name` default `Riley` → `John`; added
  `phone_numbers.source` enum (`provisioned | ported | forwarded_to`),
  `forwarded_from`, `forwarding_verified`, `concierge_call_at` so future
  porting flows don't need a migration.
- **Migration 006 (`add_business_type.sql`)** — recreated
  `business_type` enum with new shape (`hvac`, `plumbing`, `roofing`,
  `electrical`, `deck_fence`, `landscaping`, `general_contractor`,
  `other`); added `business_type` + `business_type_other` columns on
  `workspaces` with a CHECK constraint enforcing `other ⇒ free text`;
  widened `onboarding_step` constraint `1..11 → 1..12` to make room
  for the new step.

### Onboarding flow — 12 steps, account creation out of the wizard

Sign up at `/signup` (own page) → land at `/onboarding/1`.

| Step | Title | Notes |
|------|-------|-------|
| 1 | Welcome | Copy: "We'll get your AI receptionist live in about **7 minutes**." Bulleted prep list. No overlay after Continue. |
| 2 | Where did you hear about us? | Single-select; reveals free-text on "Other". |
| 3 | What kind of business? | New step — narrow-then-wide infrastructure. HVAC / Plumbing / Roofing / Electrical / Deck-Fence / Landscaping / General contractor / Other. |
| 4 | Business info | Name (required in prod), phone, address, service area. |
| 5 | Services offered | **Per-vertical catalog** keyed off Step 3 (12 HVAC, 12 plumbing, 10 roofing, 11 electrical, 11 deck/fence, 12 landscaping, 12 general contractor). `other` businesses get a free-text textarea — one service per line — slugified into the same jsonb shape. |
| 6 | Business hours | Mon-Sun grid + Closed checkbox + **timezone dropdown** (US-focused IANA names). Hydrates from saved data — no longer flashes back to Eastern after Continue. |
| 7 | After-hours | Two options only: **Take messages** + **Escalate emergencies** (Recommended). Live transfer dropped from UI (DB enum still has it). On-call phone reveals when Escalate is picked. |
| 8 | Quote rules | Replacement / Commercial / Insurance toggles + custom rules textarea. |
| 9 | Build your agent | **Sub-flow with side panel.** 4 sub-steps: Tasks → Callers → Tone → Test/Review. Tasks + Callers are single-select (radio); Tone single-select with "Something else" free-text. Voice + agent name are NOT asked — agent name defaults to `John`, voice picked by Vapi at Phase-4 provisioning. Right-side **Summary** panel fills in with check marks as the user advances. Resume tracked via `agent_configs.builder_substep`. Sub-step 4 has a Phase-4 placeholder for the in-browser WebRTC test plus the review and the "Looks good — finish setup" CTA. |
| 10 | Calendar connect | Skippable, "Highly recommended" badge. OAuth comes online in Phase 4. |
| 11 | Number provisioning | Forwarding-first + concierge setup-call model explained. Real Vapi number provisioning + Calendly-style scheduler embed land in Phase 4. |
| 12 | You're all set | Motivational headline: **"Go answer every call."** + "You're all set." subhead + "Go to Dashboard" button. Confetti fires on load. |

### Test mode

`TEST_MODE = process.env.NODE_ENV !== 'production'` (centralized in
`_constants.ts`). When on, every required-field check (HTML `required`
attribute + Zod `.refine()` minimum-length) is loosened so the
developer can click through any step with empty inputs. A small amber
banner — *"Test mode — required fields are off (dev only)"* — sits at
the top of every onboarding step in dev so it's obvious this is on.
Production strict-validates automatically with zero config.

### Behavior

- **Per-step persistence** — each Continue calls `saveAndAdvance` which
  validates with Zod (per-step schemas), writes only that step's
  fields, advances `workspaces.onboarding_step`, and revalidates the
  layout. Step 9 sub-flow uses a separate `saveAgentBuilderSubStep`
  that writes per-sub-step + bumps `agent_configs.builder_substep`.
  Final "Looks good" on the Step 9 review submits to `saveAndAdvance`
  with `step=9` (no-op DB write — data already saved) which advances
  the main cursor to Step 10.
- **Resume** — `workspaces.onboarding_step` tracks the top-level step;
  `agent_configs.builder_substep` tracks Step 9 sub-position. Returning
  users land on the right top-level step, and on Step 9 they jump back
  to the sub-step they left off on.
- **Back navigation** — "← Previous step" link below the card on every
  step except Step 1. Inside Step 9, there's also a "← Back to sub-step
  N" link between sub-steps. Going back doesn't wipe answers; the next
  Continue overwrites with the new value.
- **Overlays disabled** — the user explicitly preferred direct
  navigation between steps. `OVERLAY_MESSAGES` is now empty;
  `StepShell` skips the overlay when message is empty (existing code
  path).

### Files

- **Schema:** `supabase/migrations/20260504000000_onboarding_v2.sql` +
  `db/migrations/005_onboarding_v2.sql` (mirror).
  `supabase/migrations/20260504010000_add_business_type.sql` +
  `db/migrations/006_add_business_type.sql` (mirror).
- **Wireframe:** `_wireframes/onboarding.md` rewritten for v2.
- **Constants:** `src/app/onboarding/_constants.ts` —
  `TOTAL_STEPS = 12`; new `STEP_LABELS`; `OVERLAY_MESSAGES = {}`;
  `SKIPPABLE_STEPS = {10}`; `CONFETTI_STEPS = {6, 12}`; new
  `REFERRAL_SOURCE_OPTIONS`, `BUSINESS_TYPE_OPTIONS`,
  `SERVICE_CATALOGS` (per-vertical map with `getServiceCatalog`
  helper), `TASK_OPTIONS`, `CALLER_OPTIONS`, `TONE_OPTIONS`,
  `AGENT_BUILDER_TOTAL_SUBSTEPS = 4`, `TEST_MODE` flag.
- **Actions:** `src/app/onboarding/actions.ts` — per-step Zod schemas
  (Step 2-8) with `TEST_MODE`-conditional refinements; new
  `saveAgentBuilderSubStep` action for Step 9; case 9 in
  `saveAndAdvance` is a deliberate no-op (data saved per sub-step).
- **Step components:** `_steps/Step{1..12}*.tsx` — Step1Welcome,
  Step2Referral, Step3BusinessType, Step4BusinessInfo, Step5Services,
  Step6Hours, Step7AfterHours, Step8QuoteRules, Step9BuildAgent,
  Step10Calendar, Step11NumberProvisioning, Step12AllSet.
- **Page:** `src/app/onboarding/[step]/page.tsx` — fetches per-step
  defaults from `agent_configs` / `workspaces`, dispatches to the
  right step component. Includes a `BackLink` rendered below the card
  on every step >1.
- **Layout:** `src/app/onboarding/layout.tsx` — adds the `TEST_MODE`
  banner above the card.
- **Auth:** `src/app/(auth)/actions.ts` — signup no longer skips
  `onboarding_step` to 2. New users land at Step 1 (Welcome) since the
  account-creation step is gone from the wizard.

### Bug fixes during the session

- **Cursor advance failed at Step 11/12** with
  `workspaces_onboarding_step_check` violation — root cause was the
  pre-pivot constraint capping `onboarding_step` at 10. Fixed by the
  Phase 3 migration widening to 12, then later 11 (mig 005), then 12
  again (mig 006).
- **`'use server'` export error** — `SERVICE_CATALOG` was originally
  exported from `actions.ts`, but `'use server'` files can only export
  async functions. Moved to `_constants.ts`.
- **Schema cache "business_type column not found"** — fixed by pushing
  migration 006 to Supabase.
- **Timezone dropdown flashed to Eastern** before navigating to the
  next step — root cause was `revalidatePath` re-mounting Step 6 with
  fresh `useState` initial value (browser-detected zone). Fixed by
  hydrating Step 6 from the just-saved `agent_configs.timezone`.
- **Welcome overlay was redundant** ("Welcome aboard." after a Welcome
  screen). Removed all overlay messages; navigation is now direct.

### Known follow-ups (Phase 4 territory)

- **In-browser test call (Step 9 sub-step 4)** — currently a Phase-4
  placeholder card. Once Vapi is connected, becomes a real WebRTC
  preview using the just-built agent.
- **Calendar connect (Step 10)** — currently advances cursor without
  actually connecting. Becomes a real Google OAuth flow once the GCP
  project + Calendar API client land.
- **Number provisioning (Step 11)** — currently advances cursor; the
  on-screen 3-step explainer describes what eventually happens. Real
  Vapi number-buying API + concierge-call scheduler embed are Phase 4.
- **DB enum cleanup** — `agent_configs.tone` enum still has the legacy
  `direct` value not exposed in the UI; `after_hours_mode` enum still
  has `live_transfer` not exposed. Both are harmless to leave in place;
  worth a small cleanup migration if/when we touch those tables again.

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
