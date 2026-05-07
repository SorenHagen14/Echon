import { voice } from '@/lib/voice'
import type { AssistantConfig, AfterHoursMode, Tone, VoicePreset } from '@/lib/voice'
import type { createClient } from '@/lib/supabase/server'

type Supa = Awaited<ReturnType<typeof createClient>>

/**
 * Sync the workspace's Vapi assistant with the current `agent_configs` row.
 * - Creates the assistant on first call (when `vapi_assistant_id` is null).
 * - Updates it on every subsequent call.
 *
 * Soft-fails: a Vapi error is logged but does not block onboarding. The next
 * save will re-attempt. If `VAPI_API_KEY` is unset (e.g. dev without Vapi),
 * we skip entirely so the wizard remains usable.
 *
 * Skips when `business_name` is missing — the assistant can't be named yet.
 */
export async function syncVapiAssistant(supabase: Supa, workspaceId: string): Promise<void> {
  console.log(
    '[voice-sync] called for workspace',
    workspaceId,
    '— VAPI_API_KEY set:',
    !!process.env.VAPI_API_KEY,
    '— public key set:',
    !!process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY,
    '— ANTHROPIC_API_KEY set:',
    !!process.env.ANTHROPIC_API_KEY,
  )
  if (!process.env.VAPI_API_KEY) {
    console.warn('[voice-sync] VAPI_API_KEY not loaded into server — restart npm run dev')
    return
  }

  const { data: cfg, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !cfg) {
    console.warn('[voice-sync] no agent_configs row for workspace', workspaceId, error)
    return
  }
  console.log('[voice-sync] cfg loaded — business_name:', JSON.stringify(cfg.business_name), 'vapi_assistant_id:', cfg.vapi_assistant_id)
  if (!cfg.business_name) {
    console.warn('[voice-sync] business_name is empty — Step 4 write may have failed silently')
    return
  }

  const config = buildAssistantConfig(cfg)

  try {
    if (cfg.vapi_assistant_id) {
      console.log('[voice-sync] updating assistant', cfg.vapi_assistant_id)
      await voice.updateAssistant(cfg.vapi_assistant_id, config)
      console.log('[voice-sync] update ok')
    } else {
      console.log('[voice-sync] creating assistant for workspace', workspaceId)
      const { assistantId } = await voice.createAssistant(config)
      console.log('[voice-sync] created assistant', assistantId)
      await supabase
        .from('agent_configs')
        .update({ vapi_assistant_id: assistantId })
        .eq('workspace_id', workspaceId)
    }
  } catch (e) {
    console.error('[voice-sync] vapi sync failed for workspace', workspaceId, String(e))
  }
}

function buildAssistantConfig(cfg: Record<string, unknown>): AssistantConfig {
  const businessName = String(cfg.business_name ?? 'our shop')
  const agentName = String(cfg.agent_name ?? 'John')
  const tone = (cfg.tone as Tone | null) ?? 'professional'
  const voicePreset = (cfg.voice_preset as VoicePreset | null) ?? 'john'
  const afterHoursMode = (cfg.after_hours_mode as AfterHoursMode | null) ?? 'messages_only'
  const greeting =
    (cfg.greeting as string | null) ??
    `Thanks for calling ${businessName}, this is ${agentName}. How can I help?`

  const services = Array.isArray(cfg.services)
    ? (cfg.services as Array<Record<string, unknown>>).map((s) => ({
        name: String(s.label ?? s.key ?? 'service'),
        bookDirectly: Boolean(s.book_directly ?? true),
        pricingNote: (s.pricing_note as string | null) || null,
      }))
    : []

  const businessHours =
    (cfg.business_hours as AssistantConfig['businessHours'] | null) ?? {
      mon: { open: '08:00', close: '17:00', closed: false },
      tue: { open: '08:00', close: '17:00', closed: false },
      wed: { open: '08:00', close: '17:00', closed: false },
      thu: { open: '08:00', close: '17:00', closed: false },
      fri: { open: '08:00', close: '17:00', closed: false },
      sat: { open: '00:00', close: '00:00', closed: true },
      sun: { open: '00:00', close: '00:00', closed: true },
    }

  const oncallList = Array.isArray(cfg.oncall_numbers)
    ? (cfg.oncall_numbers as Array<{ phone?: string }>).map((n) => n.phone).filter(Boolean) as string[]
    : []

  return {
    agentName,
    businessName,
    voicePreset,
    tone,
    toneOther: (cfg.tone_other as string | null) ?? null,
    greeting,
    systemPromptAddendum: (cfg.system_prompt_addendum as string | null) ?? null,
    services,
    businessHours,
    timezone: (cfg.timezone as string | null) ?? 'America/New_York',
    afterHoursMode,
    oncallNumbers: oncallList,
    quoteRules: {
      autoQuoteFullReplacement: Boolean(cfg.quote_rule_replacement),
      autoQuoteCommercial: Boolean(cfg.quote_rule_commercial),
      autoQuoteInsurance: Boolean(cfg.quote_rule_insurance),
      customRules: (cfg.quote_rule_custom as string | null) ?? null,
    },
    recordingEnabled: Boolean(cfg.recording_enabled ?? true),
  }
}
