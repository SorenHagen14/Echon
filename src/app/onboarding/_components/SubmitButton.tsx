'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

type Variant = 'primary' | 'secondary'

type Props = {
  children: ReactNode
  variant?: Variant
  className?: string
}

const BASE = 'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const VARIANTS: Record<Variant, string> = {
  primary:   'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
  secondary: 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
}

export function SubmitButton({ children, variant = 'primary', className = '' }: Props) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {pending ? 'Saving…' : children}
    </button>
  )
}
