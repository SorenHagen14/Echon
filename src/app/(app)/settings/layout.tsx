import { createClient } from '@/lib/supabase/server'
import { SettingsRail } from './_components/SettingsRail'
import { ECHON_ADMIN_EMAIL } from './_constants'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const showDevTools = user?.email === ECHON_ADMIN_EMAIL

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-white">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SettingsRail showDevTools={showDevTools} />
        </aside>

        <div>{children}</div>
      </div>
    </div>
  )
}
