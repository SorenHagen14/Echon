import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  SETTINGS_SECTION_SLUGS,
  SUPPORT_CONTACT,
  ECHON_ADMIN_EMAIL,
  findSectionMeta,
  type SettingsSectionSlug,
} from '../_constants'
import { TeamSection, type Operator } from '../_components/TeamSection'
import { PhoneNumberSection, type PhoneNumberRow } from '../_components/PhoneNumberSection'
import { ScheduleSettingsForm } from '../../schedule/_components/ScheduleSettingsForm'
import { AccountSection } from '../_components/AccountSection'
import { DangerZone } from '../_components/DangerZone'
import { HoursSection } from '../_components/HoursSection'
import { buildInitialHours, normalizeHolidays } from '../_components/hours-shape'
import { ServicesSection } from '../_components/ServicesSection'
import { normalizeServices } from '../_components/services-shape'
import { BUSINESS_TYPE_OPTIONS, getServiceCatalog, type BusinessType } from '@/app/onboarding/_constants'

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
    case 'location': {
      const { data: cfg } = await supabase
        .from('agent_configs')
        .select('business_state, business_address')
        .eq('workspace_id', workspaceId)
        .single()
      const { LocationSection } = await import('../_components/LocationSection')
      return (
        <LocationSection
          state={(cfg?.business_state as string | null) ?? null}
          address={(cfg?.business_address as string | null) ?? null}
        />
      )
    }

    case 'trades': {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('business_type, business_type_other, additional_trades')
        .eq('id', workspaceId)
        .single()
      const { TradesSection } = await import('../_components/TradesSection')
      return (
        <TradesSection
          primary={(ws?.business_type as string | null) ?? null}
          primaryOther={(ws?.business_type_other as string | null) ?? null}
          additional={Array.isArray(ws?.additional_trades) ? (ws!.additional_trades as string[]) : []}
        />
      )
    }

    case 'hours': {
      const { data: cfg } = await supabase
        .from('agent_configs')
        .select('business_hours, timezone, holidays')
        .eq('workspace_id', workspaceId)
        .single()
      return (
        <HoursSection
          initial={{
            hours: buildInitialHours(cfg?.business_hours),
            timezone: (cfg?.timezone as string | null) ?? null,
            holidays: normalizeHolidays(cfg?.holidays),
          }}
        />
      )
    }

    case 'services': {
      const [cfgRes, wsRes] = await Promise.all([
        supabase.from('agent_configs').select('services').eq('workspace_id', workspaceId).single(),
        supabase.from('workspaces').select('business_type, business_type_other').eq('id', workspaceId).single(),
      ])
      const businessType = (wsRes.data?.business_type as BusinessType | null) ?? null
      const catalog = getServiceCatalog(businessType)
      const btOpt = BUSINESS_TYPE_OPTIONS.find((o) => o.value === businessType)
      const businessTypeLabel =
        businessType === 'other'
          ? (wsRes.data?.business_type_other as string | null) || 'Other'
          : btOpt?.label ?? null
      return (
        <ServicesSection
          initial={normalizeServices(cfgRes.data?.services)}
          catalog={catalog}
          businessTypeLabel={businessTypeLabel}
        />
      )
    }

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
      const [{ data: operators }, { data: wsTeam }] = await Promise.all([
        supabase
          .from('operators')
          .select('id, name, email, phone, color, is_cs_rep, is_technician, is_manager, priority_cs, priority_tech, priority_manager, created_at')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
        supabase
          .from('workspaces')
          .select('business_type')
          .eq('id', workspaceId)
          .single(),
      ])
      return (
        <>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            The people who do the work — techs, dispatchers, owners. Add them
            here so the AI can route bookings to the right person.
          </p>
          <TeamSection
            operators={(operators ?? []) as Operator[]}
            businessType={(wsTeam?.business_type as BusinessType | null) ?? null}
          />
        </>
      )
    }

    // ---- Receptionist ----------------------------------------------------
    case 'voice': {
      const [cfgRes, wsRes] = await Promise.all([
        supabase.from('agent_configs').select('*').eq('workspace_id', workspaceId).single(),
        supabase.from('workspaces').select('business_type, business_type_other, additional_trades').eq('id', workspaceId).single(),
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

      // Default first-message script: "Thanks for calling [Business],
      // this is [Agent]. How can I help?" Backfilled when greeting is
      // blank so the user always sees a usable starting point in the UI.
      const businessName = (cfg.business_name as string | null) ?? 'our shop'
      const agentName = (cfg.agent_name as string | null) ?? 'Riley'
      const defaultGreeting = `Thanks for calling ${businessName}, this is ${agentName}. How can I help?`
      const greetingValue = ((cfg.greeting as string | null) ?? '').trim() || defaultGreeting

      // Drift indicator: show a banner if any field on agent_configs has
      // changed since the last successful Vapi push.
      const updatedAt = cfg.updated_at ? new Date(cfg.updated_at as string).getTime() : 0
      const syncedAt = cfg.vapi_synced_at ? new Date(cfg.vapi_synced_at as string).getTime() : 0
      const driftDetected = updatedAt > 0 && updatedAt > syncedAt + 1000 // 1s buffer for clock skew

      return (
        <VoicePersonaSection
          config={{
            agent_name: agentName,
            greeting: greetingValue,
            tone: ((cfg.tone as string | null) ?? 'friendly') as 'friendly' | 'professional' | 'direct',
            recording_enabled: Boolean(cfg.recording_enabled ?? true),
            voice_speed: cfg.voice_speed != null ? Number(cfg.voice_speed) : 1.0,
            use_custom_system_prompt: Boolean(cfg.use_custom_system_prompt),
            custom_system_prompt: (cfg.custom_system_prompt as string | null) ?? null,
            previous_custom_system_prompt: (cfg.previous_custom_system_prompt as string | null) ?? null,
            generated_system_prompt_preview: generatedPreview,
            temperature: Number(cfg.temperature ?? 0.7),
            max_tokens: Number(cfg.max_tokens ?? 250),
            end_call_phrases: Array.isArray(cfg.end_call_phrases)
              ? (cfg.end_call_phrases as string[])
              : ['goodbye', 'bye'],
            interruption_threshold_sec: Number(cfg.interruption_threshold_sec ?? 0.5),
            max_call_duration_sec: Number(cfg.max_call_duration_sec ?? 480),
            silence_timeout_sec: Number(cfg.silence_timeout_sec ?? 5),
            drift_detected: driftDetected,
          }}
        />
      )
    }

    case 'after-hours':
      return <Placeholder>What the AI does outside business hours: take a message, escalate to on-call, or live-transfer.</Placeholder>

    case 'escalation': {
      const { data: cfg } = await supabase
        .from('agent_configs')
        .select('escalation_triggers, escalation_non_triggers')
        .eq('workspace_id', workspaceId)
        .single()
      const { EscalationSection } = await import('../_components/EscalationSection')
      return (
        <EscalationSection
          initialTriggers={(cfg?.escalation_triggers as string[] | null) ?? []}
          initialNonTriggers={(cfg?.escalation_non_triggers as string[] | null) ?? []}
        />
      )
    }

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

    // ---- Dev tools (admin only) ------------------------------------------
    case 'dev': {
      const { data: { user: devUser } } = await (await createClient()).auth.getUser()
      if (devUser?.email !== ECHON_ADMIN_EMAIL) notFound()

      const { data: ws } = await (await createClient())
        .from('workspaces')
        .select('business_type')
        .eq('id', workspaceId)
        .single()
      const current = (ws?.business_type as BusinessType | null) ?? null

      const { devSetTrade } = await import('../actions')
      return (
        <div className="space-y-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            Admin-only. Remove or move to the admin dashboard before public launch.
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-white">Trade switcher</h3>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              Override the workspace&apos;s <code className="font-mono">business_type</code> to preview
              how role configs, service catalogs, and AI prompts behave for each trade.
            </p>
            <form action={devSetTrade} className="flex items-center gap-3">
              <select
                name="business_type"
                defaultValue={current ?? ''}
                className="block rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="" disabled>— select trade —</option>
                {BUSINESS_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Apply
              </button>
              {current && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Current: <strong>{BUSINESS_TYPE_OPTIONS.find((o) => o.value === current)?.label ?? current}</strong>
                </span>
              )}
            </form>
          </div>
        </div>
      )
    }
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
