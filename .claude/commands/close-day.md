Perform end-of-day processing for the Echon project. Do not ask me anything. Figure it out silently from the vault.

Follow this exact process:

STEP 1 — SCAN FOR WHAT CHANGED
Check the modification timestamps on all files in the vault. Identify which files were touched today. Read each one.

STEP 2 — EXTRACT ACTION ITEMS
From everything you read, pull out any tasks, TODOs, open questions, or unfinished thoughts. Add them to PROGRESS.md under a new section called:
## Action Items — [today's date]
Write each item as a checkbox:
- [ ] item

STEP 3 — ADD WIKILINKS
For every file touched today, identify which other vault files it logically connects to. Add [[wikilinks]] inline where the connection is natural — for example if a workflow references a decision, link it. If a wireframe was touched, link it back to the relevant decision in DECISIONS.md. Only add links that are genuinely meaningful. Do not force connections.

STEP 4 — CHECK CONFIDENCE MARKERS
Open DECISIONS.md. For each decision that relates to files touched today, evaluate whether the tag needs updating based on what was worked on:
- #confident — well defined, no open questions
- #uncertain — direction is set but details are fuzzy
- #revisit — something came up today that puts this in question

Update the tags directly in DECISIONS.md if anything has shifted. If nothing changed, leave it alone.

STEP 5 — DEBRIEF
Output a quick end-of-day summary in this exact format, nothing more:

**Echon — Close of Day [date]**

Files touched: [list]
Action items logged: [number]
Links added: [list of connections made, one line each]
Confidence updates: [any tags changed, or "none"]

**One thing that moved forward today:**
[one sentence]

**Biggest open question right now:**
[one sentence]
