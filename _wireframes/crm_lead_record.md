# Wireframe — CRM Lead Record

## Purpose
Full profile page for an individual lead. Accessed by clicking "View Full CRM
Record" from the right panel in the Conversation View. Contains all data
collected on that lead, manual override controls, and lead magnet tracking.

## Top Nav (global — appears on every page)
- Logo (left)
- Nav links: Dashboard · Messages · Workflows · Settings (center)
- Notifications bell (right)
- User avatar (right)

## Layout

### Header
- Instagram handle + profile photo (if available)
- Status icon + label (see Status Tags below)
- Warmth score bar (blue → red) + numeric score
- Per-conversation mode selector: Manual / Hybrid / Auto
  - Overrides the global mode for this lead only
  - Shows "Auto (Global)" if using the global default, not just "Auto"
- Back button → returns to Conversation View

### Section 1 — Warmth & Status

#### Warmth Score
- Large warmth bar + score (e.g., 74/100)
- "Override Score" button → opens confirmation dialog:
  "You are changing this lead's warmth score from X to Y. This will not affect
  AI training. Confirm or edit before saving."
  - Confirm / Cancel
- AI does not learn from manual score changes

#### Status Tag
- Current status shown as icon + label
- Status options: New · Engaged · Warm · Booked
- Clicking status opens confirmation dialog:
  "You are changing this lead's status from [X] to [Y]. This will not affect
  AI training. Confirm or edit before saving."
  - Confirm / Cancel
- AI does not learn from manual status changes

### Section 2 — Lead Summary
- 2–4 sentence AI-generated summary of the conversation
- Updated automatically after each new message exchange
- Label: "AI Summary — updated [timestamp]"

### Section 3 — Lead Magnet
- Lead magnet sent: [name of magnet] or "None sent"
- Link: [URL to Google Drive / YouTube / etc.]
- Sent on: [date]
- Opened / Clicked: Yes / No / Unknown (tracked via link click if possible)
- Follow-up sequence status:
  - Follow-up 1: Sent [date] / Pending / Not sent
  - Follow-up 2: Sent [date] / Pending / Not sent
  - (follow-up count configurable in Settings)
- After follow-up sequence completes, lead enters normal AI conversation flow

### Section 4 — Key Data
- First contact date
- Last message date
- Total messages exchanged
- Offer they responded to (pulled from onboarding settings)
- Which post or trigger brought them in (if detectable)
- Objections raised (AI-classified tags, e.g., "price", "timing", "trust")

### Section 5 — Notes
- Freeform text field, manual entry only
- Saved automatically on blur

## Status Tags

| Icon | Label    | Meaning                                      |
|------|----------|----------------------------------------------|
| 🔵   | New      | First contact, no engagement yet             |
| 💬   | Engaged  | Actively responding, warmth building         |
| 🔥   | Warm     | High warmth score, showing buying signals    |
| ✅   | Booked   | Has booked a call / registered for offer     |

## Per-Conversation Mode Override
- Each lead can be set to Manual, Hybrid, or Auto independently of global mode
- Example: global mode is Auto, but lead #3 is set to Hybrid
- Mode selector visible in both the CRM Lead Record header and the right panel
  of the Conversation View
- If set to global default, shows "Auto (Global)" not just "Auto"

## Notes
- No delete or archive functionality at this stage (bot/spam deletion is a
  future feature — see Backlog)
- One-off DMs are handled by switching that lead to Manual mode in the
  Conversation View
- Lead magnet is a URL link only (Google Drive, YouTube, etc.) — no file uploads
