'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '../(auth)/actions'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/cases', label: 'Cases' },
  { href: '/calls', label: 'Calls' },
  { href: '/customers', label: 'Customers' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/settings', label: 'Settings' },
] as const

export function TopNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname()

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <div className="justify-self-start">
          <Link
            href="/dashboard"
            className="text-lg font-semibold text-zinc-900 dark:text-white"
          >
            Echon
          </Link>
        </div>

        <nav className="flex items-center gap-1 justify-self-center">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          {userEmail && (
            <span className="hidden text-xs text-zinc-500 sm:inline dark:text-zinc-400">
              {userEmail}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
