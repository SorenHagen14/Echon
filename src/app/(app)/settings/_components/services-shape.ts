export type ServiceRow = {
  key: string
  label: string
  book_directly: boolean
  pricing_note: string
}

export function normalizeServices(raw: unknown): ServiceRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((r): ServiceRow | null => {
      if (!r || typeof r !== 'object') return null
      const o = r as Record<string, unknown>
      const key = typeof o.key === 'string' ? o.key : null
      const label = typeof o.label === 'string' ? o.label : null
      if (!key || !label) return null
      return {
        key,
        label,
        book_directly: typeof o.book_directly === 'boolean' ? o.book_directly : true,
        pricing_note: typeof o.pricing_note === 'string' ? o.pricing_note : '',
      }
    })
    .filter((r): r is ServiceRow => r !== null)
}
