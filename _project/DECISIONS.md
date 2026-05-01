# Echon — Decision Log

## [Date] — Chose Next.js for frontend #confident
Why: Full-stack capability, easy deployment on Vercel, large ecosystem.
Rejected: Plain React (no SSR), Vue (smaller ecosystem for this use case).

## [Date] — Chose Supabase for database #confident
Why: Managed PostgreSQL, built-in auth, real-time subscriptions useful for
dashboard live updates. No DevOps overhead.
Rejected: Firebase (non-relational, harder to query), self-hosted Postgres
(too much setup at this stage).
See also: [[ARCHITECTURE]] (Data Isolation section for RLS enforcement details).

## [2026-04-21] — Admin = developer, Client = end user; RLS enforced for Client isolation #confident

**Admin** refers to the Echon developer's internal platform dashboard — not an agency owner or
power user. It is a developer-facing tool for managing all paying workspaces, subscriptions,
permissions, and platform health.

**Client** refers to any paying end user of Echon. All Clients access the same product surface.
A future distinction between "workspace owner" and "team member" within the Client role is
acknowledged but explicitly out of scope until after MVP.

Why: The original docs used "Admin = agency owner" and "Client = limited viewer," which was
ambiguous and inaccurate. The corrected model matches standard SaaS conventions (developer
backend vs. end-user product).

RLS (Postgres Row-Level Security) is enforced on every Supabase table that holds Client-scoped
data. Application-layer filtering is not sufficient — RLS is the enforcement layer. Each Client
workspace is fully isolated; no Client can access another Client's data. Impersonation of Client
sessions is prohibited; structured logging and opt-in diagnostics are the approved debugging
alternatives.

Why RLS from day one: Deferring RLS creates a window where cross-Client data leaks are possible
if any query is written incorrectly. Enforcing it at the database layer removes that class of
bug entirely, regardless of how application code evolves.

See also: [[ARCHITECTURE]] (Data Isolation), [[PROGRESS]] (Action Items — 2026-04-21).

## [2026-04-21] — Default AI mode is Hybrid, not Auto #superseded
Why: A first-time user in Auto could lose a real lead to a bad AI response
before they've had any chance to review output quality. Hybrid is the safe
default — the user sees and approves every AI-suggested response before it
sends, so mistakes can be caught before they cost a lead.
Rejected: Auto as default (too much risk for new users), Manual as default
(undersells the product; user gets no AI value on day one).
Note: The user can change the global default in Settings → AI Configuration.
They can also switch modes on-the-fly from the Messages tab. Per-conversation
overrides remain available regardless of the global default.
See also: [[conversation_view]] (Roles — Client View), [[settings]] (AI Configuration section).
**Superseded 2026-05-01:** Product pivoted from Instagram DM setter to AI voice
receptionist. Manual/Hybrid/Auto modes no longer apply.

## [2026-05-01] — Product pivot: AI voice receptionist for HVAC #confident
Echon is no longer an AI Instagram DM setter. The product is now an **AI phone
receptionist** that answers inbound calls for blue-collar service businesses,
qualifies the caller, captures customer details, scopes the job, and either
books an appointment or routes to a human for a quote.

**Initial vertical: HVAC.** Specifically targeting independent shops with
3-15 trucks in markets with strong seasonality. Other blue-collar verticals
(plumbing, roofing, electrical, deck/fence) are explicit future expansion
targets but not in scope for MVP.

Why HVAC first:
- Highest emergency call volume of the candidate verticals (no-heat / no-AC
  calls book with whoever answers first — missed calls = lost $300-8k jobs)
- Highly structured intake (system type, age, symptoms, address, urgency)
  that a voice AI can handle cleanly
- Mature SaaS ecosystem (ServiceTitan, Housecall Pro, Jobber) for future
  integrations
- Small enough shops to sell without enterprise procurement, big enough
  tickets to justify $300-500/mo subscription

Rejected: Plumbing (close second, slightly less crowded but smaller TAM),
roofing (quote-driven sales cycle = thinner value prop for AI on the call),
electrical (no emergency edge), deck/fence (low volume, small ticket).

See also: [[PROGRESS]], [[ARCHITECTURE]], [[WORKFLOWS]] — all to be rewritten
in Phase 1 of the pivot.

## [2026-05-01] — Stack unchanged: Next.js + Supabase + Anthropic + Inngest + Vercel #confident
The pivot does not change the foundational stack. Auth, multi-tenant RLS,
Supabase schema patterns, Inngest for background jobs, and Anthropic for
reasoning all carry over directly. Roughly 40-50% of existing scaffolding
(auth, onboarding wizard shell, dashboard shell, settings) is reusable.

What is being deleted: Meta webhook receiver, Instagram OAuth scaffolding,
DM/conversation/message tables, Manual/Hybrid/Auto mode logic, the 3-column
Messages view.

## [2026-05-01] — Telephony provider: Vapi (with VoiceProvider abstraction) #confident
Vapi is the telephony + voice agent platform for MVP. It handles realtime
STT + LLM orchestration + TTS + telephony, supports BYO-LLM (Anthropic stays
as the reasoning layer), and exposes function calling for tools like
`lookup_customer`, `check_availability`, `book_appointment`, and
`escalate_to_human`.

Why Vapi over alternatives:
- Fastest path to a working pilot (out-of-the-box plug-and-play)
- BYO-LLM keeps Anthropic in the stack
- Function-calling model maps cleanly onto HVAC intake flow
- Twilio numbers built in, no separate provisioning layer to manage
- Web dashboard for prompt iteration without redeploys

Rejected:
- **Retell AI** — viable alternative with slightly better latency, more
  opinionated. Acceptable fallback if Vapi becomes a blocker.
- **Bland AI** — too locked-in, weaker for nuanced HVAC intake
- **LiveKit Agents / Pipecat** — open source, max control, but 2-3x more
  upfront engineering. Correct destination once margin matters more than
  speed; not the right starting point.
- **Raw Twilio + Deepgram + ElevenLabs + Anthropic** — too much DIY plumbing
  at this stage; latency and interruption tuning are not where to spend
  founder time pre-PMF.

**Mitigation for lock-in / future cost concerns:** All Vapi calls are wrapped
behind a thin `VoiceProvider` interface (`src/lib/voice/`). Swapping to
LiveKit + raw providers later is a known 1-2 day migration, not a rewrite.
This is the only voice-layer abstraction worth building upfront.

Cost envelope (per minute, all-in): ~$0.10-0.20 (Vapi platform + Anthropic
Sonnet + Deepgram STT + ElevenLabs/Cartesia TTS + Twilio). At a $399/mo
subscription with ~200 calls/mo averaging 5 min, gross margin lands in the
30-50% range starting out, improves with TTS provider choice and scale.

See also: [[ARCHITECTURE]] (Voice layer — to be added in Phase 1).
