// Plain (non-client, non-server) module so server components can import the
// constant without it getting wrapped as a client reference. Marking the
// `WindowPicker` file `'use client'` would otherwise turn `WINDOW_OPTIONS`
// into a proxy that doesn't have `.map` on the server side.

export const WINDOW_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d',    label: 'Past 7 days' },
  { value: '30d',   label: 'Past 30 days' },
  { value: '365d',  label: 'Past year' },
  { value: 'ytd',   label: 'Year to date' },
  { value: 'all',   label: 'All time' },
] as const

export type WindowKey = (typeof WINDOW_OPTIONS)[number]['value']
