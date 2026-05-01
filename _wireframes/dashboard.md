# Wireframe — Dashboard

The first thing the Client sees after login. Today-focused snapshot of
phone activity and what needs attention.

## Top nav (global)
`Echon logo · Dashboard · Calls · Schedule · Settings · [notifications] · [user]`

Top nav order is locked: **Dashboard · Calls · Schedule · Settings**.

## Layout
Single column, four stacked sections. No sidebar.

### Section 1 — Today's snapshot (4-tile row)
| Tile | Value | Subtext |
|------|-------|---------|
| Calls handled today | `12` | `+3 vs yesterday` |
| Booked | `8 (67%)` | `target 60%` |
| Quote requests | `2` | `1 awaiting callback` |
| After-hours | `1 emergency` | `escalated 2:14am` |

Each tile is clickable → drills into filtered Calls view.

### Section 2 — Needs attention
Short list (max 5) of items requiring Client action. Examples:
- Quote request from Sarah Mendez — callback by 4pm today
- Escalated emergency at 2:14am — confirm acknowledged
- Customer flagged AI got address wrong — review transcript

Row format: customer name · short description · timestamp · primary CTA
(`Review` / `Mark done` / `Call back`).

Empty state: "Nothing needs your attention right now."

### Section 3 — Upcoming appointments (today + tomorrow)
Compact list. Columns: time · customer · service · address · status.
Max 8 rows; "View all in Schedule →" link at bottom.

### Section 4 — Recent calls (last 10)
Compact list. Columns: time · customer (or "Unknown") · duration · outcome
(`Booked` / `Quote requested` / `Escalated` / `No action` / `Hung up`) ·
play recording icon.

Click row → /calls/[id] detail view.

## Realtime behavior
- Tiles update live via Supabase realtime when calls finish processing.
- "Recent calls" prepends new rows without page reload.

## States
- **Empty (no calls yet):** show onboarding nudge if business hours haven't
  started yet ("Your number is live. We'll show calls here as they come in.")
- **Account paused / billing issue:** banner at top, dashboard otherwise
  unchanged.

## Roles
- **Client view:** all sections visible. No AI internals (urgency
  classification, tool-call traces) shown — those live in call detail.
- **Developer Panel:** separate internal tool, not a view within the
  Client-facing dashboard. Sees all Client workspaces and stats. Out of
  scope for MVP unless explicitly requested.
