# Wireframe — Onboarding

## Purpose
First-time setup wizard shown to new Clients before they reach the dashboard.
Collects everything the AI needs to personalize conversations from day one:
who the Client is, who they sell to, why those people buy, how they talk,
and proof of what actually works. Multi-step format with a persistent progress
bar at the top. One focused section per screen. Progress is persisted
server-side so the Client can drop off and resume at their last incomplete step.

## Flow Overview
Step 1 → Account Creation
Step 2 → Business Profile
Step 3 → Your Offer
Step 4 → Your Avatar
Step 5 → Pain Point
Step 6 → Brand Voice
Step 7 → Upload Your Wins
Step 8 → Connect Instagram
Step 9 → You're All Set

---

## Step 1 — Account Creation

### Option A: Email + Password
- First Name (required)
- Last Name (required)
- Email Address (required)
- Password (required, min 8 characters)
- Confirm Password (required)
- "Create Account" button

### Option B: Google
- "Continue with Google" button (OAuth)
- Pulls first name, last name, email automatically

### Footer
- "Already have an account? Log in"

### Gamification
- Microcopy overlay on continue (1.2s): **"Welcome aboard."**

---

## Step 2 — Business Profile

### Business Type (required)
Dropdown or card selector — user picks one:
- Coaching
- Agency / SMMA
- SaaS
- E-commerce
- Consulting
- Creator / Influencer
- Real Estate
- Fitness / Wellness
- Other

If "Other" is selected → text field appears:
- "Describe your business type" (free text, required if Other selected)

### Gamification
- Microcopy overlay on continue (1.2s): **"Got it — we know your business."**

---

## Step 3 — Your Offer

### Offer Type (required)
Options adapt based on business type selected in Step 2:

| Business Type       | Offer Options                                              |
|---------------------|------------------------------------------------------------|
| Coaching            | Discovery Call, Group Program, Online Course, Workshop     |
| Agency / SMMA       | Strategy Call, Done-For-You Service, Retainer              |
| SaaS                | Free Trial, Demo Call, Paid Subscription                   |
| E-commerce          | Product Purchase, Flash Sale, Free Sample                  |
| Consulting          | Discovery Call, Project Proposal, Retainer                 |
| Creator / Influencer| Free Webinar, Paid Community, Digital Product              |
| Real Estate         | Property Viewing, Consultation Call, Lead Form             |
| Fitness / Wellness  | Free Consultation, Class Trial, Program Enrollment         |
| Other               | Free text — "Describe what you're selling"                 |

If "Other" offer type selected → text field:
- "Describe your offer in one sentence" (free text)

### Offer URL (optional)
- Label: "Paste your booking link or sales page URL (optional)"
- Placeholder: "https://calendly.com/yourname or https://yoursite.com/offer"
- Helper text: "This is where the AI will direct warm leads."

### Gamification
- 🎉 **Confetti milestone 1 of 3** fires after this step
- Microcopy overlay on continue (1.2s): **"Nice offer."**

---

## Step 4 — Your Avatar

### Purpose
Defines exactly who the Client is selling to. Informs all AI conversation
targeting: message framing, empathy cues, objection handling.

### Who are you selling to? (required)
- Single-line text input
- Placeholder: "e.g., Female fitness coaches, 25–40, struggling to get past $5k/month"

### Demographic Tags (optional, multi-select)
Pick any that apply:
- Age range: Under 25 · 25–34 · 35–44 · 45–54 · 55+
- Gender: Men · Women · Non-binary / All genders
- Location type: Urban · Suburban · Rural
- Income bracket: Under $50k · $50k–$100k · $100k–$250k · $250k+

### Where do they hang out online? (optional, multi-select)
- Instagram · TikTok · LinkedIn · YouTube · Facebook Groups · Reddit · Other

### Anything else about them? (optional)
- Free text field
- Placeholder: "Any other context about your audience the AI should know"

### Gamification
- Microcopy overlay on continue (1.2s): **"Your avatar is locked in."**

---

## Step 5 — Pain Point

### Purpose
Captures the emotional and practical problem the avatar is experiencing.
Directly informs how the AI opens conversations, builds rapport, and frames
the Client's offer as the solution.

### What problem keeps your avatar up at night? (required)
- Multi-line text area
- Placeholder: "Describe the core pain in 2–3 sentences. e.g., They're
  posting consistently but getting no DMs. They feel invisible despite
  working hard. They're watching others grow and wondering what they're
  doing wrong."

### What have they tried that didn't work? (optional)
- Multi-line text area
- Placeholder: "e.g., Bought courses, hired coaches, tried hashtag strategies..."

### What's the cost of not solving it? (optional)
- Multi-line text area
- Placeholder: "e.g., They stay stuck at the same income level, burn out, or
  quit their business entirely."

### Gamification
- Microcopy overlay on continue (1.2s): **"Now we know what drives them."**

---

## Step 6 — Brand Voice

### Tone Description (required)
- Label: "How do you talk to your audience?"
- Multi-select tone tags (pick up to 3):
  Casual & Friendly · Professional · Hype / Motivational · Empathetic ·
  Straight to the Point · Conversational · Bold & Direct · Educational
- Free text field below: "Describe your voice in your own words (optional)"
  - Placeholder: "e.g., I keep it real, no fluff. I talk like I'm texting a friend."

### Example DMs (optional but highly recommended)
- Label: "Paste 2–3 of your best-performing DM responses"
- Helper text: "This helps the AI match your style from day one. Highly recommended
  for the best results."
- Three text areas (Example 1, Example 2, Example 3) — all optional
- Small label above section: "⭐ Users who add examples get significantly better
  AI output quality"

### Gamification
- Microcopy overlay on continue (1.2s): **"Your voice, captured."**

---

## Step 7 — Upload Your Wins

### Purpose
The single highest-leverage AI training input available during onboarding.
Actual closed-deal conversations teach the AI more about closing style, pacing,
and language than any tone tag or example DM.

### Heading
"Teach your AI how you close."

### Subheading
"Paste 1–5 past DM conversations that ended in a booking or sale. Your AI will
learn your exact style from these. This is the single biggest factor in AI
output quality."

### Urgency Banner
⚡ **Highly Recommended** — users who skip this step report significantly lower
AI quality.

### Win Entry (repeating, up to 5 entries, add/remove dynamically)
Each entry contains:
- Conversation text (multi-line text area, paste the full DM thread)
- Outcome tag (dropdown, required per entry):
  - Booked a call
  - Closed a sale
  - Got a reply
  - Other
- Deal value (optional, numeric $ field)
- Notes (optional, short free text)

"+ Add another win" button (shown until 5 entries reached)
"× Remove" link per entry

### Continue Path
- "Continue" is enabled once ≥ 1 win entry is added
- Clicking "Continue" saves all win entries and advances to Step 8
- Dashboard nag banner does not appear (wins row count > 0 satisfies the hide condition)

### Skip Path
- Button label: "I'll add these later" — always visible, always enabled
- Clicking it advances to Step 8 without saving any wins
- The skip action does NOT write to `wins_nag_dismissed` — it remains false (its default)
- The dashboard nag banner is controlled entirely by this condition:
  `wins_nag_dismissed = false` AND `wins` row count = 0 for this workspace
- The banner disappears automatically once the Client adds any wins (row count > 0)
- The banner is permanently hidden only when the Client clicks "Dismiss" on the
  banner itself — that action sets `wins_nag_dismissed = true`
- Nag banner copy: "⚡ Add your winning DM conversations to unlock full AI
  quality. [Add Wins] [Dismiss]"

### Gamification
- 🎉 **Confetti milestone 2 of 3** fires after this step (whether skipped or completed)
- Microcopy overlay on continue (1.2s):
  - If wins uploaded: **"Your AI just got sharper."**
  - If skipped: **"No problem — add these later."**

---

## Step 8 — Connect Instagram

### Status Panel
- Icon + label: Instagram (not connected)
- "Connect Instagram" button → initiates Meta OAuth flow
- Helper text: "Echon needs access to your Instagram DMs to send and receive
  messages on your behalf."

### OAuth Scaffold Note
- The OAuth initiation button is built and wired to the Meta redirect flow
- Webhook handling and production permission verification are NOT implemented
  pending Meta app review approval (see [[URGENT]])
- If the OAuth flow fails or is unavailable, the step renders the Pending State below

### Pending State (shown when Meta approval is not yet granted)
- Label: "Instagram connection coming soon"
- Helper text: "We're waiting on Meta's approval to enable DM access.
  You can continue setting up — we'll notify you when it's ready to connect."

### Connect Path
- Client clicks "Connect Instagram" → Meta OAuth redirect initiates
- On successful OAuth return: step shows a connected confirmation state
- Client clicks "Continue" to advance to Step 9
- Microcopy overlay (1.2s): **"Instagram queued."**
- No dashboard warning or deep link shown

### Skip Path
- Button label: "I'll do this later" — shown in both the normal and pending states
- Clicking it renders an inline warning immediately below the button (before advancing):
  "You won't be able to send or receive DMs until Instagram is connected.
  You can complete this in Settings."
- A "Continue anyway →" link appears beneath the warning to confirm and advance to Step 9
- After advancing, no persistent nag banner is shown (unlike wins — Instagram status
  is surfaced via the Connections section in Settings and the Step 9 checklist)
- Microcopy overlay (1.2s): **"Connect later in Settings."**

---

## Step 9 — You're All Set

### Heading
"Let's fill your calendar, [First Name]!"

### Subheading
"Your AI is trained. Here's what's ready."

### Status Checklist

| Item                        | Status                          |
|-----------------------------|---------------------------------|
| Account created             | ✅ Done                         |
| Business profile set        | ✅ Done                         |
| Offer defined               | ✅ Done                         |
| Avatar defined              | ✅ Done                         |
| Pain point captured         | ✅ Done                         |
| Brand voice configured      | ✅ Done                         |
| Wins uploaded               | ✅ Done / ⚠️ Skipped            |
| Instagram connected         | ✅ Done / ⚠️ Not connected yet  |
| Lead magnet added           | ➕ Add in Workflows              |

### Next Steps (if anything is incomplete)
- If Instagram not connected: "Connect Instagram in Settings before going live."
- If no wins uploaded: "Add your winning DMs in Settings to improve AI quality."
- If no lead magnet: "Set up your first lead magnet in Workflows."

### Default Mode Notice
Small info block: "Your AI is starting in Hybrid mode — it will suggest
responses for you to review before anything is sent. You can change this
anytime in Settings or the Messages tab."

### CTA
- Large button: "Go to Dashboard"
- Clicking this lands the Client on the Dashboard for the first time

### Gamification
- 🎉 **Confetti milestone 3 of 3** fires on step load (no overlay — confetti + CTA is the finale)
- No microcopy overlay on this step

---

## Progress Bar
- Displayed at the top of every step (Steps 1–9)
- Shows: Step X of 9 + label of current step
- Visual fill is proportional to completion (e.g., Step 3 = ~33% filled)
- Example: ●●●○○○○○○  Step 3 of 9 — Your Offer
- Progress is persisted server-side via `workspaces.onboarding_step`
- Returning users are redirected to their last incomplete step automatically

## Confetti Milestones
Confetti fires at exactly 3 points — nowhere else:
1. After Step 3 (Offer locked in — offer is the core commercial commitment)
2. After Step 7 (Wins uploaded or explicitly skipped — training data phase complete)
3. Step 9 on load (onboarding complete — the finale)

## Microcopy Overlays
After each "Continue" click (Steps 1–8 only), a short celebratory message
appears centered on screen for ~1.2 seconds before the next step loads:

| Step | Message (wins uploaded / default)          | Message (skipped)             |
|------|--------------------------------------------|-------------------------------|
| 1    | "Welcome aboard."                          | —                             |
| 2    | "Got it — we know your business."          | —                             |
| 3    | "Nice offer."                              | —                             |
| 4    | "Your avatar is locked in."                | —                             |
| 5    | "Now we know what drives them."            | —                             |
| 6    | "Your voice, captured."                    | —                             |
| 7    | "Your AI just got sharper."                | "No problem — add these later."|
| 8    | "Instagram queued."                        | "Connect later in Settings."  |
| 9    | (no overlay — confetti is the finale)      | —                             |

## Notes
- All onboarding data is editable later in Settings
- Lead magnet setup is intentionally not part of onboarding — handled in Workflows
- Instagram connection is a hard dependency for the app to function;
  tracked as a priority item in [[URGENT]]
- Wins step is skippable with a nag — never required
- Step 9 heading personalizes with the Client's first name from their profile
- No subscription/tier gating in onboarding — parked in BACKLOG.md
- Demographic tags and channel tags in Step 4 stored as jsonb/array columns,
  not free text enums, to preserve flexibility for future filtering

## Data Collection Note
All onboarding answers are stored in Client-scoped tables with RLS (see [[DECISIONS]] — RLS enforced for Client isolation). Normalized
fields (business_type, offer_type, outcome) use enums so aggregate analysis is
possible later via the Developer Panel. Free-text "Other" values live in
separate columns (e.g., `business_type_other`, `offer_type_other`), not
overloaded into the enums. This keeps enum columns clean for GROUP BY queries
while preserving the raw user input for qualitative review.
