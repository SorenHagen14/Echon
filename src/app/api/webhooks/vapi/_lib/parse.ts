// Vapi webhook payloads aren't strictly typed and the shape has shifted
// across SDK versions. These helpers pull the fields we care about from
// either of the common locations defensively, returning null if absent.

export type VapiCall = {
  id?: string
  type?: string
  phoneNumber?: { number?: string }
  customer?: { number?: string }
  startedAt?: string
  endedAt?: string
  metadata?: Record<string, unknown>
}

export type VapiMessage = {
  type: string
  status?: string
  call?: VapiCall
  // Top-level fallbacks (older payloads put fields here, not under .call)
  phoneNumber?: { number?: string }
  customer?: { number?: string }
  // end-of-call-report fields
  endedReason?: string
  recordingUrl?: string
  recording?: { url?: string }
  transcript?: unknown
  artifact?: { transcript?: unknown; messages?: unknown }
  durationSeconds?: number
  cost?: number
  startedAt?: string
  endedAt?: string
  [key: string]: unknown
}

export function vapiCallId(m: VapiMessage): string | null {
  return m.call?.id ?? null
}

export function callerPhone(m: VapiMessage): string | null {
  return m.call?.customer?.number ?? m.customer?.number ?? null
}

export function calleePhone(m: VapiMessage): string | null {
  return m.call?.phoneNumber?.number ?? m.phoneNumber?.number ?? null
}

export function startedAt(m: VapiMessage): string | null {
  return m.call?.startedAt ?? (typeof m.startedAt === 'string' ? m.startedAt : null)
}

export function endedAt(m: VapiMessage): string | null {
  return m.call?.endedAt ?? (typeof m.endedAt === 'string' ? m.endedAt : null)
}

export function recordingUrl(m: VapiMessage): string | null {
  return m.recording?.url ?? (typeof m.recordingUrl === 'string' ? m.recordingUrl : null)
}

// Vapi sometimes returns transcript as a string, sometimes as a structured
// `artifact.messages` array. We persist whatever's available, preferring
// the structured form so the call detail UI can render turn-by-turn.
export function transcript(m: VapiMessage): unknown | null {
  if (m.artifact && typeof m.artifact === 'object') {
    const a = m.artifact as { messages?: unknown; transcript?: unknown }
    if (Array.isArray(a.messages) && a.messages.length > 0) return a.messages
    if (a.transcript != null) return a.transcript
  }
  if (m.transcript != null) return m.transcript
  return null
}

export function durationSec(m: VapiMessage): number | null {
  if (typeof m.durationSeconds === 'number') return Math.round(m.durationSeconds)
  const start = startedAt(m)
  const end = endedAt(m)
  if (start && end) {
    const sec = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
    return sec >= 0 ? sec : null
  }
  return null
}

export function costCents(m: VapiMessage): number | null {
  // Vapi reports cost in dollars (USD).
  return typeof m.cost === 'number' ? Math.round(m.cost * 100) : null
}

export function isInboundCall(m: VapiMessage): boolean {
  // Default to inbound; only flip if Vapi explicitly tags outbound.
  const t = m.call?.type
  if (typeof t === 'string' && t.toLowerCase().includes('outbound')) return false
  return true
}
