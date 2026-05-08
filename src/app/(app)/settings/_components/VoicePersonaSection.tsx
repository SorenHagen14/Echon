'use client'

import { useActionState, useEffect, useState } from 'react'
import { revertSystemPrompt, updateVoicePersona, type VoicePersonaResult } from '../voice-actions'

export type VoicePersonaConfig = {
  agent_name: string | null
  greeting: string | null
  tone: 'friendly' | 'professional' | 'direct'
  speaking_rate: 'slow' | 'normal' | 'fast'
  voice_speed: number
  recording_enabled: boolean
  use_custom_system_prompt: boolean
  custom_system_prompt: string | null
  previous_custom_system_prompt: string | null
  generated_system_prompt_preview: string  // shown when custom is off
  model_tier: 'fast' | 'balanced' | 'best'
  temperature: number
  max_tokens: number
  end_call_phrases: string[]
  interruption_threshold_sec: number
  backchanneling_enabled: boolean
  max_call_duration_sec: number
  silence_timeout_sec: number
}

const ADVANCED_KEY = 'echon.settings.voice.showAdvanced'

export function VoicePersonaSection({ config }: { config: VoicePersonaConfig }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useCustom, setUseCustom] = useState(config.use_custom_system_prompt)
  const [confirmedPromptEdit, setConfirmedPromptEdit] = useState(false)
  const [customPrompt, setCustomPrompt] = useState(
    config.custom_system_prompt ?? config.generated_system_prompt_preview ?? '',
  )
  const [voiceSpeed, setVoiceSpeed] = useState(config.voice_speed ?? 1.0)
  const [state, formAction, pending] = useActionState<VoicePersonaResult | null, FormData>(
    updateVoicePersona,
    null,
  )

  // Read the persisted toggle once after hydration, never during render —
  // otherwise the SSR'd "Show" button hydrates into a "Hide" button and
  // React panics about a mismatch.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(ADVANCED_KEY) === '1') setShowAdvanced(true)
  }, [])
  function setShowAdvancedPersisted(v: boolean) {
    setShowAdvanced(v)
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADVANCED_KEY, v ? '1' : '0')
    }
  }

  async function onRevert() {
    if (!confirm('Revert the system prompt to the previous version? Your current prompt will be saved as the new "previous" version.')) return
    await revertSystemPrompt()
    window.location.reload()
  }

  return (
    <form action={formAction} className="space-y-8">
      {/* ---- BASICS ----------------------------------------------------- */}
      <FormCard>
        <CardTitle>Basics</CardTitle>

        <Field label="Agent name">
          <input
            type="text"
            name="agent_name"
            defaultValue={config.agent_name ?? 'Riley'}
            maxLength={40}
            className={inputCls}
          />
        </Field>

        <Field label="First message" hint="What the agent says when it picks up.">
          <textarea
            name="greeting"
            defaultValue={config.greeting ?? ''}
            rows={2}
            placeholder="Thanks for calling — this is Riley, how can I help?"
            className={textareaCls}
          />
        </Field>

        <Field label="Tone">
          <select name="tone" defaultValue={config.tone} className={inputCls}>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="direct">Direct</option>
          </select>
        </Field>

        <Field
          label={`Voice speed — ${Math.round(voiceSpeed * 100)}%`}
          hint="How fast the agent talks. 100% = default. 110-120% sounds noticeably brisker without getting choppy."
        >
          <input
            type="range"
            name="voice_speed"
            min={0.7}
            max={1.3}
            step={0.05}
            value={voiceSpeed}
            onChange={(e) => setVoiceSpeed(Number(e.currentTarget.value))}
            className="w-full"
          />
          {/* Hidden because the legacy speaking_rate column is still in the
              prompt; we derive its value from the slider. */}
          <input
            type="hidden"
            name="speaking_rate"
            value={voiceSpeed < 0.95 ? 'slow' : voiceSpeed > 1.05 ? 'fast' : 'normal'}
          />
        </Field>

        <Field label="Recording">
          <Checkbox name="recording_enabled" defaultChecked={config.recording_enabled} label="Record calls (recommended)" />
        </Field>
      </FormCard>

      {/* ---- ADVANCED TOGGLE -------------------------------------------- */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvancedPersisted(!showAdvanced)}
          className="text-sm font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
        >
          {showAdvanced ? 'Hide advanced settings ▴' : 'Show advanced settings ▾'}
        </button>
      </div>

      {showAdvanced && (
        <>
          {/* ---- MODEL ---------------------------------------------------- */}
          {/* Model picker is hidden on every plan today — Haiku for everyone.
              Higher tiers (Sonnet, Opus) will reappear here gated behind a
              subscription tier. See BACKLOG: subscription-tier gating. */}
          <FormCard>
            <CardTitle>Model tuning</CardTitle>
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Your AI runs on the Fast model (Haiku) — efficient and cheap to operate.
              Higher-quality models will be available on upgraded plans.
            </p>

            <Field label="Temperature" hint="0 = predictable, 1 = creative. Default 0.7.">
              <input
                type="number"
                name="temperature"
                step="0.05"
                min={0}
                max={1}
                defaultValue={config.temperature}
                className={inputCls + ' w-32'}
              />
            </Field>

            <Field label="Max tokens per turn" hint="Cap on how much the agent can say at once. Default 250.">
              <input
                type="number"
                name="max_tokens"
                step="10"
                min={50}
                max={1000}
                defaultValue={config.max_tokens}
                className={inputCls + ' w-32'}
              />
            </Field>
          </FormCard>

          {/* ---- SYSTEM PROMPT ------------------------------------------ */}
          <FormCard>
            <CardTitle>System prompt</CardTitle>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              The instructions the AI follows on every call. Echon generates
              this for you from your business config (services, hours, tone,
              etc.). You can override it with your own — but if you do, the
              auto-generated content stops being applied automatically.
            </p>

            <Field label="">
              <Checkbox
                name="use_custom_system_prompt"
                defaultChecked={config.use_custom_system_prompt}
                onChange={(e) => setUseCustom(e.currentTarget.checked)}
                label="Use a custom system prompt instead of the auto-generated one"
              />
            </Field>

            {useCustom && !confirmedPromptEdit && config.use_custom_system_prompt === false && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-semibold">Heads up — this is a serious change.</p>
                <p className="mt-1 text-xs">
                  Editing the full system prompt overrides Echon&apos;s defaults and
                  can make the agent behave unpredictably (skip safety rules,
                  forget services, drop business hours). Only do this if you
                  understand prompt engineering. The previous prompt is kept so
                  you can one-step undo.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmedPromptEdit(true)}
                  className="mt-2 rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
                >
                  I understand — let me edit
                </button>
              </div>
            )}

            {useCustom && (
              <>
                <textarea
                  name="custom_system_prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.currentTarget.value)}
                  rows={14}
                  disabled={!confirmedPromptEdit && config.use_custom_system_prompt === false}
                  className={textareaCls + ' font-mono text-xs'}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onRevert}
                    disabled={config.previous_custom_system_prompt == null}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-default disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Revert to previous
                  </button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {config.previous_custom_system_prompt
                      ? 'One-step undo available — reverts to your most recent saved prompt.'
                      : 'No previous version yet.'}
                  </p>
                </div>
              </>
            )}

            {!useCustom && (
              <details className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                <summary className="cursor-pointer">Preview the auto-generated prompt</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                  {config.generated_system_prompt_preview}
                </pre>
              </details>
            )}
          </FormCard>

          {/* ---- BEHAVIOR ------------------------------------------------ */}
          <FormCard>
            <CardTitle>Behavior</CardTitle>

            <Field label="End-call phrases" hint="Comma- or newline-separated. The agent listens for these to hang up.">
              <textarea
                name="end_call_phrases"
                defaultValue={config.end_call_phrases.join(', ')}
                rows={2}
                className={textareaCls}
              />
            </Field>

            <Field label="Max call duration (seconds)" hint="Hard cap. 180–900. Default 480 (8 min).">
              <input
                type="number"
                name="max_call_duration_sec"
                step="30"
                min={180}
                max={900}
                defaultValue={config.max_call_duration_sec}
                className={inputCls + ' w-32'}
              />
            </Field>

            <Field label="Silence timeout (seconds)" hint="How long to wait for the caller to speak. 3–10. Default 5.">
              <input
                type="number"
                name="silence_timeout_sec"
                step="1"
                min={3}
                max={10}
                defaultValue={config.silence_timeout_sec}
                className={inputCls + ' w-32'}
              />
            </Field>

            <Field label="Interruption threshold (seconds)" hint="How long the caller must speak before the agent stops talking. Lower = more eager to yield. Default 0.5.">
              <input
                type="number"
                name="interruption_threshold_sec"
                step="0.1"
                min={0.1}
                max={3.0}
                defaultValue={config.interruption_threshold_sec}
                className={inputCls + ' w-32'}
              />
            </Field>
          </FormCard>
        </>
      )}

      {/* ---- RESULT BANNER -------------------------------------------- */}
      {state && state.ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Saved and synced to Vapi.
        </div>
      )}
      {state && !state.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-semibold">{state.savedToDb ? 'Partial save' : 'Save failed'}</p>
          <p className="mt-0.5 text-xs">{state.reason}</p>
        </div>
      )}

      {/* ---- SAVE ------------------------------------------------------ */}
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

// ---- Local UI primitives ----------------------------------------------

const inputCls =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

const textareaCls = inputCls + ' resize-y'

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  )
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{children}</h3>
}
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</label>}
      {children}
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  )
}
function Checkbox({ name, defaultChecked, label, onChange }: {
  name: string
  defaultChecked: boolean
  label: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input type="hidden" name={name} value="false" />
      <input
        type="checkbox"
        name={name}
        value="true"
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="h-4 w-4"
      />
      {label}
    </label>
  )
}
