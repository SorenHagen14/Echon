import type Anthropic from '@anthropic-ai/sdk'
import { anthropic, MODELS } from './anthropic'

export type CallOutcome =
  | 'booked' | 'quote_requested' | 'escalated' | 'no_action' | 'hung_up' | 'failed'
export type Urgency = 'emergency' | 'urgent' | 'routine'

export type PostCallExtraction = {
  summary: string                       // 2-3 sentence operator-readable summary
  outcome: CallOutcome
  urgency: Urgency | null
  customer_name: string | null
  service_address: string | null
  service_requested: string | null      // "AC repair", "furnace replacement quote", etc.
  system_type: string | null            // HVAC system noun: "AC", "furnace", "heat pump"
  appointment: {
    scheduled_for_iso: string           // ISO 8601 with timezone offset
    duration_min: number                // 60 default
    service_type: string                // human-readable e.g. "AC repair"
  } | null
  flagged_for_review: boolean
  flag_reason: string | null
}

type TranscriptTurn = { role?: string; message?: string }

const SYSTEM_PROMPT = `You are a post-call analyst for an HVAC business's AI receptionist. You read a call transcript and return a single JSON object describing what happened.

OUTPUT FORMAT — JSON only. No prose, no markdown fences, no commentary.

Schema:
{
  "summary": string,                       // 2-3 plain sentences for the business owner
  "outcome": "booked" | "quote_requested" | "escalated" | "no_action" | "hung_up" | "failed",
  "urgency": "emergency" | "urgent" | "routine" | null,
  "customer_name": string | null,
  "service_address": string | null,
  "service_requested": string | null,      // short noun phrase: "AC repair", "furnace tune-up"
  "system_type": string | null,            // "AC" | "furnace" | "heat pump" | "mini-split" | "boiler" | etc.
  "appointment": null | { "scheduled_for_iso": ISO8601, "duration_min": int, "service_type": string },
  "flagged_for_review": bool,
  "flag_reason": string | null
}

OUTCOME RULES
- "booked"          — agent confirmed a specific date+time, customer agreed.
- "quote_requested" — customer wants pricing or estimate; no appointment yet.
- "escalated"       — call was transferred to a human or message was taken for callback.
- "no_action"       — call ended without booking/quote/escalation (info-only, wrong number, etc.).
- "hung_up"         — caller dropped before resolution.
- "failed"          — agent or system error prevented normal handling.

URGENCY
- "emergency" — gas/water/smoke/leak/fire/CO/no-heat-in-winter/no-AC-in-heat.
- "urgent"   — same-day discomfort or risk of damage.
- "routine"  — flexible scheduling.
- null       — not enough information.

APPOINTMENT
- Populate ONLY when outcome is "booked" AND the agent stated a concrete time.
- "scheduled_for_iso" must be a real ISO 8601 timestamp. If the call uses a relative phrase ("tomorrow at 2pm"), resolve it against the call's started_at (provided in the user message) and the workspace timezone (provided in the user message). If you cannot confidently resolve to an absolute time, return null for the whole appointment object.
- Default duration_min = 60 unless the agent stated otherwise.

FLAGGING
- flagged_for_review = true when something looks off: agent hallucinated a price, gave wrong info, customer angry, audio quality terrible, multiple repeat questions, agent went off-script, or the outcome is ambiguous.
- flag_reason = one short sentence describing what to look at. null when not flagged.

DO NOT
- Invent customer_name, address, or appointment data the transcript doesn't contain. Use null.
- Add fields outside the schema.
- Wrap the JSON in markdown fences or any text.`

export async function extractCallFields(input: {
  transcript: unknown
  startedAtIso: string
  timezone: string | null
  callerPhone: string | null
}): Promise<PostCallExtraction> {
  const lines = transcriptToLines(input.transcript)
  if (lines.length === 0) {
    return {
      summary: 'No transcript was captured for this call.',
      outcome: 'failed',
      urgency: null,
      customer_name: null,
      service_address: null,
      service_requested: null,
      system_type: null,
      appointment: null,
      flagged_for_review: true,
      flag_reason: 'Empty transcript — likely a misfired or dropped call.',
    }
  }

  const userPrompt = [
    `Call started at: ${input.startedAtIso}`,
    `Workspace timezone: ${input.timezone ?? 'unknown'}`,
    `Caller phone: ${input.callerPhone ?? 'unknown'}`,
    '',
    'Transcript:',
    ...lines,
  ].join('\n')

  const response = await anthropic().messages.create({
    model: MODELS.haiku,
    max_tokens: 800,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()

  return parseExtraction(text)
}

function transcriptToLines(t: unknown): string[] {
  if (Array.isArray(t)) {
    return (t as TranscriptTurn[])
      .slice(0, 200) // hard cap to keep input bounded
      .map((turn) => {
        const who = turn.role === 'assistant' ? 'Agent' : 'Caller'
        return `${who}: ${turn.message ?? ''}`
      })
      .filter((l) => l.trim().length > who(l).length + 2)
  }
  if (typeof t === 'string' && t.trim().length > 0) {
    return t.split('\n').slice(0, 400)
  }
  return []
}

function who(line: string): string {
  return line.startsWith('Agent') ? 'Agent' : 'Caller'
}

function parseExtraction(raw: string): PostCallExtraction {
  // Strip markdown fences if the model added them despite instructions.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return {
      summary: 'Post-call extraction returned unparseable JSON.',
      outcome: 'failed',
      urgency: null,
      customer_name: null,
      service_address: null,
      service_requested: null,
      system_type: null,
      appointment: null,
      flagged_for_review: true,
      flag_reason: 'Model output was not valid JSON.',
    }
  }
  const o = parsed as Record<string, unknown>

  const outcome = isOutcome(o.outcome) ? o.outcome : 'no_action'
  const urgency = isUrgency(o.urgency) ? o.urgency : null

  let appointment: PostCallExtraction['appointment'] = null
  if (o.appointment && typeof o.appointment === 'object') {
    const a = o.appointment as Record<string, unknown>
    if (typeof a.scheduled_for_iso === 'string' && !Number.isNaN(Date.parse(a.scheduled_for_iso))) {
      appointment = {
        scheduled_for_iso: a.scheduled_for_iso,
        duration_min: typeof a.duration_min === 'number' && a.duration_min > 0 ? Math.round(a.duration_min) : 60,
        service_type: typeof a.service_type === 'string' && a.service_type.trim() ? a.service_type.trim() : 'Service visit',
      }
    }
  }

  return {
    summary: stringOr(o.summary, 'No summary generated.'),
    outcome,
    urgency,
    customer_name: nullableString(o.customer_name),
    service_address: nullableString(o.service_address),
    service_requested: nullableString(o.service_requested),
    system_type: nullableString(o.system_type),
    appointment,
    flagged_for_review: o.flagged_for_review === true,
    flag_reason: nullableString(o.flag_reason),
  }
}

function isOutcome(v: unknown): v is CallOutcome {
  return v === 'booked' || v === 'quote_requested' || v === 'escalated'
    || v === 'no_action' || v === 'hung_up' || v === 'failed'
}
function isUrgency(v: unknown): v is Urgency {
  return v === 'emergency' || v === 'urgent' || v === 'routine'
}
function stringOr(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}
function nullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t : null
}
