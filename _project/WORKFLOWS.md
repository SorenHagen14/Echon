# Echon — Workflows

## WF-01: Inbound DM Received
1. Meta fires webhook to /api/webhooks/meta
2. System extracts sender PSID, message text, timestamp
3. Queue Manager checks if sender has existing CRM record
   - If yes: load record, retrieve warmth score and conversation history
   - If no: create new CRM record, assign intake tag
4. Queue Manager assigns priority tier (Tier 1–4)
5. AI Engine receives message + context
6. AI determines current conversation phase
7. AI generates response (Haiku for classification, Sonnet for generation)
8. Warmth Scorer updates score based on message signals
9. Response sent via Graph API
10. CRM record updated (last message, score, status tag)

## WF-02: Keyword Trigger / Lead Magnet
[fill in]

## WF-03: 23-Hour Follow-Up
[fill in]
