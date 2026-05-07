import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

// Lazy singleton so the SDK isn't constructed at import time (env not yet
// loaded in some Next.js execution paths).
export function anthropic(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

// Models — keep in one place so model swaps are a one-line change.
export const MODELS = {
  // Cheap + fast. Use for action-plan generation, post-call extraction —
  // anything where Sonnet is overkill. ~5x cheaper input than Sonnet.
  haiku: 'claude-haiku-4-5-20251001',
} as const
