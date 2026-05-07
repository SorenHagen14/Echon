// Neutral module so server components can import these without going
// through the client-component boundary (see WindowPicker for the same
// pattern + reasoning).

export const SORT_OPTIONS = [
  { value: 'recent',   label: 'Most recent contact' },
  { value: 'frequent', label: 'Most frequent caller' },
  { value: 'name',     label: 'Name (A-Z)' },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]['value']
