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

function buildSystemPrompt(config: AssistantConfig): string {
  const services = config.services
    .map((s) => `- ${s.name}${s.bookDirectly ? ' (bookable)' : ' (quote only)'}${s.pricingNote ? ` — ${s.pricingNote}` : ''}`)
    .join('\n')
  const hours = Object.entries(config.businessHours)
    .map(([day, h]) => (h.closed ? `${day}: closed` : `${day}: ${h.open}–${h.close}`))
    .join('\n')

  return [
    `You are ${config.agentName}, the AI receptionist for ${config.businessName}.`,
    `Tone: ${config.tone}${config.toneOther ? ` (${config.toneOther})` : ''}.`,
    `Greeting: ${config.greeting}`,
    '',
    'Services:',
    services,
    '',
    `Hours (${config.timezone}):`,
    hours,
    '',
    `After-hours behavior: ${config.afterHoursMode}.`,
    config.quoteRules?.customRules ? `Quote rules: ${config.quoteRules.customRules}` : '',
    config.systemPromptAddendum ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildVapiPayload(config: AssistantConfig) {
  const voice = VOICE_PRESET_MAP[config.voicePreset] ?? VOICE_PRESET_MAP.john
  return {
    name: `${config.businessName} — ${config.agentName}`,
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      messages: [{ role: 'system', content: buildSystemPrompt(config) }],
    },
    voice: { provider: voice.provider, voiceId: voice.voiceId },
    firstMessage: config.greeting,
    recordingEnabled: config.recordingEnabled,
  }
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
