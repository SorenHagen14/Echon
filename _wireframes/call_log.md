# Wireframe — Call Log

`/calls` — sortable, filterable list of every call the agent has handled.

## Top bar
- Title: "Calls"
- Filter chips: `Today` · `This week` · `This month` · `All time` ·
  `Custom range`
- Outcome filter (multi-select): `Booked` · `Quote requested` ·
  `Escalated` · `No action` · `Hung up` · `Failed`
- Search box: customer name, phone, address (debounced, server-side)
- Right-aligned: `Export CSV`

## Table
Columns (sortable):
- Time (default sort: newest first)
- Customer (name + phone; "Unknown" if not captured)
- Duration
- Service requested
- Outcome (badge — color-coded)
- Linked appointment (date/time if booked, else `—`)
- Recording (play icon)

Row click → `/calls/[id]` detail page.

## Behavior
- Server-side pagination (50 rows / page)
- Realtime: new calls prepend to the top with a brief highlight animation
- Empty state: "No calls yet. Once your number is live, calls will appear
  here."
- Failed-call state (Vapi error, dropped, etc.): row shows `Failed` badge
  with hover-tooltip explaining why; no recording link

## States
- Active call (in progress): top-pinned row with pulsing indicator;
  cannot click into detail until call ends and processing finishes
- Processing (call ended, summarization not done): row shown but outcome
  column is `Processing...`; refreshes via realtime when Inngest job
  completes
