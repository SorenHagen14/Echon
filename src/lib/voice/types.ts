/**
 * VoiceProvider — the only abstraction over the underlying telephony platform.
 * Application code (server actions, webhook handlers, onboarding) imports from
 * `src/lib/voice` and never touches Vapi types directly.
 */

export type VoicePreset = 'john' | 'sarah' | 'mike' | 'emma'
export type Tone = 'professional' | 'friendly' | 'empathetic' | 'concise' | 'other'
export type AfterHoursMode = 'messages_only' | 'escalate' | 'live_transfer'

export interface AssistantConfig {
  agentName: string
  businessName: string
  voicePreset: VoicePreset
  tone: Tone
  toneOther?: string | null
  greeting: string
  systemPromptAddendum?: string | null
  services: Array<{
    name: string
    bookDirectly: boolean
    pricingNote?: string | null
  }>
  businessHours: Record<string, { open: string; close: string; closed: boolean }>
  // One-off closures (Christmas, July 4, etc.). Each entry is YYYY-MM-DD +
  // a label. Read by the system prompt; only future-dated entries are
  // surfaced to the assistant.
  holidays?: Array<{ date: string; label: string }>
  timezone: string
  afterHoursMode: AfterHoursMode
  oncallNumbers?: string[]
  quoteRules?: {
    autoQuoteFullReplacement: boolean
    autoQuoteCommercial: boolean
    autoQuoteInsurance: boolean
    customRules?: string | null
  }
  recordingEnabled: boolean

  // Voice persona advanced controls — surfaced in Settings → Receptionist
  // → Voice & persona.
  speakingRate?: 'slow' | 'normal' | 'fast'
  voiceSpeed?: number                         // TTS playback speed multiplier; 1.0 = default
  modelTier?: 'fast' | 'balanced' | 'best'   // maps to a specific Anthropic model
  temperature?: number                        // 0..1
  maxTokens?: number                          // per-turn output cap
  endCallPhrases?: string[]
  interruptionThresholdSec?: number           // 0.1..3.0
  backchannelingEnabled?: boolean
  // When set + non-empty, overrides the auto-generated system prompt.
  customSystemPrompt?: string | null

  // Trade context for the auto-generated prompt. Pulled from
  // `workspaces.business_type` / `business_type_other`.
  businessType?: string | null
  businessTypeOther?: string | null
  // Secondary trades — many shops do more than one (HVAC + plumbing,
  // roofing + gutters). Pulled from `workspaces.additional_trades`.
  additionalTrades?: string[]

  // 2-letter US state code (CA, FL, ...). Drives state-based recording
  // disclosure logic in the prompt.
  businessState?: string | null

  // Configurable escalation rules — surfaced in Settings → Escalation
  // and dropped verbatim into the system prompt.
  escalationTriggers?: string[]
  escalationNonTriggers?: string[]

  // What the agent is allowed to do on a call.
  // Values: 'booking' | 'messaging' | 'faq'
  // Default (empty/null) = all three enabled.
  agentCapabilities?: string[]
}

export interface AvailableNumber {
  e164: string
  areaCode: string
  city?: string | null
  state?: string | null
  monthlyCostCents: number
}

export interface ProvisionedNumber {
  vapiNumberId: string
  e164: string
}

export interface WebCallToken {
  publicKey: string
  assistantId: string
  metadata?: Record<string, unknown>
}

export interface VoiceProvider {
  createAssistant(config: AssistantConfig): Promise<{ assistantId: string }>
  updateAssistant(assistantId: string, config: AssistantConfig): Promise<void>
  deleteAssistant(assistantId: string): Promise<void>

  listAvailableNumbers(areaCode: string): Promise<AvailableNumber[]>
  provisionNumber(areaCode: string): Promise<ProvisionedNumber>
  // BYO Twilio: import a number the customer already owns in their own
  // Twilio account into Vapi. Vapi keeps the Twilio creds attached so it
  // can place outbound calls and route inbound through the same number.
  importTwilioNumber(input: {
    e164Number: string
    twilioAccountSid: string
    twilioAuthToken: string
    label?: string
  }): Promise<ProvisionedNumber>
  attachNumberToAssistant(vapiNumberId: string, assistantId: string): Promise<void>
  releaseNumber(vapiNumberId: string): Promise<void>

  getWebCallToken(assistantId: string, metadata?: Record<string, unknown>): Promise<WebCallToken>
}
