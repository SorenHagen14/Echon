import { SettingsRail } from './_components/SettingsRail'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-white">Settings</h1>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SettingsRail />
        </aside>

        <div>{children}</div>
      </div>
    </div>
  )
}
