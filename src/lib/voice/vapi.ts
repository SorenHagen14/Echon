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

// Verticals not in the `business_type` enum but common enough that we
// want trade-aware context. Matched by substring against the
// `businessTypeOther` free-text when business_type='other'.
const KNOWN_OTHER_TRADES: Array<{ match: string[]; profile: TradeProfile }> = [
  {
    match: ['pool', 'spa', 'hot tub'],
    profile: {
      trade: 'pool service',
      systemNoun: 'pool',
      exampleSystems: 'pump, filter, heater, chlorinator, salt cell, automation, vacuum',
      emergencyKeywords: 'major leak, pump failure during heatwave, electrical issue near water, green water at a public/event pool, swimmer ill',
      commonIssues: 'Pump and motor problems, leaks, green/cloudy water, heater outages, equipment replacement, weekly maintenance setup.',
    },
  },
  {
    match: ['appliance'],
    profile: {
      trade: 'appliance repair',
      systemNoun: 'appliance',
      exampleSystems: 'refrigerator, freezer, oven, range, dishwasher, washer, dryer',
      emergencyKeywords: 'gas smell, burning smell, smoke, water leaking onto floor, freezer thawing with food at risk',
      commonIssues: 'Refrigerators not cooling, washers leaking, dryers not heating, ovens not igniting, error codes.',
    },
  },
  {
    match: ['garage door', 'overhead door'],
    profile: {
      trade: 'garage door',
      systemNoun: 'door',
      exampleSystems: 'opener, springs, cables, rollers, panels, sensors',
      emergencyKeywords: 'door stuck open at night, broken spring with car trapped inside, snapped cable',
      commonIssues: 'Broken springs, cable replacement, opener failures, panel damage, sensor alignment.',
    },
  },
  {
    match: ['pest', 'exterminator'],
    profile: {
      trade: 'pest control',
      systemNoun: 'infestation',
      exampleSystems: 'ants, roaches, mice, rats, bedbugs, termites, wasps, hornets',
      emergencyKeywords: 'wasp/hornet nest at entrance, bedbug bites with kids, rodent in living space, allergic reaction',
      commonIssues: 'Recurring service quotes, one-time treatment, inspection requests, follow-up after treatment.',
    },
  },
  {
    match: ['locksmith'],
    profile: {
      trade: 'locksmith',
      systemNoun: 'lock',
      exampleSystems: 'deadbolt, knob, lever, smart lock, automotive key, transponder',
      emergencyKeywords: 'locked out of home in cold/heat, locked out of car with child or pet inside, break-in damage',
      commonIssues: 'Lockouts, rekey after move-in, key duplication, smart-lock installs, automotive keys.',
    },
  },
  {
    match: ['detail', 'auto detailing', 'car detail'],
    profile: {
      trade: 'auto detailing',
      systemNoun: 'vehicle',
      exampleSystems: 'interior, exterior, headlights, paint, wheels, engine bay',
      emergencyKeywords: 'pet/biohazard cleanup, fresh stain that needs same-day attention',
      commonIssues: 'Routine details, pre-sale prep, ceramic coating quotes, interior shampoo, paint correction estimates.',
    },
  },
]

// Resolve a single trade key to its profile. Falls back to KNOWN_OTHER_TRADES
// substring matching when the key is the literal 'other' marker.
function profileForKey(key: string, otherText: string | null): TradeProfile | null {
  const k = key.toLowerCase()
  if (k in TRADE_PROFILES) return TRADE_PROFILES[k]
  if ((k === 'other' || !k) && otherText) {
    const other = otherText.toLowerCase()
    for (const entry of KNOWN_OTHER_TRADES) {
      if (entry.match.some((m) => other.includes(m))) return entry.profile
    }
  }
  return null
}

const NEUTRAL_PROFILE: TradeProfile = {
  trade: 'service',
  systemNoun: 'system',
  exampleSystems: '',
  emergencyKeywords: 'leak, fire, smoke, gas, flooding, no power, exposed wire',
  commonIssues: 'Repairs, scheduled maintenance, and quote requests.',
}

// Merges multiple trade profiles into one — used when a workspace has a
// primary trade plus additional trades. We dedupe across the comma-joined
// fields so the prompt doesn't say the same word twice.
function mergeProfiles(profiles: TradeProfile[]): TradeProfile {
  if (profiles.length === 0) return NEUTRAL_PROFILE
  if (profiles.length === 1) return profiles[0]

  const tradeName = profiles.map((p) => p.trade).filter(Boolean).join(' + ')
  const dedupe = (vals: string[]) => {
    const seen = new Set<string>()
    return vals.flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
      .filter((s) => {
        const k = s.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .join(', ')
  }
  return {
    trade: tradeName,
    systemNoun: profiles[0].systemNoun,                // primary's noun wins
    exampleSystems: dedupe(profiles.map((p) => p.exampleSystems)),
    emergencyKeywords: dedupe(profiles.map((p) => p.emergencyKeywords)),
    commonIssues: profiles.map((p) => p.commonIssues).join(' '),
  }
}

function tradeProfile(config: AssistantConfig): TradeProfile {
  const primary = profileForKey(config.businessType ?? '', config.businessTypeOther ?? null)
  const additional = (config.additionalTrades ?? [])
    .map((k) => profileForKey(k, null))
    .filter((p): p is TradeProfile => p !== null)
  const all = [primary, ...additional].filter((p): p is TradeProfile => p !== null)
  if (all.length === 0) {
    // No mapped trade — fall back to neutral, but keep the user's free-text
    // label visible in the prompt so the agent knows what kind of business
    // it's answering for.
    return {
      ...NEUTRAL_PROFILE,
      trade: config.businessTypeOther?.trim() || 'service',
    }
  }
  return mergeProfiles(all)
}

// US states that require all-party (two-party) consent for call recording.
// If `business_state` is one of these AND recording is enabled, the prompt
// instructs the agent to disclose at the top of the call.
const TWO_PARTY_STATES = new Set([
  'CA','CT','DE','FL','IL','MD','MA','MT','NV','NH','PA','WA',
])
function needsRecordingDisclosure(state: string | null | undefined, recording: boolean): boolean {
  if (!recording || !state) return false
  return TWO_PARTY_STATES.has(state.toUpperCase())
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

  const today = new Date().toISOString().slice(0, 10)
  const upcomingHolidays = (config.holidays ?? [])
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)
  const holidaysSection = upcomingHolidays.length === 0
    ? ''
    : '\n\nHOLIDAYS — CLOSED ALL DAY\n' +
      upcomingHolidays.map((h) => `  ${h.date}: ${h.label}`).join('\n') +
      '\nIf a caller reaches you on one of these dates, treat the day as closed regardless of the weekly schedule above. Tell them: "We\'re closed today for ' +
      '<holiday label>." Then follow your after-hours / message-taking rules.'

  const afterHoursLine =
    config.afterHoursMode === 'live_transfer' ? 'live-transfer the call to the on-call number'
      : config.afterHoursMode === 'escalate' ? 'page on-call by SMS/call and confirm a callback window'
      : 'take a clear message and promise a callback first thing in the morning'

  const recordingDisclosure = needsRecordingDisclosure(config.businessState, config.recordingEnabled)
    ? '\nRECORDING DISCLOSURE — REQUIRED BY LAW IN THIS STATE\nRight after the greeting, before any other questions, say:\n  "Quick note — this call may be recorded for quality. Is that okay?"\nIf they say no, immediately say "No problem" and continue without further mention. If they say yes (or anything affirmative), continue.\nDo this on every call. Do not skip it, even if the caller jumps straight to their problem — pause them politely once: "Got it — before we go on, I just have to check: this call may be recorded for quality. Okay?" Then proceed.\n'
    : ''

  const escalateBlock = (config.escalationTriggers && config.escalationTriggers.length > 0)
    ? config.escalationTriggers.map((t) => `- ${t}`).join('\n')
    : '- Caller asks for a human or representative\n- Caller is upset, cursing, or threatening\n- Caller mentions emergency keywords\n- Caller has an issue outside the services we offer'

  const noEscalateBlock = (config.escalationNonTriggers && config.escalationNonTriggers.length > 0)
    ? config.escalationNonTriggers.map((t) => `- ${t}`).join('\n')
    : '- Caller is asking about pricing\n- Caller is asking about hours of operation\n- Caller is rescheduling an existing appointment'

  const serviceAreaSection = (() => {
    const parts: string[] = []
    if (config.businessState) parts.push(`We're based in ${config.businessState}.`)
    parts.push('If a caller is clearly outside our service area, escalate — don\'t book.')
    return parts.join(' ')
  })()

  return `You are ${config.agentName}, the AI receptionist for ${config.businessName}, a ${profile.trade} business.

YOUR JOB
Answer inbound calls. Most callers are existing customers with a problem, prospects asking for pricing or scheduling, or someone confirming an appointment. Decide quickly which one you're talking to, collect the information the team needs, and end with a clear next step (booked / quoted / escalated / message taken).

GREETING
Open with: "${config.greeting}"
${recordingDisclosure}
INFORMATION TO COLLECT (only ask for what's missing — never re-ask)
1. Caller's name.
2. Phone number to reach them on (if it differs from caller ID).
3. Service address (if the work is at a property — confirm if known).
4. Brief description of the problem or what they want quoted, in plain words.
5. Urgency: emergency / today / this week / flexible.
6. Preferred time window if booking.

OUTCOME — pick exactly one
• BOOK when: the caller agrees to a specific date+time you've offered for a service that's marked "bookable directly" below. State the slot back once to confirm.
• QUOTE when: full system replacement, commercial property, insurance claim, or a service marked "quote required". Tell them a tech will visit/call to estimate and capture address + best contact time.
• ESCALATE when ANY of the conditions in "ESCALATE IMMEDIATELY" below is true. Promise a callback within a stated window.
• MESSAGE when: it's outside business hours and not an emergency. Take name + callback number + one-sentence reason + best window.

ESCALATE IMMEDIATELY when any of these is true:
${escalateBlock}
Plus the trade emergency keywords: ${profile.emergencyKeywords}.
The "asks for a human" trigger is the most important — if the caller says "speak to a representative", "let me talk to a person", "get me a human", or anything similar, stop the script immediately. Capture only their name + callback number, tell them you'll have someone call them right back, and end the call. Do not try to handle anything else.

DO NOT escalate just because:
${noEscalateBlock}
Those are normal call topics — handle them in the normal flow above.

SERVICES
${services}

HOURS (${config.timezone})
${hours}${holidaysSection}

SERVICE AREA
${serviceAreaSection}

AFTER HOURS / EMERGENCY ROUTING
Outside the hours above, ${afterHoursLine}.
On any emergency keyword (${profile.emergencyKeywords}), interrupt the normal flow, confirm safety ("Are you somewhere safe right now?"), and route to escalation immediately — do not finish data collection first.

COMMON ISSUES IN THIS TRADE
${profile.commonIssues}
Use this only to recognize what the caller is describing — never volunteer it as a diagnosis. The caller doesn't need or want trade jargon. When they describe a symptom, just say "got it — a tech will come out and diagnose it on-site." Don't say "sounds like your condenser fan" or "could be the capacitor." A homeowner doesn't know those words and being told them feels condescending.

VOICE STYLE
- Tone: ${config.tone}${config.toneOther ? ` (${config.toneOther})` : ''}.
- Plain words. Match the caller's vocabulary — if they say "the unit", say "the unit". If they say "the AC", say "the AC". Don't escalate vocabulary on them.
- Confirmations are casual by default: "Got it — 1234 Oak Street, right?" If the caller specifically asks for a digit-by-digit readback, do it.
- One short sentence per turn whenever possible. Two if you must. Never three.

UPSET CALLERS — recognize and handle
Most callers are fine. A small number aren't, and you must handle them differently.

Signals (any one is enough):
- Raised voice or sustained loud volume.
- Cursing, sarcasm, or escalating language ("this is ridiculous", "I've been waiting forever", "are you kidding me").
- Repeated mention of how long they've been waiting, how many times they've called, or being passed around.
- Threats to leave a review, switch providers, or speak to an owner/manager.
- Refusal to answer your questions; pushing past the script.

When you detect any of those:
- Switch to short, calm, confident sentences. Don't speed up or get apologetic.
- Acknowledge once, briefly: "I hear you — let me get someone who can fix this now."
- Skip the rest of the data-collection flow. Capture just name + callback number.
- ESCALATE immediately. Do not try to resolve, quote, or book.
- Do NOT say "I understand how frustrating that must be" — corporate-apology phrasing makes upset callers angrier. Keep it specific and action-oriented.

Regular callers — even-toned, willing to answer questions, give information freely. Run the normal flow above.

DO NOT
- DO NOT repeat the caller back to themselves. They just said it. Saying "So you said you have a furnace issue" wastes their time and signals you weren't listening. Acknowledge and move on.
- DO NOT say "I understand" before every reply. Once per call, max. Drop it entirely if the call is short.
- DO NOT apologize for things that aren't your fault. "I'm so sorry to hear that" → cut. Drop the corporate-apology cadence.
- DO NOT ask for information the caller already gave you. If they said the address, do not ask for it again.
- DO NOT loop on the same question. If they answered partially or ambiguously, restate the part you have and ask the specific missing piece — don't re-ask the whole thing.
- DO NOT promise pricing you don't have. For "quote required" services, say "we'll send someone to give you a written estimate" — never improvise a number.
- DO NOT promise dispatch times that conflict with the schedule. Offer a window and confirm before locking it in.
- DO NOT use filler phrases: "real quick", "just wanted to check in", "circle back", "touch base", "if you don't mind me asking". Cut them all.
- DO NOT default to digit-by-digit address readback. Confirm naturally; do digit-by-digit only when the caller asks for that.
- DO NOT use trade-specific component names ("condenser fan", "capacitor", "expansion valve"). The caller doesn't know them.
- DO NOT end the call until you've stated the outcome out loud: what's booked, what's escalated, or what message you took. The caller should hang up knowing exactly what happens next.

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

  // Always send the speed — omitting it lets stale Vapi state stick. If
  // the user dragged the slider 1.2 → 1.0, we want Vapi to actually go
  // back to 1.0, not silently stay at 1.2.
  const voiceCfg: Record<string, unknown> = {
    provider: voice.provider,
    voiceId: voice.voiceId,
    speed: typeof config.voiceSpeed === 'number' ? config.voiceSpeed : 1,
  }

  const payload: Record<string, unknown> = {
    name: `${config.businessName} — ${config.agentName}`,
    model,
    voice: voiceCfg,
    firstMessage: config.greeting,
    recordingEnabled: config.recordingEnabled,
  }
  if (config.endCallPhrases && config.endCallPhrases.length > 0) {
    payload.endCallPhrases = config.endCallPhrases
  }
  // Vapi's stopSpeakingPlan replaces the whole object on PATCH — sending
  // only voiceSeconds wipes Vapi's other defaults. Send all three fields
  // so the agent's stop-speaking behavior stays sane.
  if (typeof config.interruptionThresholdSec === 'number') {
    payload.stopSpeakingPlan = {
      voiceSeconds: config.interruptionThresholdSec,
      numWords: 0,
      backoffSeconds: 1,
    }
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
