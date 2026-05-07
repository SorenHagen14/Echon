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
        <AccountSection
          firstName={profile?.first_name ?? ''}
          lastName={profile?.last_name ?? ''}
          displayName={profile?.display_name ?? ''}
          email={userEmail}
          avatarUrl={profile?.avatar_url ?? null}
        />
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
    case 'hours':
      return <Placeholder>Day × hours grid + holidays + timezone. Same shape as onboarding Step 6.</Placeholder>

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
    case 'voice':
      return <Placeholder>Mirrors onboarding Step 9 — agent name, voice, tone, greeting, system-prompt addendum, recording toggle.</Placeholder>

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
