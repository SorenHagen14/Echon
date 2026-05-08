// Plain constants — must NOT live in a 'use server' file. Next.js
// serializes every export of a 'use server' module as a server-action
// handle, not as its actual value, so the client component would
// receive RPC stubs instead of arrays and crash on `.includes()`.

export const DEFAULT_TRIGGERS = [
  'Caller explicitly asks for a human, a representative, or to speak to a person',
  'Caller asks to speak to the owner or manager',
  'Caller is upset, cursing, or threatening to leave a review',
  'Caller mentions one of the trade emergency keywords (see prompt)',
  'Caller has called multiple times about the same unresolved issue',
  'Caller mentions legal action, an attorney, or the BBB',
  'Caller has an issue outside the services we offer',
  'Caller is calling from outside our service area',
] as const

export const DEFAULT_NON_TRIGGERS = [
  'Caller is asking about pricing',
  'Caller is asking about hours of operation',
  'Caller wants to leave a message after-hours',
  'Caller is asking whether we offer a particular service',
  'Caller is rescheduling an existing appointment',
  'Caller is confirming an existing booking',
] as const
