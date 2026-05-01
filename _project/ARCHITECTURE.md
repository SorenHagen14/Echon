# Echon — Architecture

## Stack
- Frontend + Backend: Next.js (App Router) — deployed on Vercel
- Database: Supabase (PostgreSQL) — includes Auth, RLS, real-time
- AI: Anthropic API — Sonnet for in-call reasoning, Haiku/Sonnet for post-call summarization
- Voice / Telephony: **Vapi** (orchestrates STT + LLM + TTS + telephony in one platform)
  - STT: Deepgram (Vapi default)
  - TTS: ElevenLabs or Cartesia (provider-configurable per agent)
  - Numbers + PSTN: Twilio (provisioned through Vapi)
- Background Jobs: Inngest (post-call processing, calendar sync, notifications)
- Version Control: GitHub
- Hosting: Vercel (frontend/API) + Supabase (database)

## Key Dependencies
- next
- @supabase/supabase-js
- @anthropic-ai/sdk
- inngest
- @vapi-ai/server-sdk (Vapi server SDK for call lifecycle + agent management)
- googleapis (Google Calendar integration)
- zod (data validation)
- tailwindcss (styling)

## Voice Provider Abstraction
All Vapi calls are wrapped behind a thin `VoiceProvider` interface in
`src/lib/voice/`. Application code never imports the Vapi SDK directly —
it goes through the abstraction. This is the only voice-layer abstraction
worth building upfront. Rationale and migration path: see [[DECISIONS]]
(2026-05-01 — Telephony provider).

## Core Modules
1. **Voice Agent Layer** — Vapi-hosted assistants per Client; configured with
   greeting, services, pricing rules, business hours, escalation logic
2. **Call Lifecycle Handler** — webhook receiver at `/api/webhooks/vapi` for
   call status, end-of-call reports, function-call invocations
3. **Voice Tools API** — function-calling endpoints the agent invokes mid-call:
   `lookup_customer`, `check_availability`, `book_appointment`,
   `escalate_to_human`, `transfer_call`
4. **Transcript & Summary Pipeline** — Inngest job; runs after call ends.
   Anthropic Sonnet extracts structured fields (customer name, address,
   service requested, urgency, scheduled slot, follow-up needed)
5. **Scheduling Engine** — calendar availability lookups, appointment
   creation, conflict detection, sync with Google Calendar
6. **CRM Engine** — customer records, call history, appointment history,
   tags, notes
7. **Notification System** — alerts to Client (SMS / email / in-app) for
   after-hours emergencies, escalations, and missed-call recoveries
8. **Dashboard API** — serves call logs, appointment lists, and stats to UI
9. **Onboarding / Agent Provisioning** — wizard-driven Vapi assistant
   creation, number provisioning, calendar OAuth, test-call flow

## Directory → Module Map
```
src/
├── app/
│   ├── dashboard/          ← Today's snapshot (calls, bookings, stats)
│   ├── calls/              ← Call log + call detail views
│   ├── schedule/           ← Upcoming appointments / calendar view
│   ├── settings/           ← Account, voice agent, integrations, billing
│   └── onboarding/         ← First-time setup wizard
├── lib/
│   └── voice/              ← VoiceProvider interface + Vapi adapter
├── server/
│   ├── webhooks/
│   │   └── vapi/           ← Call lifecycle webhook
│   ├── voice-tools/        ← Function-call handlers (book, check, lookup)
│   ├── crm/                ← Customer + call records
│   ├── scheduling/         ← Calendar sync, appointment logic
│   └── notifications/      ← After-hours alerts, escalations
├── ai/
│   ├── summarizer/         ← Post-call structured-field extraction
│   └── classifier/         ← Urgency / outcome classification
├── integrations/
│   ├── vapi/               ← Vapi API client (used only inside lib/voice/)
│   ├── google-calendar/    ← OAuth + availability + event creation
│   └── jobber/             ← Future: CRM/dispatch integration (BACKLOG)
└── db/                     ← Supabase schema, queries, migrations
```

## Auth
- Supabase Auth (email+password and Google OAuth)
- Two roles:
  - **Admin** — the Echon developer (internal platform tooling)
  - **Client** — any paying HVAC business using Echon
- A future "owner vs. dispatcher vs. tech" role distinction within Client is
  acknowledged but explicitly out of scope until post-MVP.

## Data Isolation
- Every Supabase table holding Client-scoped data (customers, calls,
  appointments, agent_configs, integrations, etc.) has Postgres RLS enabled
  with an explicit policy.
- RLS is enforced from the first migration. Application-layer filtering is
  not sufficient.
- Each Client is isolated to their own workspace. No cross-Client data
  access permitted.
- See [[DECISIONS]] — Admin = developer, Client = end user.

## Data Flow (basic — inbound call)
Customer dials Client's Echon number (Twilio)
→ Vapi answers, runs the assistant: STT → Anthropic Sonnet (with tools) → TTS
→ Mid-call: agent invokes `check_availability` / `book_appointment` / etc.
   via function calls hitting `/api/voice/tools/*`
→ Call ends; Vapi POSTs end-of-call report to `/api/webhooks/vapi`
→ Inngest job processes transcript:
   – Anthropic extracts structured fields
   – CRM updated (customer record created/updated, call logged)
   – Appointment created (if booked) + Google Calendar event written
   – Notifications fired (after-hours alerts, escalations)
→ Dashboard reflects new call + appointment in real time (Supabase realtime)
