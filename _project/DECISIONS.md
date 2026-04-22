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

## [2026-04-21] — Default AI mode is Hybrid, not Auto #confident
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
