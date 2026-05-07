'use client'

import { useRef, useState, useTransition } from 'react'
import {
  updateProfile,
  uploadAvatar,
  removeAvatar,
  requestEmailChange,
  requestPasswordReset,
  type AccountActionResult,
} from '../account-actions'
import { Avatar } from './Avatar'

type Props = {
  firstName: string
  lastName: string
  displayName: string
  email: string
  avatarUrl: string | null
}

type Status = { kind: 'idle' } | { kind: 'ok'; message: string } | { kind: 'error'; message: string }

export function AccountSection(props: Props) {
  return (
    <div className="space-y-10">
      <ProfileCard {...props} />
      <EmailCard email={props.email} />
      <PasswordCard />
    </div>
  )
}

function PasswordCard() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    startTransition(async () => {
      const result = await requestPasswordReset()
      applyStatus(result, setStatus)
    })
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Password</h3>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        We&apos;ll email you a link that lets you set a new password — no need to remember the old one.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending}
          className="rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
        >
          {isPending ? 'Sending…' : 'Send reset link'}
        </button>
        <StatusMessage status={status} />
      </div>
    </section>
  )
}

function ProfileCard({
  firstName: initialFirst,
  lastName: initialLast,
  displayName: initialDisplay,
  email,
  avatarUrl: initialAvatar,
}: Omit<Props, 'email'> & { email: string }) {
  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [displayName, setDisplayName] = useState(initialDisplay)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(form)
      applyStatus(result, setStatus)
    })
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.set('avatar', file)
    startTransition(async () => {
      const result = await uploadAvatar(form)
      if (result.ok) {
        // Optimistic refresh of the preview from the file's local blob URL while
        // the server-rendered avatar_url propagates on the next navigation.
        setAvatarUrl(URL.createObjectURL(file))
      }
      applyStatus(result, setStatus)
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleRemoveAvatar() {
    startTransition(async () => {
      const result = await removeAvatar()
      if (result.ok) setAvatarUrl(null)
      applyStatus(result, setStatus)
    })
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Profile</h3>

      <div className="mb-6 flex items-center gap-5">
        <Avatar url={avatarUrl} firstName={firstName} lastName={lastName} email={email} size={72} />
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              {avatarUrl ? 'Replace' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                disabled={isPending}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">JPEG, PNG, WebP, or GIF. Max 2 MB.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="first_name" value={firstName} onChange={setFirstName} />
          <Field label="Last name" name="last_name" value={lastName} onChange={setLastName} />
        </div>

        <Field
          label="Display name"
          name="display_name"
          value={displayName}
          onChange={setDisplayName}
          hint="Shown in the app instead of your first + last name. Leave blank to use your real name."
        />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          <StatusMessage status={status} />
        </div>
      </form>
    </section>
  )
}

function EmailCard({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await requestEmailChange(form)
      applyStatus(result, setStatus)
      if (result.ok) e.currentTarget.reset()
    })
  }

  return (
    <section>
      <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Email</h3>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Current: <span className="font-medium text-zinc-900 dark:text-white">{email}</span>
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New email" name="email" type="email" hint="We'll send a confirmation link to the new address. The change takes effect once you click it." />
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            {isPending ? 'Sending…' : 'Send confirmation link'}
          </button>
          <StatusMessage status={status} />
        </div>
      </form>
    </section>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string
  name: string
  value?: string
  onChange?: (v: string) => void
  type?: string
  hint?: string
}) {
  const controlled = value !== undefined && onChange !== undefined
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <input
        type={type}
        name={name}
        {...(controlled
          ? { value, onChange: (e) => onChange!(e.target.value) }
          : { defaultValue: '' })}
        className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
      />
      {hint && <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  )
}

function StatusMessage({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  return (
    <span
      className={
        status.kind === 'ok'
          ? 'text-sm text-emerald-700 dark:text-emerald-400'
          : 'text-sm text-red-600 dark:text-red-400'
      }
    >
      {status.message}
    </span>
  )
}

function applyStatus(result: AccountActionResult, setStatus: (s: Status) => void) {
  if (result.ok) setStatus({ kind: 'ok', message: result.message ?? 'Saved.' })
  else setStatus({ kind: 'error', message: result.error })
}
