import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  SETTINGS_SECTION_SLUGS,
  SUPPORT_CONTACT,
  findSectionMeta,
  type SettingsSectionSlug,
} from '../_constants'
import { TeamSection, type Operator } from '../_components/TeamSection'
import { PhoneNumberSection, type PhoneNumberRow } from '../_components/PhoneNumberSection'
import { ScheduleSettingsForm } from '../../schedule/_components/ScheduleSettingsForm'
import { AccountSection } from '../_components/AccountSection'
import { DangerZone } from '../_components/DangerZone'
import { HoursSection, buildInitialHours } from '../_components/HoursSection'

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!SETTINGS_SECTION_SLUGS.includes(section as SettingsSectionSlug)) notFound()
  const slug = section as SettingsSectionSlug
  const meta = findSectionMeta(slug)!

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) redirect('/login')

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {meta.group}
      </p>
      <h2 className="mb-6 text-lg font-semibold text-zinc-900 dark:text-white">{meta.label}</h2>
      {await renderSection(slug, workspace.id as string, user.id, user.email ?? '')}
    </div>
  )
}

async function renderSection(
  slug: SettingsSectionSlug,
  workspaceId: string,
  userId: string,
  userEmail: string,
) {
  const supabase = await createClient()

  switch (slug) {
    // ---- Account ---------------------------------------------------------
    case 'profile': {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name, avatar_url')
        .eq('id', userId)
        .single()
      return (
        <div className="space-y-10">
          <AccountSection
            firstName={profile?.first_name ?? ''}
            lastName={profile?.last_name ?? ''}
            displayName={profile?.display_name ?? ''}
            email={userEmail}
            avatarUrl={profile?.avatar_url ?? null}
          />
          <DangerZone />
        </div>
      )
    }
    case 'notifications':
      return (
        <Placeholder>
          Email + SMS toggles for emergency escalations, daily digests, and
          missed-call alerts.
        </Placeholder>
      )

    // ---- Business --------------------------------------------------------
    case 'hours': {
      const { data: cfg } = await supabase
        .from('agent_configs')
        .select('business_hours, timezone')
        .eq('workspace_id', workspaceId)
        .single()
      return (
        <HoursSection
          initial={{
            hours: buildInitialHours(cfg?.business_hours),
            timezone: (cfg?.timezone as string | null) ?? null,
          }}
        />
      )
    }

    case 'services':
      return <Placeholder>Editable per-vertical service catalog with book-direct toggle, pricing notes, and quote-required override.</Placeholder>

    case 'schedule': {
      const { data: row } = await supabase
        .from('workspace_settings')
        .select('week_start, schedule_time_range')
        .eq('workspace_id', workspaceId)
        .single()
      const weekStart = (row?.week_start as 'sat' | 'sun' | 'mon') ?? 'sun'
      const timeRange = (row?.schedule_time_range as 'business' | 'full') ?? 'business'
      return (
        <>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Same controls as the gear icon on Schedule. Change either, both update.
          </p>
          <ScheduleSettingsForm weekStart={weekStart} timeRange={timeRange} />
        </>
      )
    }

    case 'team': {
      const { data: operators } = await supabase
        .from('operators')
        .select('id, name, email, phone, color, is_cs_rep, is_technician, is_manager, priority_cs, priority_tech, priority_manager, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
      return (
        <>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            The people who do the work — techs, dispatchers, owners. Add them
            here so the AI can route bookings to the right person.
          </p>
          <TeamSection operators={(operators ?? []) as Operator[]} />
        </>
      )
    }

    // ---- Receptionist ----------------------------------------------------
    case 'voice': {
      const [cfgRes, wsRes] = await Promise.all([
        supabase.from('agent_configs').select('*').eq('workspace_id', workspaceId).single(),
        supabase.from('workspaces').select('business_type, business_type_other').eq('id', workspaceId).single(),
      ])
      const cfg = cfgRes.data
      if (!cfg) {
        return (
          <Placeholder>
            Voice agent isn&apos;t provisioned yet. Finish onboarding first.
          </Placeholder>
        )
      }
      const { buildAssistantConfig } = await import('@/app/onboarding/_voice-sync')
      const { buildSystemPrompt } = await import('@/lib/voice')
      const generatedPreview = buildSystemPrompt(buildAssistantConfig(cfg, wsRes.data ?? null))
      const { VoicePersonaSection } = await import('../_components/VoicePersonaSection')
      return (
        <VoicePersonaSection
          config={{
            agent_name: (cfg.agent_name as string | null) ?? null,
            greeting: (cfg.greeting as string | null) ?? null,
            tone: ((cfg.tone as string | null) ?? 'friendly') as 'friendly' | 'professional' | 'direct',
            speaking_rate: ((cfg.speaking_rate as string | null) ?? 'normal') as 'slow' | 'normal' | 'fast',
            recording_enabled: Boolean(cfg.recording_enabled ?? true),
            voice_speed: cfg.voice_speed != null ? Number(cfg.voice_speed) : 1.0,
            use_custom_system_prompt: Boolean(cfg.use_custom_system_prompt),
            custom_system_prompt: (cfg.custom_system_prompt as string | null) ?? null,
            previous_custom_system_prompt: (cfg.previous_custom_system_prompt as string | null) ?? null,
            generated_system_prompt_preview: generatedPreview,
            model_tier: ((cfg.model_tier as string | null) ?? 'balanced') as 'fast' | 'balanced' | 'best',
            temperature: Number(cfg.temperature ?? 0.7),
            max_tokens: Number(cfg.max_tokens ?? 250),
            end_call_phrases: Array.isArray(cfg.end_call_phrases)
              ? (cfg.end_call_phrases as string[])
              : ['goodbye', 'bye'],
            interruption_threshold_sec: Number(cfg.interruption_threshold_sec ?? 0.5),
            backchanneling_enabled: Boolean(cfg.backchanneling_enabled ?? true),
            max_call_duration_sec: Number(cfg.max_call_duration_sec ?? 480),
            silence_timeout_sec: Number(cfg.silence_timeout_sec ?? 5),
          }}
        />
      )
    }

    case 'after-hours':
      return <Placeholder>What the AI does outside business hours: take a message, escalate to on-call, or live-transfer.</Placeholder>

    case 'escalation':
      return <Placeholder>On-call number(s) and emergency keywords that route a call straight to a human.</Placeholder>

    // ---- Connections -----------------------------------------------------
    case 'phone-number': {
      const { data: phoneRow } = await supabase
        .from('phone_numbers')
        .select('e164_number, status, provisioned_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('provisioned_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return <PhoneNumberSection existing={(phoneRow as PhoneNumberRow | null) ?? null} />
    }

    case 'calendar':
      return <Placeholder>Connect Google Calendar, Outlook, or your phone calendar.</Placeholder>

    case 'other-integrations':
      return (
        <Placeholder>
          Future: Jobber, Housecall Pro, ServiceTitan. Need one now? Contact {SUPPORT_CONTACT}.
        </Placeholder>
      )

    // ---- Billing ---------------------------------------------------------
    case 'plan':
      return <Placeholder>Plan, payment method, invoices, usage. Stripe integration deferred until pilot revenue.</Placeholder>
  }
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
      <p className="mt-2 text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-600">Coming soon</p>
    </div>
  )
}
