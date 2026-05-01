# Wireframe — Onboarding

First-time setup wizard. Goal: from signup to a working voice agent
answering a real test call in under 15 minutes.

## Shell (carry-over from pre-pivot — reuse)
- `/onboarding/[step]` dynamic route
- Persistent progress bar across the top
- Step-complete overlay between steps
- Resume / skip-ahead / replay guards in middleware
- Progress persisted server-side via `workspaces.onboarding_step`
- Cannot access /dashboard until all steps complete

## Flow Overview
Step 1 → Welcome
Step 2 → Account creation
Step 3 → Business info
Step 4 → Services offered
Step 5 → Business hours
Step 6 → After-hours behavior
Step 7 → Quote rules
Step 8 → Voice agent persona
Step 9 → Calendar connect
Step 10 → Number provisioning
Step 11 → Test call
Step 12 → All set

---

## Step 1 — Welcome
Personalized greeting using signup name. No form fields. Continue button.
Sets expectations: "We'll get your AI receptionist live in about 15
minutes. You'll need: your business hours, your services, and a Google
account for calendar."

Microcopy on continue: **"Welcome aboard."**

---

## Step 2 — Account creation
### Option A: Email + password
- First name · Last name · Email · Password · Confirm password
- "Create Account" button

### Option B: Google
- "Continue with Google" (OAuth) — pulls name + email automatically

### Footer
- "Already have an account? Log in"

Microcopy on continue: **"Account created."**

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

---

## Step 5 — Business hours
- Day-of-week × open/close grid
- "Closed" toggle per day
- Timezone (auto-detected, editable)
- Holiday schedule (optional, can skip)

Microcopy on continue: **"Hours saved."**

---

## Step 6 — After-hours behavior
Three choices, radio:
1. **Take messages only** — agent collects info, books for next morning,
   no escalation
2. **Escalate emergencies (recommended)** — agent triages; emergencies fire
   SMS + push to on-call number
3. **Live transfer emergencies** — agent transfers call to on-call number
   directly

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

## Step 8 — Voice agent persona
- Agent name (default: "Riley")
- Voice (3-4 preset options, audio preview button per voice)
- Tone: Friendly / Professional / Direct (default: Friendly)
- Greeting (auto-generated from earlier inputs; editable, with variable
  insertion: `{business_name}`, `{time_of_day}`)
- Live preview button — synthesizes greeting with current voice

Microcopy on continue: **"Your AI has a voice."**

---

## Step 9 — Calendar connect
- "Connect Google Calendar" button → Google OAuth
- Pick calendar to use for appointments (dropdown of user's calendars)
- 2-week look-ahead preview to confirm correct calendar selected

### Skip path
- "I'll connect later" — inline warning: "Without a calendar, your AI can
  take messages but can't book appointments. You can complete this in
  Settings."
- "Continue anyway →" link beneath warning to advance

Microcopy on continue (connected): **"Calendar synced."**
Microcopy on continue (skipped): **"Connect later in Settings."**

---

## Step 10 — Number provisioning
- Pick area code (defaults to Client's address)
- Show 3 number options
- Click to claim → Vapi/Twilio provisions number
- Show forwarding instructions: "Point your existing business number to
  [Echon number] for [carrier]" — links to per-carrier guides

Microcopy on continue: **"Your new number is live."**

---

## Step 11 — Test call
- Heading: "Call your new number now: (XXX) XXX-XXXX"
- Live status: *"Waiting for your test call..."* → *"Call in progress..."*
  → *"Call complete — here's the transcript"*
- Transcript + outcome shown inline
- "Looks good" → completes step → Step 12
- "Something's off" → opens feedback form, lands in PROGRESS for follow-up

Microcopy on continue: **"Your AI just took a real call."**

---

## Step 12 — You're all set

### Heading
"Let's start handling calls, [First Name]!"

### Status checklist
| Item | Status |
|------|--------|
| Account created | ✅ Done |
| Business info | ✅ Done |
| Services configured | ✅ Done |
| Business hours set | ✅ Done |
| After-hours behavior | ✅ Done |
| Quote rules | ✅ Done |
| Voice agent persona | ✅ Done |
| Calendar connected | ✅ Done / ⚠️ Not connected yet |
| Number provisioned | ✅ Done |
| Test call passed | ✅ Done |
| Forwarding configured | ➕ Set up in Settings → Integrations |

### CTA
- Large button: "Go to Dashboard"

### Gamification
Confetti fires on step load. No microcopy overlay.

---

## Behavior
- Each step writes to `agent_configs` immediately on Continue (don't batch
  to the end — partial config is useful if user drops off)
- Steps 3-8 update Vapi assistant config in the background after each save
  so by Step 11 the agent is fully provisioned
- Skip options: only Step 9 (Calendar) and Step 5 holiday schedule are
  skippable. All other steps required.

## Confetti milestones
Confetti fires at exactly 3 points — nowhere else:
1. After Step 4 (services configured — the commercial scope is locked)
2. After Step 11 (first real test call passed — the moment of truth)
3. Step 12 on load (onboarding complete — the finale)

## Progress bar
- Displayed at the top of every step
- Shows "Step X of 12" + label of current step
- Visual fill proportional to completion
- Returning users redirected to last incomplete step automatically

## Data note
All onboarding answers are stored in Client-scoped tables with RLS (see
[[DECISIONS]]). Free-text "other" values live in dedicated columns
alongside enum columns to keep aggregate analysis clean.
