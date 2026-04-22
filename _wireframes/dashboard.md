# Wireframe — Dashboard

## Purpose
Main landing screen after login. Gives a at-a-glance overview of lead activity,
key stats, and quick access to the DM feed and CRM.

## Layout

### Top Bar
- Echon logo (left)
- Nav links: Dashboard · Messages · Workflows · Settings (center)
- Notifications bell (right)
- User avatar (right)

### Note on AI Mode
- AI mode (Manual / Hybrid / Auto) is NOT in the top nav
- It is controlled via the segmented bar at the top of the Messages tab
- Global default is set in Settings → AI Configuration

### Stats Row (below top bar)
Four stat cards across the top:
- Leads Today
- Conversations Active
- Booked This Week
- Avg Warmth Score

### Main Content Area (two columns)

#### Left Column — Activity Feed (summary)
- Recent conversation snippets (last 5–8 leads who messaged)
- Each row shows: Instagram handle, warmth bar, last message preview, time ago
- "View All" link → goes to full DM Feed page

#### Right Column — Hot Leads Panel (toggleable sidebar)
- Toggle button: "Hot Leads" — shows/hides the panel
- Dropdown selector: show Top 10 / 50 / 100
- Each row shows:
  - Instagram handle
  - Warmth bar (blue = cold → red = hot, gradient)
  - Warmth score number (e.g., 82/100)
- Sorted by warmth score descending
- Clicking a lead opens their conversation in the DM Feed page

### Bottom Section — Warm Lead Summaries
- Cards for the top 3–5 warmest active conversations
- Each card shows:
  - Instagram handle + warmth bar
  - 2–4 sentence AI-generated summary of where the conversation stands
  - CTA button: "Continue Conversation" → opens DM Feed at that thread

## Roles

### Client View
- Sees all dashboard sections: stats row, activity feed, hot leads panel, warm lead summaries
- Warmth score (numeric + bar) visible on all lead rows
- AI mode toggle (Manual / Hybrid / Auto) accessible — lives in the Messages tab segmented bar
- AI logic / phase labels hidden (internal mechanic — not surfaced on the Client-facing dashboard)
- Can navigate to Messages, CRM, Workflows, and Settings

### Developer Panel
- Separate internal tool — not a view within the Client-facing dashboard (see [[ARCHITECTURE]] — Auth & Data Isolation)
- Can view all Client workspaces and their dashboard-level stats for platform monitoring
- Can see AI logic indicators (phase labels, classification tags) per conversation for debugging
- Can toggle AI mode on behalf of a Client workspace if needed for support purposes

## Notes
- Single Instagram account per workspace (multi-account is a future feature)
- Hot leads panel state (open/closed, selected count) persists per user session
