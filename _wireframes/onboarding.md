# Wireframe — Onboarding

First-time setup wizard. Goal: from signup to a working voice agent that
the user has just spoken to in their own browser, in about **7 minutes**.

## Pre-onboarding (separate gate, not part of the wizard)
Account creation is its own page. New users sign up at `/signup` (email +
password, or Google OAuth), then land at `/onboarding/1`. The wizard
itself assumes an authenticated user with a workspace already provisioned
by the `handle_new_workspace` trigger.

## Shell (carry-over from pre-pivot — reuse)
- `/onboarding/[step]` dynamic route
- Persistent top progress bar with "Step X of 11" + label + fill bar
- Step-complete overlay between steps
- Resume / skip-ahead / replay guards in middleware
- Progress persisted server-side via `workspaces.onboarding_step`
- Cannot access `/dashboard` until all steps complete

## Flow Overview (12 steps)
Step 1  → Welcome
Step 2  → Where did you hear about us?
Step 3  → What kind of business?  *(narrow-then-wide infrastructure — HVAC, plumbing, roofing, electrical, deck/fence, landscaping, general contractor, other)*
Step 4  → Business info
Step 5  → Services offered
Step 6  → Business hours
Step 7  → After-hours behavior
Step 8  → Quote rules
Step 9  → Build your agent  *(sub-flow with side panel + in-browser test)*
Step 10 → Calendar connect  *(skippable, highly recommended)*
Step 11 → Number provisioning
Step 12 → You're all set

---

## Step 1 — Welcome
Personalized greeting using signup name. No form fields. Continue button.

> "Welcome aboard, {first_name}. We'll get your AI receptionist live in
> about **7 minutes**. You'll need: your business hours, your services,
> and a Google account if you want to connect a calendar."

Microcopy on continue: **"Welcome aboard."**

---

## Step 2 — Where did you hear about us?
Single-select. Required. One question, one screen — Vapi-style.

Options (radio):
- Google Search
- YouTube
- LinkedIn
- Twitter
- Blog
- Discord
- Friend
- Other → reveals free-text field

Stored in `workspaces.referral_source` (enum) + `workspaces.referral_source_other`
(text, non-null only when `referral_source = 'other'`).

Microcopy on continue: **"Thanks — good to know."**

---

## Step 3 — Business info
- Business name (display name the agent uses: *"Thanks for calling [name]"*)
- Business phone (current number — used for forwarding overflow back, optional)
- Service area: ZIP codes or radius from address
- Business address (used for service-area validation in calls + state-based
  call-recording disclosure rules)

Microcopy on continue: **"Got it — we know your business."**

---

## Step 4 — Services offered
Multi-select checklist of HVAC services. Pre-populated:
- AC repair · AC install · AC maintenance
- Furnace repair · Furnace install · Furnace maintenance
- Heat pump · Mini-split / ductless
- Indoor air quality · Duct cleaning · Thermostat install
- Commercial HVAC

Each selected service has:
- Toggle: "Book directly?" (yes = WF-01 path; no = WF-02 quote-only)
- Optional pricing note (e.g., *"Diagnostic fee: $89, waived if work
  performed"*) — agent can quote this verbatim

Microcopy on continue: **"Services locked in."**
*Confetti fires on load of Step 5.*

---

## Step 5 — Business hours
- Day-of-week × open/close grid
- "Closed" toggle per day
- Timezone (auto-detected, editable)
- Holiday schedule (optional, can skip)

Microcopy on continue: **"Hours saved."**

---

## Step 6 — After-hours behavior
Three choices, radio, with descriptions:
1. **Take messages only** — *Agent collects info, books for next morning,
   no escalation.*
2. **Escalate emergencies** *(Recommended)* — *Agent triages; emergencies
   fire SMS + push to on-call number.*
3. **Live transfer emergencies** — *Agent transfers call to on-call number
   directly.*

If 2 or 3: collect on-call phone number(s). Rotation schedule optional,
can skip.

Microcopy on continue: **"After-hours configured."**

---

## Step 7 — Quote rules
Tells the agent which jobs to route to WF-02 instead of booking directly.
- Auto-route to quote: full system replacement, commercial, insurance
  claims (pre-checked toggles)
- Custom rules: free-text field (*"Any job over $2,000 estimate"*)

Microcopy on continue: **"Quote logic set."**

---

## Step 8 — Build your agent  *(sub-flow with side panel)*

Single top-level step (Step 8 of 11 in the top progress bar throughout).
Internal sub-steps 8a → 8b → 8c → 8d → 8e → review.

### Layout
Two-column on desktop:
- **Left:** the active sub-step's question (one question per screen)
- **Right:** **Agent so far** panel — accumulating answers with check
  marks. Below the panel, a small inline progress (1 of 5, 2 of 5, ...)
  that's distinct from the top wizard progress bar.

The right panel is unique to Step 8. Earlier steps rely on the top
progress bar alone.

### Sub-step 8a — Tasks
**"What should your AI receptionist do?"** *(multi-select)*

- **Take messages** *(Recommended)* — *Collects name, reason for calling,
  and callback number so a real person can follow up.*
- Schedule appointments — *Answers calls, checks availability, and books
  service visits.*
- Answer FAQs — *Responds to common questions about your business
  (hours, location, pricing).*
- Route calls — *Greets callers and transfers urgent calls to on-call.*
- Something else — free text

Stored in `agent_configs.tasks` (jsonb array of enum values) +
`agent_configs.tasks_other` (text).

### Sub-step 8b — Callers
**"Who typically calls your business?"** *(multi-select)*

- New customers
- Existing customers
- Property managers / commercial accounts
- Other → free text

Stored in `agent_configs.typical_callers` (jsonb array) +
`agent_configs.typical_callers_other` (text).

### Sub-step 8c — Tone
**"How should your agent sound?"** *(single-select with descriptions)*

- **Professional** — *Polished and respectful. Default for most shops.*
- **Friendly** — *Warm and conversational. Good for residential service.*
- **Empathetic** — *Patient and reassuring. Good for emergency calls.*
- **Concise** — *Direct, no small talk. Good for high-volume shops.*
- Something else — free text

Stored in `agent_configs.tone` (enum) + `agent_configs.tone_other` (text).

### Sub-step 8d — Voice
**"Pick a voice."** *(single-select, 3-4 preset options)*

Each option is a card with a Play button. The sample line is rendered
live from earlier inputs:
> *"Thanks for calling {business_name}, this is John. How can I help?"*

So the preview reflects their actual business + chosen tone.

Stored in `agent_configs.voice_preset` (enum).

### Sub-step 8e — Test your agent  *(in-browser, no phone call)*
**"Talk to your agent — right here in your browser."**

- Big **"Start test call"** button → connects via Vapi Web SDK (WebRTC)
  to the assistant we've been building
- Mic permission prompt (handled inline with a one-line "We'll need
  your microphone for the test")
- Live transcript appears as the user talks
- **"End call"** button stops the WebRTC session
- Below the transcript: small "Try again" link to redo the test

The agent responds with the configured greeting, voice, and tone, using
the business name and services they entered earlier. Everything they've
configured shows up in this conversation. This is the moment of truth.

When the user ends the call: **confetti fires**, and we show the Vapi-style
summary line:

> *"{Tone} and ready for HVAC calls — your agent is built."*

Then a **"Continue"** button → review screen.

### Review (still inside Step 8)
One screen showing the full agent config:
- Agent name: **John** *(editable inline; defaults to "John"; changeable
  later in Settings → Voice agent)*
- Voice: {voice preset}
- Tone: {tone}
- Tasks: {comma list}
- Typical callers: {comma list}
- Greeting (auto-generated from business name + tone + tasks; editable
  with `{business_name}` and `{time_of_day}` variables)

CTA: **"Looks good — continue"** → Step 9.

Microcopy on continue (Step 8): **"Your agent is ready."**

---

## Step 9 — Calendar connect  *(skippable, highly recommended)*
- Primary CTA: **"Connect Google Calendar"** with a *"Highly recommended"*
  badge → Google OAuth
- Pick calendar to use for appointments (dropdown of user's calendars)
- 2-week look-ahead preview to confirm correct calendar selected

### Skip path
- Secondary link: **"Skip — I'll connect later"**
- Inline warning under skip: *"Without a calendar, your AI can take
  messages but can't book appointments. You can connect later in
  Settings → Integrations."*

Microcopy on continue (connected): **"Calendar synced."**
Microcopy on continue (skipped): **"Connect later in Settings."**

---

## Step 10 — Number provisioning

### MVP shape (forwarding model + concierge setup)
- Pick area code (defaults to Client's address)
- Show 3 number options from Vapi
- Click to claim → Vapi/Twilio provisions number
- Show forwarding instructions:
  > *"Point your existing business number to **{echon_number}**. Don't
  > worry — we'll hop on a quick call to walk you through it. Pick a
  > time:"*
- Embedded calendar widget (Calendly-style) → books a 5-min concierge
  setup call with Echon CSR (Soren during pilot)
- "Skip the call — I'll set up forwarding myself" link below, with
  per-carrier instructions linked

Stored in `phone_numbers` row with `source = 'provisioned'` and
`forwarded_from = null` (we update this when forwarding is verified).

### Schema anticipates porting (future, post-pilot)
`phone_numbers.source` enum: `provisioned` | `ported` | `forwarded_to`.
The porting flow ("enter your existing number, we handle the carrier
transfer") is not built for pilot but the schema supports it from day
one so we don't migrate later.

Microcopy on continue: **"Your new number is live."**

---

## Step 11 — You're all set

### Heading
"Let's start handling calls, {first_name}!"

### Status checklist
| Item | Status |
|------|--------|
| Account created | ✅ Done |
| Business info | ✅ Done |
| Services configured | ✅ Done |
| Business hours set | ✅ Done |
| After-hours behavior | ✅ Done |
| Quote rules | ✅ Done |
| Voice agent built + tested | ✅ Done |
| Calendar connected | ✅ Done / ⚠️ Not connected yet |
| Number provisioned | ✅ Done |
| Forwarding | ⏳ Concierge call scheduled / ➕ Set up in Settings |

### CTA
- Large button: **"Go to Dashboard"**

### Gamification
Confetti fires on step load. No microcopy overlay.

---

## Behavior
- Each step writes to the relevant table immediately on Continue (don't
  batch to the end — partial config is useful if user drops off)
- Steps 3-7 update the in-progress Vapi assistant config in the
  background after each save so by Step 8e the agent is fully
  provisioned and ready for the in-browser test
- Skip options: only Step 9 (Calendar) and Step 5 holiday schedule are
  skippable. All other steps required.

## Confetti milestones
Confetti fires at exactly 3 points — nowhere else:
1. After Step 4 (services configured — the commercial scope is locked)
2. End of Step 8e (in-browser test call ended — moment of truth)
3. Step 11 on load (onboarding complete — the finale)

## Progress bar
- Top of every step
- Shows "Step X of 11" + label of current step
- Visual fill proportional to completion
- Inside Step 8, the top bar stays at "Step 8 of 11" through all
  sub-steps; sub-step progress (1 of 5 → 5 of 5) is shown only inside
  the right-side Agent so far panel
- Returning users redirected to last incomplete step automatically
  (sub-step position inside Step 8 is also remembered — see Resume below)

## Resume behavior
- `workspaces.onboarding_step` (1-11) tracks the top-level step
- `agent_configs.builder_substep` (nullable smallint, 1-5) tracks Step 8
  sub-position; cleared when Step 8 completes
- On return, redirect to the right top-level step; if it's Step 8 and
  `builder_substep` is set, jump straight to that sub-step

## Data note
All onboarding answers are stored in Client-scoped tables with RLS (see
[[DECISIONS]]). Free-text "other" values live in dedicated columns
alongside enum columns to keep aggregate analysis clean.
