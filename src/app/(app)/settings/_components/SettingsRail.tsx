'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SETTINGS_GROUPS } from '../_constants'

export function SettingsRail({ showDevTools }: { showDevTools: boolean }) {
  const pathname = usePathname()

  const groups = showDevTools
    ? [...SETTINGS_GROUPS, { label: 'Dev', items: [{ slug: 'dev', label: 'Dev tools' }] }]
    : SETTINGS_GROUPS

  return (
    <nav className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const href = `/settings/${item.slug}`
              const active = pathname === href
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
