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
  attachNumberToAssistant(vapiNumberId: string, assistantId: string): Promise<void>
  releaseNumber(vapiNumberId: string): Promise<void>

  getWebCallToken(assistantId: string, metadata?: Record<string, unknown>): Promise<WebCallToken>
}
