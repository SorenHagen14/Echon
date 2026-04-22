# Echon — Urgent Tasks

Tasks listed here are urgent and stalled — either waiting on an external
dependency, a platform approval process, or a technical issue outside our control.
These are not parked (see BACKLOG.md). They need to be resolved before the
relevant part of the app can be built or go live.

---

## [URGENT] Meta Graph API — Instagram DM Integration

**Priority:** Critical — the app cannot send or receive DMs without this.
**Blocked by:** Meta app review process / developer account setup

### What's needed
- Create a Meta Developer App with the Instagram Graph API product enabled
- Get `instagram_manage_messages` and `pages_messaging` permissions approved
- Set up the OAuth flow for Instagram account connection (used in onboarding Step 5)
- Configure and verify the webhook endpoint (`/api/webhooks/meta`) with Meta
- Obtain a long-lived Page Access Token for sending DMs via the Graph API

### Why it's blocked
Meta requires app review before granting DM permissions to production apps.
This is a platform-level gate — it cannot be bypassed or built around.
Development can proceed with a test Instagram account under the developer app,
but production access requires Meta approval.

### Impact if unresolved
- Onboarding Step 5 (Connect Instagram) cannot function
- The entire core message loop (WF-01, WF-02, WF-03) is non-functional
- App cannot go live

### Next action
Set up the Meta Developer App, configure test access, and submit for review
as early as possible — approval can take days to weeks.

---

_Add new urgent items above this line using the same format._
