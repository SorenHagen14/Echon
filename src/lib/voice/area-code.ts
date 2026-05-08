// Area-code suggestion for number provisioning.
//
// Two signals, in order of trust:
//   1. The business phone — the area code they already use is the one
//      customers expect to see. Best signal we have.
//   2. The business address — parse the US state, fall back to the
//      most-populous area code in that state.
//
// Returns null if neither signal yields a plausible NPA. Callers should
// treat this as a hint, not a constraint — the user can always type
// their own.

export type AreaCodeSuggestion = {
  areaCode: string
  source: 'phone' | 'state'
  state?: string
}

// US states + DC → primary area code (the area code covering the
// largest metro in the state). Not exhaustive; we only need *one*
// sensible default per state for the prefill.
const STATE_PRIMARY_AREA_CODE: Record<string, string> = {
  AL: '205', AK: '907', AZ: '602', AR: '501', CA: '213', CO: '303',
  CT: '203', DE: '302', DC: '202', FL: '305', GA: '404', HI: '808',
  ID: '208', IL: '312', IN: '317', IA: '515', KS: '316', KY: '502',
  LA: '504', ME: '207', MD: '410', MA: '617', MI: '313', MN: '612',
  MS: '601', MO: '314', MT: '406', NE: '402', NV: '702', NH: '603',
  NJ: '201', NM: '505', NY: '212', NC: '704', ND: '701', OH: '216',
  OK: '405', OR: '503', PA: '215', RI: '401', SC: '803', SD: '605',
  TN: '615', TX: '214', UT: '801', VT: '802', VA: '804', WA: '206',
  WV: '304', WI: '414', WY: '307',
}

const US_STATES = new Set(Object.keys(STATE_PRIMARY_AREA_CODE))

// US area codes start with 2-9; 0/1 are invalid.
function isValidNpa(npa: string): boolean {
  return /^[2-9]\d{2}$/.test(npa)
}

export function extractAreaCodeFromPhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = input.replace(/\D/g, '')
  // Strip leading country code if present.
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length < 10) return null
  const npa = local.slice(0, 3)
  return isValidNpa(npa) ? npa : null
}

export function extractStateFromAddress(input: string | null | undefined): string | null {
  if (!input) return null
  // Match `, XX` or `, XX 12345` near the end of the string. State is the
  // last well-formed token because addresses usually trail with state +
  // zip. Case-insensitive but normalize to upper.
  const matches = [...input.matchAll(/(?:^|[\s,])([A-Za-z]{2})(?=\s*\d{5}|\s*$|[,.\s])/g)]
  for (let i = matches.length - 1; i >= 0; i--) {
    const code = matches[i][1].toUpperCase()
    if (US_STATES.has(code)) return code
  }
  return null
}

export function suggestAreaCode(args: {
  phone?: string | null
  address?: string | null
}): AreaCodeSuggestion | null {
  const fromPhone = extractAreaCodeFromPhone(args.phone)
  if (fromPhone) return { areaCode: fromPhone, source: 'phone' }

  const state = extractStateFromAddress(args.address)
  if (state) {
    const ac = STATE_PRIMARY_AREA_CODE[state]
    if (ac) return { areaCode: ac, source: 'state', state }
  }
  return null
}
