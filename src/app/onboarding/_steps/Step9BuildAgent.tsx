'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { saveAgentBuilderSubStep, saveAndAdvance } from '../actions'
import { SubmitButton } from '../_components/SubmitButton'
import { TestCallButton } from '../_components/TestCallButton'
import { StepShell } from './StepShell'
import {
  AGENT_BUILDER_TOTAL_SUBSTEPS,
  CALLER_OPTIONS,
  TASK_OPTIONS,
  TONE_OPTIONS,
  TEST_MODE,
} from '../_constants'

type Tone = (typeof TONE_OPTIONS)[number]['key'] | 'other'
type SubStep = 1 | 2 | 3 | 4

type Defaults = {
  tasks?: string[]
  tasks_other?: string
  typical_callers?: string[]
  typical_callers_other?: string
  tone?: Tone
  tone_other?: string
  business_name?: string
  builder_substep?: number
}

type Props = { defaults: Defaults }

const SECTION_CARD =
  'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-white'

// ---------------------------------------------------------------------------
// Step9BuildAgent — sub-flow with side panel and review.
// 4 sub-steps: Tasks → Callers → Tone → Test/Review.
// Tasks and callers are single-select radios (DB stores a one-element jsonb
// array so the column shape can stay flexible). Voice + agent name are not
// asked here — agent_name defaults to "John" via the DB; voice is set in
// Phase 4 when Vapi provisions the assistant.
// ---------------------------------------------------------------------------

export function Step9BuildAgent({ defaults }: Props) {
  const initialSub = clampSub(defaults.builder_substep ?? 1)
  const [sub, setSub] = useState<SubStep>(initialSub)

  // No defaults — the user explicitly picks each answer. The "Recommended"
  // badge is a hint, not a pre-selection.
  const [task, setTask] = useState<string>(defaults.tasks?.[0] ?? '')
  const [tasksOther, setTasksOther] = useState(defaults.tasks_other ?? '')
  const [caller, setCaller] = useState<string>(defaults.typical_callers?.[0] ?? '')
  const [callersOther, setCallersOther] = useState(defaults.typical_callers_other ?? '')
  const [tone, setTone] = useState<Tone | ''>(defaults.tone ?? '')
  const [toneOther, setToneOther] = useState(defaults.tone_other ?? '')

  const [subState, subAction] = useActionState(saveAgentBuilderSubStep, null)
  const lastConsumedRef = useRef<typeof subState>(null)
  useEffect(() => {
    if (!subState || subState === lastConsumedRef.current) return
    lastConsumedRef.current = subState
    if (subState.ok) setSub(clampSub(subState.nextSub))
  }, [subState])

  const [finalState, finalAction] = useActionState(saveAndAdvance, null)

  return (
    <StepShell state={finalState}>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* LEFT — active sub-step */}
        <div>
          {sub === 1 && (
            <SubStepCard
              title="What should your AI receptionist do?"
              hint="Pick one — the agent's main job."
              action={subAction}
              subStep={1}
              error={subState && !subState.ok ? subState.errors._?.[0] : null}
            >
              <div className="grid gap-2">
                {TASK_OPTIONS.map((opt) => {
                  const checked = task === opt.key
                  return (
                    <label
                      key={opt.key}
                      className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                        checked
                          ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="task"
                          value={opt.key}
                          checked={checked}
                          onChange={() => setTask(opt.key)}
                          className="mt-1 h-4 w-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">
                            {opt.label}
                            {'recommended' in opt && opt.recommended && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  Something else (optional)
                </label>
                <input
                  type="text"
                  name="tasks_other"
                  value={tasksOther}
                  onChange={(e) => setTasksOther(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Take rental inquiries"
                  className={inputCls}
                />
              </div>
            </SubStepCard>
          )}

          {sub === 2 && (
            <SubStepCard
              title="Who typically calls your business?"
              hint="Pick the closest match."
              action={subAction}
              subStep={2}
              error={subState && !subState.ok ? subState.errors._?.[0] : null}
            >
              <div className="grid gap-2">
                {CALLER_OPTIONS.map((opt) => {
                  const checked = caller === opt.key
                  return (
                    <label
                      key={opt.key}
                      className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                        checked
                          ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="typical_caller"
                        value={opt.key}
                        checked={checked}
                        onChange={() => setCaller(opt.key)}
                        className="mr-3 h-4 w-4"
                      />
                      <span className="text-sm text-zinc-900 dark:text-white">{opt.label}</span>
                    </label>
                  )
                })}
              </div>
              <div className="mt-3">
                <label className="mb-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  Other (optional)
                </label>
                <input
                  type="text"
                  name="typical_callers_other"
                  value={callersOther}
                  onChange={(e) => setCallersOther(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Real estate agents"
                  className={inputCls}
                />
              </div>
            </SubStepCard>
          )}

          {sub === 3 && (
            <SubStepCard
              title="How should your agent sound?"
              hint="Pick one."
              action={subAction}
              subStep={3}
              error={subState && !subState.ok ? subState.errors._?.[0] : null}
            >
              <div className="grid gap-2">
                {TONE_OPTIONS.map((opt) => {
                  const checked = tone === opt.key
                  return (
                    <label
                      key={opt.key}
                      className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                        checked
                          ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                          : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="tone"
                          value={opt.key}
                          checked={checked}
                          onChange={() => setTone(opt.key)}
                          className="mt-1 h-4 w-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">{opt.label}</div>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{opt.description}</p>
                        </div>
                      </div>
                    </label>
                  )
                })}
                <label
                  className={`cursor-pointer rounded-lg border px-4 py-3 transition-colors ${
                    tone === 'other'
                      ? 'border-zinc-900 bg-zinc-50 dark:border-white dark:bg-zinc-800'
                      : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="tone"
                    value="other"
                    checked={tone === 'other'}
                    onChange={() => setTone('other')}
                    className="mr-3 h-4 w-4"
                  />
                  <span className="text-sm text-zinc-900 dark:text-white">Something else</span>
                </label>
              </div>
              {tone === 'other' && (
                <div className="mt-3">
                  <input
                    type="text"
                    name="tone_other"
                    value={toneOther}
                    onChange={(e) => setToneOther(e.target.value)}
                    maxLength={100}
                    placeholder="Describe the tone"
                    className={inputCls}
                  />
                </div>
              )}
            </SubStepCard>
          )}

          {sub === 4 && (
            <div className={SECTION_CARD}>
              <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">
                Test your agent
              </h2>
              <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                Talk to your agent right here in the browser — your real
                business name, services, and tone are all wired in.
              </p>

              <div className="mb-6">
                <TestCallButton />
              </div>

              <ReviewBlock
                task={task}
                tasksOther={tasksOther}
                caller={caller}
                callersOther={callersOther}
                tone={tone}
                toneOther={toneOther}
                businessName={defaults.business_name ?? ''}
              />

              {finalState && !finalState.ok && finalState.errors._ && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                  {finalState.errors._[0]}
                </p>
              )}

              <form action={finalAction}>
                <input type="hidden" name="step" value={9} />
                <SubmitButton>Looks good — finish setup</SubmitButton>
              </form>

              <form action={subAction} className="mt-2">
                <input type="hidden" name="subStep" value={4} />
                <button
                  type="submit"
                  className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  Save and continue later
                </button>
              </form>
            </div>
          )}

          {sub > 1 && sub <= 4 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setSub((s) => clampSub(s - 1))}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                ← Back to sub-step {sub - 1}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT — Agent so far panel */}
        <SidePanel
          sub={sub}
          task={task}
          tasksOther={tasksOther}
          caller={caller}
          callersOther={callersOther}
          tone={tone}
          toneOther={toneOther}
        />
      </div>
    </StepShell>
  )
}

// ---------------------------------------------------------------------------
// SubStepCard — wraps a single sub-step's form. Hidden subStep input tells
// the server action which sub-step is firing.
// ---------------------------------------------------------------------------

function SubStepCard(props: {
  title: string
  hint?: string
  subStep: SubStep
  action: (formData: FormData) => void
  error: string | null | undefined
  children: React.ReactNode
}) {
  return (
    <div className={SECTION_CARD}>
      <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-white">{props.title}</h2>
      {props.hint && (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">{props.hint}</p>
      )}

      {props.error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {props.error}
        </p>
      )}

      <form action={props.action}>
        <input type="hidden" name="subStep" value={props.subStep} />
        {props.children}
        <div className="mt-6">
          <SubmitButton>Continue</SubmitButton>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SidePanel — accumulating answers with check marks. The user explicitly
// asked to keep this. Voice + Agent name rows are gone; only the three
// answered fields show up.
// ---------------------------------------------------------------------------

function SidePanel(props: {
  sub: SubStep
  task: string
  tasksOther: string
  caller: string
  callersOther: string
  tone: Tone | ''
  toneOther: string
}) {
  const taskLabel =
    TASK_OPTIONS.find((t) => t.key === props.task)?.label ??
    (props.task ? props.task : '—')
  const taskExtra = props.tasksOther ? ` + ${props.tasksOther}` : ''

  const callerLabel =
    CALLER_OPTIONS.find((c) => c.key === props.caller)?.label ??
    (props.caller ? props.caller : '—')
  const callerExtra = props.callersOther ? ` + ${props.callersOther}` : ''

  const toneLabel =
    !props.tone
      ? '—'
      : props.tone === 'other'
        ? props.toneOther || 'Other'
        : TONE_OPTIONS.find((t) => t.key === props.tone)?.label ?? props.tone

  return (
    <aside className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <span>Summary</span>
        <span>{props.sub} of {AGENT_BUILDER_TOTAL_SUBSTEPS}</span>
      </div>

      <ul className="space-y-3 text-sm">
        <PanelRow label="Task" filled={props.sub > 1}>
          {taskLabel}{taskExtra}
        </PanelRow>
        <PanelRow label="Callers" filled={props.sub > 2}>
          {callerLabel}{callerExtra}
        </PanelRow>
        <PanelRow label="Tone" filled={props.sub > 3}>
          {toneLabel}
        </PanelRow>
      </ul>
    </aside>
  )
}

function PanelRow({
  label,
  filled,
  children,
}: { label: string; filled: boolean; children: React.ReactNode }) {
  return (
    <li>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {filled ? (
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 text-[10px] leading-3 text-white">
            ✓
          </span>
        ) : (
          <span className="inline-block h-3 w-3 rounded-full border border-zinc-300 dark:border-zinc-700" />
        )}
        {label}
      </div>
      <div className="ml-4 text-zinc-900 dark:text-zinc-100">{children}</div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// ReviewBlock — final-screen summary. No "Your agent" header (per request);
// the section is just a tidy facts list with a generated greeting preview.
// ---------------------------------------------------------------------------

function ReviewBlock(props: {
  task: string
  tasksOther: string
  caller: string
  callersOther: string
  tone: Tone | ''
  toneOther: string
  businessName: string
}) {
  const taskLabel =
    TASK_OPTIONS.find((t) => t.key === props.task)?.label ??
    (props.task ? props.task : '—')
  const taskExtra = props.tasksOther ? ` + ${props.tasksOther}` : ''

  const callerLabel =
    CALLER_OPTIONS.find((c) => c.key === props.caller)?.label ??
    (props.caller ? props.caller : '—')
  const callerExtra = props.callersOther ? ` + ${props.callersOther}` : ''

  const toneLabel =
    !props.tone
      ? '—'
      : props.tone === 'other'
        ? props.toneOther || 'Other'
        : TONE_OPTIONS.find((t) => t.key === props.tone)?.label ?? props.tone

  const greeting = `Thanks for calling ${props.businessName || 'your business'}, this is John. How can I help?`

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <dl className="grid gap-2 text-sm sm:grid-cols-[120px_1fr]">
        <dt className="text-zinc-500">Task</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">{taskLabel}{taskExtra}</dd>

        <dt className="text-zinc-500">Callers</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">{callerLabel}{callerExtra}</dd>

        <dt className="text-zinc-500">Tone</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">{toneLabel}</dd>

        <dt className="text-zinc-500">Greeting</dt>
        <dd className="italic text-zinc-700 dark:text-zinc-300">“{greeting}”</dd>
      </dl>
      {TEST_MODE && (
        <p className="mt-3 text-xs text-zinc-500">
          Test mode is on — you can finish setup with any combination of answers.
        </p>
      )}
    </div>
  )
}

function clampSub(n: number): SubStep {
  if (n <= 1) return 1
  if (n >= 4) return 4
  return n as SubStep
}
