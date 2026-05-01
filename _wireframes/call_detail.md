# Wireframe — Call Detail

`/calls/[id]` — full record of a single call.

## Header
- Back to call log
- Customer name + phone (click to open CRM record — future)
- Call time, duration, outcome badge
- Recording player (waveform + play/pause + speed control)

## Two-column body

### Left — Transcript
- Speaker-labeled transcript (Agent / Caller)
- Timestamp per turn
- Search within transcript
- Inline highlights for tool calls:
  - `[Agent looked up customer]`
  - `[Agent checked availability for Thursday]`
  - `[Agent booked appointment: Thu 10am]`
- Click highlight → expand to see tool input/output

### Right — Extracted fields & actions
Auto-populated from post-call summarization:
- Customer name
- Phone
- Service address
- Service requested
- System type (HVAC: AC / furnace / etc.)
- Urgency (emergency / urgent / routine)
- Outcome (booked / quote requested / escalated / no action / hung up)
- Linked appointment (if booked) — link to /schedule
- Linked quote request (if applicable) — link to follow-up queue
- Notes (free text — Anthropic-generated 2-3 sentence summary)

Action buttons:
- `Edit fields` (Client can correct extraction errors → corrections feed
  back as training data, post-MVP)
- `Flag for review` (sends to Echon admin queue — for catastrophic agent
  failures)
- `Call back customer` (opens dialer or initiates Vapi outbound — future)

## Behavior
- All fields read-only by default; `Edit fields` toggles inline editing
- Editing a field updates the CRM record but not the transcript
- Recording: signed URL from Supabase storage, expires after 1 hour;
  re-fetched on each page load
