import { redirect } from 'next/navigation'
import { DEFAULT_SETTINGS_SECTION } from './_constants'

export default function SettingsIndexPage() {
  redirect(`/settings/${DEFAULT_SETTINGS_SECTION}`)
}
