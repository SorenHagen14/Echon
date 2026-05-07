import type {
  AssistantConfig,
  AvailableNumber,
  ProvisionedNumber,
  VoiceProvider,
  WebCallToken,
} from './types'

const VAPI_BASE = 'https://api.vapi.ai'

function apiKey(): string {
  const key = process.env.VAPI_API_KEY
  if (!key) throw new Error('VAPI_API_KEY is not set')
  return key
}

function publicKey(): string {
  const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY
  if (!key) throw new Error('NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set')
  return key
}

async function vapiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vapi ${init.method ?? 'GET'} ${path} failed: ${res.status} ${body}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// Using OpenAI voices — available on all Vapi accounts without extra integrations.
// 11Labs voices require a connected 11Labs account in the Vapi dashboard.
const VOICE_PRESET_MAP: Record<string, { provider: string; voiceId: string }> = {
  john: { provider: 'openai', voiceId: 'onyx' },
  sarah: { provider: 'openai', voiceId: 'nova' },
  mike: { provider: 'openai', voiceId: 'echo' },
  emma: { provider: 'openai', voiceId: 'shimmer' },
}

// ---- Trade-aware vocabulary ------------------------------------------------
// Drives the per-call language ("the condenser fan", not "the unit") and a
// short list of common issue patterns the agent should listen for. Keep
// these compact — bigger lists bleed into how Haiku speaks.

type TradeProfile = {
  trade: string                  // human-readable noun ("HVAC", "plumbing")
  systemNoun: string             // generic system noun for "what's broken" ("system", "fixture")
  exampleSystems: string         // comma-separated examples of trade-specific equipment
  emergencyKeywords: string      // comma-separated emergency triggers
  commonIssues: string           // 2-3 line summary of frequent calls
}

const TRADE_PROFILES: Record<string, TradeProfile> = {
  hvac: {
    trade: 'HVAC',
    systemNoun: 'system',
    exampleSystems: 'AC, furnace, heat pump, mini-split, boiler, air handler',
    emergencyKeywords: 'gas, smoke, fire, carbon monoxide, no heat in winter, no AC in heat',
    commonIssues: 'No-cool / no-heat, weird smell, water under furnace, ice on lines, error code on thermostat, capacitor failure, refrigerant leak.',
  },
  plumbing: {
    trade: 'plumbing',
    systemNoun: 'fixture',
    exampleSystems: 'water heater, sump pump, toilet, faucet, garbage disposal, main line, sewer line',
    emergencyKeywords: 'water leak, flooding, sewer backup, no water, gas smell, burst pipe',
    commonIssues: 'Leaks, clogs, water-heater failure, low pressure, running toilet, sump-pump failure during rain.',
  },
  roofing: {
    trade: 'roofing',
    systemNoun: 'roof',
    exampleSystems: 'shingles, flashing, gutters, soffit, fascia, skylight',
    emergencyKeywords: 'active leak, missing shingles after storm, ceiling water damage, tree on roof',
    commonIssues: 'Storm damage, leaks, missing shingles, gutter problems, replacement quotes after hail.',
  },
  electrical: {
    trade: 'electrical',
    systemNoun: 'circuit',
    exampleSystems: 'breaker, panel, outlet, switch, GFCI, generator, EV charger',
    emergencyKeywords: 'sparking, burning smell, smoke, no power, exposed wire, shock',
    commonIssues: 'Tripped breakers, dead outlets, panel upgrades, EV-charger installs, generator issues.',
  },
  deck_fence: {
    trade: 'deck and fence',
    systemNoun: 'structure',
    exampleSystems: 'deck boards, railings, posts, gates, panels',
    emergencyKeywords: 'structural collapse, fallen tree on fence, exposed nails',
    commonIssues: 'Repairs after storms, replacement quotes, gate adjustments, staining/sealing.',
  },
  landscaping: {
    trade: 'landscaping',
    systemNoun: 'property',
    exampleSystems: 'lawn, sprinklers, beds, hedges, sod, irrigation controller',
    emergencyKeywords: 'irrigation leak, fallen tree blocking access',
    commonIssues: 'Mowing schedules, irrigation repair, seasonal cleanup, design quotes.',
  },
  general_contractor: {
    trade: 'general contracting',
    systemNoun: 'project',
    exampleSystems: 'remodels, additions, drywall, framing, finish work',
    emergencyKeywords: 'structural concern, water intrusion, exposed wiring after demo',
    commonIssues: 'Estimates for remodels and repairs, scheduling site visits.',
  },
}

function tradeProfile(config: AssistantConfig): TradeProfile {
  const key = (config.businessType ?? '').toLowerCase()
  if (key in TRADE_PROFILES) return TRADE_PROFILES[key]
  // 'other' or null falls back to a neutral service-business profile.
  return {
    trade: config.businessTypeOther?.trim() || 'service',
    systemNoun: 'system',
    exampleSystems: '',
    emergencyKeywords: 'leak, fire, smoke, gas, flooding, no power',
    commonIssues: 'Repairs, scheduled maintenance, and quote requests.',
  }
}

export function buildSystemPrompt(config: AssistantConfig): string {
  const profile = tradeProfile(config)
  const services = config.services.length === 0
    ? '(none configured yet — escalate any service request to a human)'
    : config.services
        .map((s) => `- ${s.name} — ${s.bookDirectly ? 'bookable directly' : 'quote required'}${s.pricingNote ? ` · ${s.pricingNote}` : ''}`)
        .join('\n')
  const hours = Object.entries(config.businessHours)
    .map(([day, h]) => (h.closed ? `  ${day}: closed` : `  ${day}: ${h.open}–${h.close}`))
    .join('\n')

  const afterHoursLine =
    config.afterHoursMode === 'live_transfer' ? 'live-transfer the call to the on-call number'
      : config.afterHoursMode === 'escalate' ? 'page on-call by SMS/call and confirm a callback window'
      : 'take a clear message and promise a callback first thing in the morning'

  const tradeSpecificDoNots = config.businessType === 'hvac'
    ? '- Do not guess at diagnostics. Saying "sounds like your capacitor" before a tech sees it is wrong even when it\'s right — say "the tech will diagnose on-site."'
    : ''

  return `You are ${config.agentName}, the AI receptionist for ${config.businessName}, a ${profile.trade} business.

YOUR JOB
Answer inbound calls. Most callers are existing customers with a problem, prospects asking for pricing or scheduling, or someone confirming an appointment. Decide quickly which one you're talking to, collect the information the dispatcher needs, and end with a clear next step (booked / quoted / escalated / message taken).

GREETING
Open with: "${config.greeting}"

INFORMATION TO COLLECT (only ask for what's missing — never re-ask)
1. Caller's name.
2. Phone number to reach them on (if it differs from caller ID).
3. Service address (if the work is at a property — confirm if known).
4. The ${profile.systemNoun} or component involved${profile.exampleSystems ? ` (e.g. ${profile.exampleSystems})` : ''}.
5. Brief description of the problem or what they want quoted.
6. Urgency: emergency / today / this week / flexible.
7. Preferred time window if booking.

OUTCOME — pick exactly one
• BOOK when: the caller agrees to a specific date+time you've offered for a service that's marked "bookable directly" below. State the slot back once to confirm.
• QUOTE when: full system replacement, commercial property, insurance claim, or a service marked "quote required". Tell them a tech will visit/call to estimate and capture address + best contact time.
• ESCALATE when: emergency keywords are mentioned (${profile.emergencyKeywords}), the caller is upset, the issue is outside the services list, or the caller insists on speaking to a human. Promise a callback within a stated window.
• MESSAGE when: it's outside business hours and not an emergency. Take name + callback number + one-sentence reason + best window.

SERVICES
${services}

HOURS (${config.timezone})
${hours}

AFTER HOURS / EMERGENCY ROUTING
Outside the hours above, ${afterHoursLine}.
On any emergency keyword (${profile.emergencyKeywords}), interrupt the normal flow, confirm safety ("Are you somewhere safe right now?"), and route to escalation immediately — do not finish data collection first.

COMMON ISSUES IN THIS TRADE
${profile.commonIssues}
Use this only to recognize what the caller is describing — never volunteer it as a diagnosis. Diagnosis is the tech's job, not yours.

VOICE STYLE
- Tone: ${config.tone}${config.toneOther ? ` (${config.toneOther})` : ''}.
- Speaking rate: ${config.speakingRate ?? 'normal'}.
- Use ${profile.trade}-specific terminology when natural ("the condenser fan", "the air handler") — avoid vague words like "the unit" or "the thing."
- Confirmations are casual: "Got it — 1234 Oak Street, right?" Not: "Let me read that back: one-two-three-four Oak Street."
- One short sentence per turn whenever possible. Two if you must. Never three.

DO NOT
- DO NOT repeat the caller back to themselves. They just said it. Saying "So you said you have a furnace issue" wastes their time and signals you weren't listening. Acknowledge and move on.
- DO NOT say "I understand" before every reply. Once per call, max. Drop it entirely if the call is short.
- DO NOT apologize for things that aren't your fault. "I'm so sorry to hear that" → cut. Drop the corporate-apology cadence.
- DO NOT ask for information the caller already gave you. If they said the address, do not ask for it again.
- DO NOT loop on the same question. If they answered partially or ambiguously, restate the part you have and ask the specific missing piece — don't re-ask the whole thing.
- DO NOT promise pricing you don't have. For "quote required" services, say "we'll send someone to give you a written estimate" — never improvise a number.
- DO NOT promise dispatch times that conflict with the schedule. Offer a window and confirm before locking it in.
- DO NOT use filler phrases: "real quick", "just wanted to check in", "circle back", "touch base", "if you don't mind me asking". Cut them all.
- DO NOT spell the address back digit-by-digit unless they ask for that. Confirm naturally.
- DO NOT end the call until you've stated the outcome out loud: what's booked, what's escalated, or what message you took. The caller should hang up knowing exactly what happens next.${tradeSpecificDoNots ? '\n' + tradeSpecificDoNots : ''}

If you don't have enough information to take any of the four outcomes above, ESCALATE — do not invent a path forward.

${config.systemPromptAddendum ? '\nADDITIONAL INSTRUCTIONS FROM THE BUSINESS\n' + config.systemPromptAddendum : ''}`.trim()
}

// Quality labels surfaced to the owner map to specific Anthropic models here.
// Keeping this table local to the Vapi adapter so the rest of the app stays
// model-agnostic.
const MODEL_BY_TIER: Record<'fast' | 'balanced' | 'best', string> = {
  fast: 'claude-haiku-4-5-20251001',
  balanced: 'claude-sonnet-4-6',
  best: 'claude-opus-4-7',
}

function buildVapiPayload(config: AssistantConfig) {
  const voice = VOICE_PRESET_MAP[config.voicePreset] ?? VOICE_PRESET_MAP.john
  const tier = config.modelTier ?? 'balanced'
  const systemPrompt =
    config.customSystemPrompt && config.customSystemPrompt.trim()
      ? config.customSystemPrompt
      : buildSystemPrompt(config)

  const model: Record<string, unknown> = {
    provider: 'anthropic',
    model: MODEL_BY_TIER[tier],
    messages: [{ role: 'system', content: systemPrompt }],
  }
  if (typeof config.temperature === 'number') model.temperature = config.temperature
  if (typeof config.maxTokens === 'number') model.maxTokens = config.maxTokens

  const payload: Record<string, unknown> = {
    name: `${config.businessName} — ${config.agentName}`,
    model,
    voice: { provider: voice.provider, voiceId: voice.voiceId },
    firstMessage: config.greeting,
    recordingEnabled: config.recordingEnabled,
  }
  if (config.endCallPhrases && config.endCallPhrases.length > 0) {
    payload.endCallPhrases = config.endCallPhrases
  }
  if (typeof config.interruptionThresholdSec === 'number') {
    payload.interruptionThreshold = config.interruptionThresholdSec
  }
  if (typeof config.backchannelingEnabled === 'boolean') {
    payload.backchannelingEnabled = config.backchannelingEnabled
  }
  return payload
}

export const vapiProvider: VoiceProvider = {
  async createAssistant(config) {
    const res = await vapiFetch<{ id: string }>('/assistant', {
      method: 'POST',
      body: JSON.stringify(buildVapiPayload(config)),
    })
    return { assistantId: res.id }
  },

  async updateAssistant(assistantId, config) {
    await vapiFetch(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(buildVapiPayload(config)),
    })
  },

  async deleteAssistant(assistantId) {
    await vapiFetch(`/assistant/${assistantId}`, { method: 'DELETE' })
  },

  // Vapi's API doesn't expose a "list available numbers" endpoint — its
  // managed-Twilio flow just claims one in the requested area code.
  // Returning empty so callers know there's nothing to browse.
  async listAvailableNumbers(): Promise<AvailableNumber[]> {
    return []
  },

  async provisionNumber(areaCode): Promise<ProvisionedNumber> {
    const res = await vapiFetch<{ id: string; number: string }>('/phone-number', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'vapi',
        numberDesiredAreaCode: areaCode,
      }),
    })
    return { vapiNumberId: res.id, e164: res.number }
  },

  async attachNumberToAssistant(vapiNumberId, assistantId) {
    await vapiFetch(`/phone-number/${vapiNumberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ assistantId }),
    })
  },

  async releaseNumber(vapiNumberId) {
    await vapiFetch(`/phone-number/${vapiNumberId}`, { method: 'DELETE' })
  },

  async getWebCallToken(assistantId, metadata): Promise<WebCallToken> {
    return { publicKey: publicKey(), assistantId, metadata }
  },
}
