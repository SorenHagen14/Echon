'use client'

import { useActionState } from 'react'
import { updateLocation, type LocationResult } from '../location-actions'

const STATE_OPTIONS: Array<{ code: string; name: string; twoParty: boolean }> = [
  { code: 'AL', name: 'Alabama',          twoParty: false },
  { code: 'AK', name: 'Alaska',           twoParty: false },
  { code: 'AZ', name: 'Arizona',          twoParty: false },
  { code: 'AR', name: 'Arkansas',         twoParty: false },
  { code: 'CA', name: 'California',       twoParty: true  },
  { code: 'CO', name: 'Colorado',         twoParty: false },
  { code: 'CT', name: 'Connecticut',      twoParty: true  },
  { code: 'DE', name: 'Delaware',         twoParty: true  },
  { code: 'DC', name: 'District of Columbia', twoParty: false },
  { code: 'FL', name: 'Florida',          twoParty: true  },
  { code: 'GA', name: 'Georgia',          twoParty: false },
  { code: 'HI', name: 'Hawaii',           twoParty: false },
  { code: 'ID', name: 'Idaho',            twoParty: false },
  { code: 'IL', name: 'Illinois',         twoParty: true  },
  { code: 'IN', name: 'Indiana',          twoParty: false },
  { code: 'IA', name: 'Iowa',             twoParty: false },
  { code: 'KS', name: 'Kansas',           twoParty: false },
  { code: 'KY', name: 'Kentucky',         twoParty: false },
  { code: 'LA', name: 'Louisiana',        twoParty: false },
  { code: 'ME', name: 'Maine',            twoParty: false },
  { code: 'MD', name: 'Maryland',         twoParty: true  },
  { code: 'MA', name: 'Massachusetts',    twoParty: true  },
  { code: 'MI', name: 'Michigan',         twoParty: false },
  { code: 'MN', name: 'Minnesota',        twoParty: false },
  { code: 'MS', name: 'Mississippi',      twoParty: false },
  { code: 'MO', name: 'Missouri',         twoParty: false },
  { code: 'MT', name: 'Montana',          twoParty: true  },
  { code: 'NE', name: 'Nebraska',         twoParty: false },
  { code: 'NV', name: 'Nevada',           twoParty: true  },
  { code: 'NH', name: 'New Hampshire',    twoParty: true  },
  { code: 'NJ', name: 'New Jersey',       twoParty: false },
  { code: 'NM', name: 'New Mexico',       twoParty: false },
  { code: 'NY', name: 'New York',         twoParty: false },
  { code: 'NC', name: 'North Carolina',   twoParty: false },
  { code: 'ND', name: 'North Dakota',     twoParty: false },
  { code: 'OH', name: 'Ohio',             twoParty: false },
  { code: 'OK', name: 'Oklahoma',         twoParty: false },
  { code: 'OR', name: 'Oregon',           twoParty: false },
  { code: 'PA', name: 'Pennsylvania',     twoParty: true  },
  { code: 'RI', name: 'Rhode Island',     twoParty: false },
  { code: 'SC', name: 'South Carolina',   twoParty: false },
  { code: 'SD', name: 'South Dakota',     twoParty: false },
  { code: 'TN', name: 'Tennessee',        twoParty: false },
  { code: 'TX', name: 'Texas',            twoParty: false },
  { code: 'UT', name: 'Utah',             twoParty: false },
  { code: 'VT', name: 'Vermont',          twoParty: false },
  { code: 'VA', name: 'Virginia',         twoParty: false },
  { code: 'WA', name: 'Washington',       twoParty: true  },
  { code: 'WV', name: 'West Virginia',    twoParty: false },
  { code: 'WI', name: 'Wisconsin',        twoParty: false },
  { code: 'WY', name: 'Wyoming',          twoParty: false },
]

type Props = {
  state: string | null
  address: string | null
}

export function LocationSection({ state, address }: Props) {
  const [result, formAction, pending] = useActionState<LocationResult | null, FormData>(updateLocation, null)
  const selected = STATE_OPTIONS.find((s) => s.code === state)

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-white">
          State
        </label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          We use this to figure out whether your state requires recording
          disclosure on calls. Two-party-consent states (CA, FL, MA, etc.)
          need the agent to ask for permission before recording.
        </p>
        <select
          name="business_state"
          defaultValue={state ?? ''}
          className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        >
          <option value="">— pick a state —</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}{s.twoParty ? ' (recording disclosure required)' : ''}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {selected.twoParty
              ? `${selected.name} requires all-party consent for call recording. The agent will ask each caller "this call may be recorded for quality, is that okay?" right after the greeting.`
              : `${selected.name} is a one-party consent state. No on-call disclosure required.`}
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-900 dark:text-white">
          Business address
        </label>
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Used in the agent&apos;s service-area awareness — if a caller is
          obviously far away, the agent escalates instead of booking.
        </p>
        <input
          type="text"
          name="business_address"
          defaultValue={address ?? ''}
          placeholder="123 Main Street, Austin, TX 78701"
          className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      {result && result.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved and synced to Vapi.
        </div>
      )}
      {result && !result.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {result.reason}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
