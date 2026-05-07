import { vapiProvider } from './vapi'
import type { VoiceProvider } from './types'

export const voice: VoiceProvider = vapiProvider
export type * from './types'
