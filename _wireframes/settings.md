# Wireframe — Settings

## Purpose
Full account and app configuration. Accessible from the top nav. Organized into
clearly labeled sections so users can find and edit anything from onboarding
setup to billing without leaving the app.

## Top Nav (global — appears on every page)
- Logo (left)
- Nav links: Dashboard · Messages · Workflows · Settings
- Notifications bell (right) — in-app only
- User avatar (right)

## Settings Navigation (left sidebar within Settings page)
- Account
- Connections
- AI Configuration
- Offer & Brand Voice
- Notifications
- Billing

---

## Section 1 — Account

### Profile
- First Name (editable)
- Last Name (editable)
- Email Address (editable)
- Password (change password flow — current password + new password + confirm)
- Save Changes button

### Danger Zone
- "Delete Account" button (red, bottom of section)
- Clicking opens confirmation modal:
  "Are you sure you want to delete your account? This will permanently remove
  all your data including leads, conversations, and settings. This cannot be
  undone."
  - Type "DELETE" to confirm
  - Confirm Delete / Cancel buttons

---

## Section 2 — Connections

### Purpose
Central hub for all third-party integrations. Each integration shows its
current status and connection controls.

### Instagram
- Status badge: Connected ✅ / Disconnected ⚠️ / Error ❌
- Connected account handle shown if connected (e.g., @yourhandle)
- "Connect Instagram" button (if disconnected) → Meta OAuth flow
- "Disconnect" button (if connected) → confirmation modal before disconnecting
- Error state shows plain-language description of what went wrong + retry button

### Calendly / Cal.com
- Status badge: Connected ✅ / Not connected
- "Connect Calendly" button → OAuth
- "Connect Cal.com" button → OAuth
- Used to detect booking confirmations automatically
- *(Full implementation tracked in Backlog)*

### Coming Soon (grayed out)
- WhatsApp
- iMessage *(feasibility TBD)*

---

## Section 3 — AI Configuration

### Global AI Mode Default
- Label: "Default conversation mode"
- Segmented bar selector: Manual · Hybrid · Auto
- Factory default for new accounts: **Hybrid**
- Helper text: "This sets the default mode for all new conversations. You can
  override it per-conversation in the Messages tab."
- Note: mode is also changeable from the segmented bar at the top of the
  Messages tab; both controls update the same global setting

### Urgency Settings
#### Warmth Score Threshold
- Label: "Flag leads as urgent when warmth score is above:"
- Number input or slider (default: 70)
- Range: 0–100

#### SLA Threshold
- Label: "Flag leads as urgent if waiting longer than:" ℹ️
  - Hover tooltip on ℹ️: "SLA (Service Level Agreement) threshold is the maximum
    time a warm lead should wait before being flagged as urgent. Once exceeded,
    the lead is pinned to the top of your lead list with a warning icon."
- Input: number + unit selector (Minutes / Hours), default: 2 Hours
- Helper text: "Only applies to leads above your warmth score threshold."

### Urgency Logic Summary (read-only display)
- Small info box showing current urgency rules at a glance:
  "A lead is flagged urgent when 2 or more of the following are true:
  warmth ≥ [X], responded in the last 30 min, AI detects buying signal or
  objection, waiting > [Y hours] without a reply."

---

## Section 4 — Offer & Brand Voice

### Business Profile
- Business Type: editable dropdown (same options as onboarding + Other)
- If Other: free text field for business description

### Offer
- Offer Type: editable dropdown (adapts to business type, same as onboarding)
- If Other: free text field for offer description
- Offer URL: optional link field

### Brand Voice
- Tone tags: multi-select (same options as onboarding, up to 3)
- Tone description: free text field

### Example DMs
- Label: "Your example DM responses"
- Helper text: "These help the AI match your style. You can add, edit, or remove
  them at any time. Having none is fine if you prefer the AI's default tone."
- List of submitted examples (each shows first 80 chars + Edit / Delete buttons)
- "Add Example" button → opens text area to paste a new DM
- No minimum required — section can be empty

---

## Section 5 — Notifications

### In-App Notifications (all toggles, on by default)
- Urgent lead flagged
- Lead booked
- AI flagged a message for review

### Note
- Email and push notifications not available at this stage
- Future channels (email, SMS, push) tracked in Backlog

---

## Section 6 — Billing

### Current Plan
- Plan name (e.g., Solo, Premium, Enterprise)
- Renewal date
- "Manage Plan" button → upgrade/downgrade flow

### Plan Tiers (display only — details TBD, see Backlog)
| Tier       | Notes                                                      |
|------------|------------------------------------------------------------|
| Solo       | Entry-level, core features, limits TBD                     |
| Premium    | Full feature access, limits TBD                            |
| Enterprise | Custom pricing — "Book a Call" CTA, no self-serve signup   |

### Enterprise CTA
- If user clicks Enterprise: shows "Let's talk." screen with a booking link
  to schedule a call rather than a self-serve upgrade flow

---

## Notes
- All onboarding data is fully editable here
- AI mode default set here flows into the segmented bar in the Messages tab
- SLA threshold ℹ️ tooltip uses plain language — no jargon
- Connections section built to scale: new integrations added as cards here
