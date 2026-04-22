# Echon — Architecture

## Stack
- Frontend + Backend: Next.js (App Router) — deployed on Vercel
- Database: Supabase (PostgreSQL) — includes Auth and real-time
- AI: Anthropic API — Haiku (classification) / Sonnet (conversation)
- Meta Integration: Meta Graph API + Webhooks
- Background Jobs: Inngest
- Version Control: GitHub
- Hosting: Vercel (frontend/API) + Supabase (database)

## Key Dependencies
- next
- @supabase/supabase-js
- @anthropic-ai/sdk
- inngest
- zod (data validation)
- tailwindcss (styling)

## Core Modules
1. Webhook Receiver — Receives incoming DMs from Meta, routes to Queue
2. Queue Manager — Prioritizes incoming messages by tier
3. AI Conversation Engine — Handles message generation, phase logic, guardrails
4. Warmth Scorer — Evaluates and updates lead score after each message
5. CRM Engine — Creates and updates lead records
6. Lead Magnet Dispatcher — Detects keyword triggers, sends assets
7. Booking Flow Handler — Sends booking link, detects confirmation
8. Learning Review System — Flags candidate improvements, stores approved changes
9. Dashboard API — Serves data to the frontend interface
10. Notification System — Tags conversations, triggers manual attention flags

## Directory → Module Map
```
src/
├── app/                    ← Next.js pages and UI components
│   ├── dashboard/          ← Dashboard page
│   ├── messages/           ← 3-column DM feed (lead list / chat / details)
│   ├── workflows/          ← Lead magnet + follow-up sequence builder
│   └── settings/           ← Account, connections, AI config, billing
├── server/                 ← API routes and business logic
│   ├── webhooks/           ← Meta webhook receiver
│   ├── queue/              ← Queue Manager (priority tier logic)
│   ├── crm/                ← CRM Engine (lead records, status, warmth)
│   └── notifications/      ← Urgency flags, in-app alerts
├── ai/                     ← All AI logic
│   ├── engine/             ← Conversation generation (Sonnet)
│   ├── classifier/         ← Intent + phase classification (Haiku)
│   ├── scorer/             ← Warmth Scorer
│   └── learning/           ← Learning Review System (feedback storage)
├── integrations/           ← Third-party API clients
│   ├── meta/               ← Meta Graph API (send/receive DMs)
│   └── calendly/           ← Calendly / Cal.com webhook (future)
└── db/                     ← Supabase schema, queries, migrations
```

## Auth
- Supabase Auth (email+password and Google OAuth)
- Two roles:
  - **Admin** — the Echon developer (internal tooling, platform management). Not a role end users hold.
  - **Client** — any paying end user of Echon. All Clients access the same product surface; there is no tiered permission within the Client role yet.
  - Future: a "workspace owner vs. team member" distinction within the Client role is planned but explicitly out of scope until after MVP. Do not build it early.

## Data Isolation
- Every Supabase table that holds Client-scoped data (leads, conversations, messages, warmth scores, workflows, settings, etc.) must have Postgres Row-Level Security (RLS) enabled with an explicit policy.
- RLS is non-negotiable and must be in place from the first migration. Do not rely on application-layer filtering alone.
- Each Client is isolated to their own workspace. No Client can read or write another Client's data under any circumstance.
- Impersonation of Client sessions is prohibited — treat it as a compliance concern. Use structured logs and opt-in diagnostic tooling for debugging instead.
- See [[DECISIONS]] — Admin = developer, Client = end user; RLS enforced for Client isolation.

## Data Flow (basic)
Lead sends DM → Meta fires webhook → Queue Manager assigns priority
→ AI Engine generates response → Warmth Scorer updates score
→ CRM Engine updates record → Response sent back via Graph API
