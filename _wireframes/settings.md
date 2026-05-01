# Wireframe — Settings

Reachable from top nav. Left-rail subnav, content on the right.

## Top nav (global)
`Echon logo · Dashboard · Calls · Schedule · Settings · [notifications] · [user]`

## Sections (left rail)
1. Account
2. Voice agent
3. Business hours
4. Services & pricing
5. After-hours & escalation
6. Integrations
7. Notifications
8. Team *(post-MVP placeholder)*
9. Billing

---

## 1. Account

### Profile
- First name · Last name · Email · Password (change flow)
- Display name
- Timezone
- 2FA toggle
- Save Changes button

### Danger zone
- "Delete Account" (red, bottom of section)
- Confirmation modal: "Are you sure? This permanently removes all your
  data including calls, transcripts, recordings, customer records, and
  settings. Cannot be undone." Type "DELETE" to confirm.

---

## 2. Voice agent
Mirrors onboarding Step 8 plus advanced controls.
- Agent name, voice, tone, speaking rate
- Greeting (editable, with variable insertion)
- System prompt addendum (advanced; free-text — appended to base prompt)
- "Test call" button — places a call to user's verified phone (sandbox,
  doesn't count against billing)
- Call recording on/off (default: on; legal disclosure auto-injected when
  required by state — see Section 6 below)

See `voice_agent_config.md` for the full detail page.

---

## 3. Business hours
- Day × hours grid (same as onboarding Step 5)
- Holidays
- Timezone

---

## 4. Services & pricing
- Editable list from onboarding Step 4
- Add / remove / reorder services
- Per-service: book-direct toggle, pricing note, quote-required override

---

## 5. After-hours & escalation
- Mode (messages-only / escalate / live-transfer)
- On-call number(s) + rotation
- Emergency keyword tuning (advanced — words that elevate urgency
  classification, e.g. "gas," "water," "smoke")

---

## 6. Integrations
Central hub for all third-party integrations. Each row shows current
status + connection controls.

### Google Calendar
- Status badge: Connected ✅ / Disconnected ⚠️ / Error ❌
- Connected account email shown if connected
- Calendar selected (dropdown to change)
- "Reconnect" / "Disconnect" buttons
- Error state: plain-language description + retry button

### Phone number
- Provisioned number shown
- Forwarding setup instructions (per-carrier guides)
- Port-in request (placeholder — Coming soon)

### Coming Soon (grayed out)
- Jobber
- Housecall Pro
- ServiceTitan

---

## 7. Notifications

### In-app (toggles, on by default)
- Emergency escalation (after-hours)
- Quote request received
- Customer flagged a call for review
- AI failed to handle a call

### Other channels
- SMS + email + push: not available at this stage. Tracked in Backlog.

---

## 8. Team
Placeholder. Post-MVP: invite users, assign roles
(owner / dispatcher / tech).

---

## 9. Billing

### Current plan
- Plan name · Renewal date · "Manage Plan" button

### Usage this month
- Minutes used / minutes included
- Calls handled
- Overage charges (if any)

### Invoices
- Downloadable PDF list

### Payment method
- Card on file · Update / Replace

### Cancel subscription
- Confirmation flow — clear messaging that the number will be released
  after the current period ends

---

## Behavior
- Every save writes through to `agent_configs` and propagates to the Vapi
  assistant immediately (no "publish" step).
- Voice / greeting / system prompt addendum changes debounce ~3s before
  pushing to Vapi, to avoid hammering the API on rapid edits.
- All onboarding data is editable here — no field is "locked" after setup.
