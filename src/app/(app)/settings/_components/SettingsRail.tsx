'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { SETTINGS_GROUPS, type SettingsGroup, type SettingsItem } from '../_constants'

export function SettingsRail({ showDevTools }: { showDevTools: boolean }) {
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const [showComingSoon, setShowComingSoon] = useState(false)

  const allGroups: SettingsGroup[] = showDevTools
    ? [...SETTINGS_GROUPS, { label: 'Dev', items: [{ slug: 'dev', label: 'Dev tools' }] }]
    : [...SETTINGS_GROUPS]

  // Search filter — matches against label + keywords. Empty query = no filter.
  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!q) return null // sentinel: render the normal grouped layout
    const matches = (item: SettingsItem) => {
      if (item.label.toLowerCase().includes(q)) return true
      return (item.keywords ?? []).some((k) => k.toLowerCase().includes(q))
    }
    return allGroups
      .map((g) => ({ ...g, items: g.items.filter(matches) }))
      .filter((g) => g.items.length > 0)
  }, [q, allGroups])

  // Split into "live" vs "coming soon" so the placeholders don't drown
  // the rail. They're still searchable when the user explicitly looks
  // for them.
  const liveGroups = allGroups.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.comingSoon),
  })).filter((g) => g.items.length > 0)
  const comingSoonItems = allGroups.flatMap((g) =>
    g.items.filter((i) => i.comingSoon).map((i) => ({ ...i, group: g.label })),
  )

  return (
    <nav className="flex flex-col gap-4">
      {/* ---- SEARCH ----------------------------------------------------- */}
      <div className="relative">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="Search settings…"
          className="w-full rounded-md border border-zinc-200 bg-white py-1.5 pl-7 pr-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* ---- FILTERED RESULTS (when searching) ------------------------- */}
      {filteredGroups && (
        filteredGroups.length === 0 ? (
          <p className="px-3 text-xs text-zinc-500 dark:text-zinc-400">
            No settings match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          filteredGroups.map((group) => (
            <RailGroup key={group.label} group={group} pathname={pathname} highlight={q} />
          ))
        )
      )}

      {/* ---- DEFAULT GROUPED LAYOUT (when not searching) --------------- */}
      {!filteredGroups && (
        <>
          {liveGroups.map((group) => (
            <RailGroup key={group.label} group={group} pathname={pathname} />
          ))}
          {comingSoonItems.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowComingSoon((v) => !v)}
                className="flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <span>Coming soon</span>
                <span aria-hidden="true">{showComingSoon ? '▴' : '▾'}</span>
              </button>
              {showComingSoon && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {comingSoonItems.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/settings/${item.slug}`}
                        className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                          pathname === `/settings/${item.slug}`
                            ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white'
                            : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                        }`}
                      >
                        {item.label}
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">soon</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </nav>
  )
}

function RailGroup({ group, pathname, highlight }: {
  group: SettingsGroup
  pathname: string
  highlight?: string
}) {
  return (
    <div>
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
                {highlight ? <Highlighted text={item.label} q={highlight} /> : item.label}
                {item.comingSoon && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">soon</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Highlighted({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q)
  if (idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5 text-zinc-900 dark:bg-yellow-500/40 dark:text-yellow-50">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
