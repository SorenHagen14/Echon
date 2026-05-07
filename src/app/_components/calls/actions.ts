'use server'

import { fetchCallDetail } from './data'
import type { CallDetail } from './types'

export async function loadCallDetail(callId: string): Promise<CallDetail | null> {
  if (!callId) return null
  return fetchCallDetail(callId)
}
