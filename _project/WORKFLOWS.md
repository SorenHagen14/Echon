# Echon — Workflows

The three core workflows the system must support. All start with an inbound
phone call to the Client's Echon-provisioned number.

---

## WF-01: Inbound Call → Qualify → Book Appointment
The golden path. Customer calls during business hours with a routine
service request; agent qualifies and books a slot.

1. Customer dials Echon number; Twilio routes to Vapi assistant
2. Agent greets per Client's configured greeting (Client name, hours)
3. Agent qualifies: customer name, phone, service address, system type
   (HVAC: AC / furnace / heat pump / mini-split / etc.), age, symptoms,
   urgency level
4. Agent invokes `lookup_customer(phone)` — if existing, loads history
   and confirms address rather than re-collecting
5. Agent invokes `check_availability(date_range, service_type)` — returns
   open slots from Google Calendar
6. Agent offers 2-3 slot options; customer picks one
7. Agent invokes `book_appointment(customer, slot, service_type, notes)`
   — creates appointment, writes Calendar event, returns confirmation
8. Agent confirms verbally, offers SMS confirmation, ends call
9. Vapi posts end-of-call report → Inngest job runs:
   - Anthropic summarizes transcript into structured fields
   - CRM record updated; call linked to appointment
   - SMS confirmation dispatched if customer opted in
   - Dashboard updates in real time

## WF-02: Inbound Call → Qualify → Quote Request
For jobs that can't be booked over the phone (full system replacement,
unusual configuration, insurance work). Agent captures enough detail for
the Client to call back with a quote.

1. Steps 1-3 as WF-01 (greet + qualify)
2. Agent recognizes job is quote-required (system replacement, commercial,
   insurance claim, or matches Client-defined "quote-only" rules in agent
   config)
3. Agent invokes `lookup_customer(phone)`; loads or creates record
4. Agent collects extra detail: square footage, # of zones, current system
   age/brand, reason for replacement, timeline, decision-maker
5. Agent offers a callback window (e.g. "someone from [Client] will call
   you back within 2 business hours"); customer confirms preferred contact
   method
6. Agent invokes `create_quote_request(customer, details, callback_window)`
   — creates a quote-request record tagged for Client follow-up
7. Agent ends call
8. Inngest post-call job:
   - Summarize transcript, populate quote-request record
   - Notify Client (SMS + in-app) — appears in dashboard "Quote requests"
     queue
   - Auto-set callback reminder on Client's schedule view

## WF-03: After-Hours Emergency Triage
Calls outside business hours. Agent triages emergency vs. non-emergency,
escalates emergencies, captures non-emergencies for next-business-day
callback.

1. Customer dials; Vapi assistant detects after-hours mode (Client's
   configured business hours)
2. Agent greets with after-hours script ("we're closed, but I can help
   you right now")
3. Agent qualifies and classifies urgency:
   - **Emergency** (no heat in winter, no AC in extreme heat, gas leak,
     water leak from system, power-related smell/smoke)
   - **Urgent but not emergency** (system not cooling/heating but
     temperature tolerable)
   - **Routine** (maintenance, quote, non-functional component that isn't
     critical)
4. **If emergency:** agent invokes `escalate_to_human(customer, summary,
   urgency_level)`. Behavior depends on Client's escalation config:
   - **Live transfer:** Vapi transfers call to on-call number
   - **Page-out:** SMS + push notification to on-call tech with customer
     callback number; agent tells customer "[name] will call you back
     within X minutes"
5. **If urgent or routine:** agent collects full intake, books a slot for
   next business morning (or earliest available), confirms.
6. Inngest post-call job:
   - Summarize, log call, create appointment or follow-up record
   - Fire urgency-tagged notification to Client dashboard
   - For emergencies: confirm escalation was acknowledged; if not, retry
     and fall back to backup contact

---

## Notes
- All three workflows share the same end-of-call processing (transcript
  summarization, CRM update, dashboard sync, notifications).
- Agent behavior per workflow is driven by `agent_configs` (per-Client
  business hours, services list, pricing rules, escalation rules, quote
  triggers) — not hardcoded.
- Workflow selection is implicit: the agent follows its system prompt and
  the available tools; there is no explicit "WF-02 mode" the agent enters.
  These are descriptions of the patterns the system must support, not
  branches in code.
