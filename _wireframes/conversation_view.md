# Wireframe — Conversation View (DM Feed)

## Purpose
The primary working screen for managing Instagram DM conversations. Supports
three operating modes: Manual, Hybrid, and Auto.

## Modes

### Manual Mode
- User handles all DM responses
- AI runs silently in background: scores warmth, classifies intent, updates CRM
- No message suggestions shown
- Send box is a plain text input

### Hybrid Mode
- AI generates 3 suggested responses per incoming message
- User clicks a suggestion → it populates the send box (user must hit send)
- User can ignore suggestions and type their own message
- After sending (whether suggestion or custom), an optional pop-up appears:
  "Why did you choose this response? (Helps train the AI)"
  - Free text field
  - "Submit" and "Skip" buttons
  - Framed as a training incentive, not a requirement

### Auto Mode
- AI handles all responses automatically
- User can read conversations but send box is inactive
- Can override by switching to Hybrid or Manual mid-conversation
- AI still surfaces urgency flags and updates CRM

## Layout — Three Panel

### Top of Messages Page — Mode Bar
- Segmented bar in the top left of the Messages tab: Manual · Hybrid · Auto
- Default is whatever the user set in Settings → AI Configuration
- Changing it here updates the global mode for all conversations
- Individual leads can still override this per-conversation (see right panel)

### Left Panel — Lead List
- Search bar at top
- Filter/sort controls: by warmth score, recency, urgency
- Each lead row shows:
  - Instagram handle
  - Warmth bar (blue → red gradient)
  - Last message preview (truncated)
  - Time since last message
  - Urgency flag: yellow warning icon (pinned to top of list when active)
- Leads sorted by: warmth score + recency combined (default)
- Urgent leads always pinned to top regardless of sort

#### Urgency Flag Logic
A lead is flagged urgent when 2 or more of the following are true:
- Warmth score ≥ 70
- Responded within the last 30 minutes
- AI classifies message as buying signal or objection
- Lead has been waiting > X minutes without a reply (user-configurable SLA)

### Center Panel — Active Chat
- Instagram handle + warmth bar at top of panel
- Current conversation phase label (Developer Panel only — not surfaced to Clients, e.g., "Phase 2 — Rapport")
- Scrollable message history
  - Loads last 24 hours or last 5 messages on open (whichever is lighter)
  - Scrolling up triggers lazy load of earlier messages in real time
- Mode indicator badge (Manual / Hybrid / Auto) visible in chat header

#### Send Area (bottom of center panel)
**Manual Mode:**
- Plain text input + Send button

**Hybrid Mode:**
- Three AI-suggested message cards above the input box
  - Each card shows the suggested message text
  - Click a card → populates the send box
  - Cards labeled: "Option A", "Option B", "Option C"
- Text input box (editable, pre-filled if suggestion clicked)
- Send button
- After send: optional "Why did you choose this?" pop-up

**Auto Mode:**
- Send box grayed out with label: "AI is handling this conversation"
- Override button: "Take Over" → switches to Hybrid for this conversation

### Right Panel — Lead Details
- Instagram handle + profile photo (if available)
- Warmth score (number + bar)
- AI-generated conversation summary (2–4 sentences, updated after each message)
- Lead status tag (e.g., Intake, Engaged, Objection, Booked, Dead)
- Key data points:
  - First contact date
  - Last message date
  - Total messages exchanged
  - Offer they responded to (if known)
- Notes field (manual, freeform)
- "View Full CRM Record" link → opens CRM Lead Record page

## Roles

### Client View
- Full access to all three modes: Manual, Hybrid, and Auto — no gating, no approval required
- Default mode on first load: **Hybrid** (see [[DECISIONS]] — Default AI mode is Hybrid)
- Auto mode locks the send box — Client must switch to Manual or Hybrid to type (applies to everyone)
- Warmth scores and summaries visible
- Phase labels and AI classification tags hidden (internal mechanics — not surfaced to Clients)
- Can submit "why I chose this" training feedback in Hybrid mode

### Developer Panel
- Separate internal tool — not an additional view within the Client-facing Messages screen (see [[ARCHITECTURE]] — Auth & Data Isolation)
- Can see conversation phase labels and AI classification tags per message for debugging
- Can view any Client workspace's conversation feed for support purposes (read-only, no impersonation — see [[DECISIONS]] — RLS & impersonation policy)

## Per-Conversation Mode Override
- Each lead can have its own mode independent of the global toggle
- Example: global is Auto, but lead #3 is set to Hybrid
- Mode selector visible in the right panel and on the full CRM Lead Record page
- If using global default, selector shows "Auto (Global)" not just "Auto"

## Notes
- Global mode (Manual / Hybrid / Auto) is set from the top bar toggle
- Per-lead mode overrides the global setting for that conversation only
- Urgency SLA threshold is configurable in Settings
