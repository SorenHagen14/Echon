# Echon — Urgent Tasks

Tasks listed here are urgent and stalled — either waiting on an external
dependency, a platform approval process, or a technical issue outside our
control. These are not parked (see BACKLOG.md). They need to be resolved
before the relevant part of the app can be built or go live.

---

## [URGENT] Vapi account + test number provisioning
**Priority:** Critical — Phase 4 (Vapi integration) cannot start without it.
**Blocked by:** Account creation + payment method + Twilio sub-account
provisioning.

### What's needed
- Create Vapi account (vapi.ai)
- Add payment method
- Provision a test phone number (Twilio sub-account through Vapi)
- Confirm BYO-LLM (Anthropic) is configured for the account
- Generate API keys; store in Vercel env vars

### Why it's not blocked yet
Phase 2 (code deletion) and Phase 3 (schema reset) don't depend on Vapi.
This becomes a hard blocker the moment Phase 4 starts.

### Next action
Create the account when Phase 4 is the next active phase — not before.
Provisioning a number costs money the moment it exists.

---

## [URGENT] Google Cloud project + Calendar OAuth consent screen
**Priority:** High — needed for Phase 4 (`check_availability`,
`book_appointment` tools require Calendar API access).
**Blocked by:** Google OAuth consent screen verification (can take days to
weeks if scopes require sensitive-scope review).

### What's needed
- Create Google Cloud project
- Enable Google Calendar API
- Configure OAuth consent screen (external, production)
- Submit for verification — Calendar scopes are not "sensitive" but the app
  must still pass basic verification before the unverified-app warning
  goes away
- Generate OAuth client ID + secret; store in Vercel env vars

### Why it matters now
If submitted late, the unverified-app warning will scare off pilot Clients
during onboarding (Step: Calendar connect). Submit as early as Phase 1
ends so verification happens in parallel with Phase 2-3 work.

### Next action
Create the GCP project and submit consent screen for verification this
week (before or alongside Phase 2 start).

---

## [URGENT] Custom SMTP for transactional email
**Priority:** Medium — must be resolved before any pilot Client onboards.
**Blocked by:** Choosing a provider (Resend / Postmark / SendGrid) and
verifying domain (DNS records, takes ~24h).

### What's needed
- Pick provider
- Configure Supabase Auth to use custom SMTP
- Verify sending domain (DKIM, SPF, DMARC)
- Replace Supabase-domain confirmation emails with Echon-domain emails

### Why it matters
Confirmation emails currently send from Supabase's domain. Pilot Clients
seeing `noreply@supabase.io` in their inbox damages credibility.

---

## [URGENT] Encrypt OAuth tokens in `integrations` table
**Priority:** High — must be resolved before the first non-test Client
connects a real Google account.
**Blocked by:** Choosing an approach (pgsodium column-level encryption vs.
Supabase Vault) and writing a follow-up migration.

### What's needed
- Pick approach:
  - **pgsodium** — column-level encryption keyed via Supabase's vault.
    Lower friction; writes/reads transparent at the SQL layer.
  - **Supabase Vault** — store tokens as Vault secrets, reference by id
    from the `integrations` row. More secure separation; more app code
    changes.
- Write follow-up migration that wraps `integrations.oauth_access_token`
  and `integrations.oauth_refresh_token`
- Update Phase 4 calendar OAuth code to read/write through the encryption
  layer (not directly against the columns)

### Why it matters
Migration 004 (Phase 3) creates the `integrations` table with OAuth
tokens stored as plain text. There's a TODO comment in the migration
flagging this. Acceptable for the dev / test workspace I'll use during
Phase 4, but a hard blocker before pilot Clients connect real Google
accounts — a Supabase compromise would expose every connected Client's
calendar tokens.

### Next action
Land before Phase 4 calendar OAuth implementation, or in parallel with it.
Latest acceptable point: before the first pilot Client onboards.

---

_Add new urgent items above this line using the same format._

---

## Archived — pre-pivot urgent items

### [ARCHIVED 2026-05-01] Meta Graph API — Instagram DM Integration
Was the critical pre-pivot blocker for the Instagram DM setter product.
Obsolete as of the 2026-05-01 pivot to HVAC voice receptionist. Meta
Developer App, webhook receiver, IG Login OAuth, Privacy Policy + Data
Deletion endpoints are no longer needed and will be deleted in Phase 2.
Original entry preserved in git history (pre-2026-05-01 versions of this
file).
