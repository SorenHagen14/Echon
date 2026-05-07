'use client'

import { useEffect, useRef, useState } from 'react'
import Vapi from '@vapi-ai/web'
import confetti from 'canvas-confetti'
import { getTestCallConfig } from '../actions'

type Status = 'idle' | 'connecting' | 'live' | 'ending' | 'ended' | 'error'
type TranscriptLine = { role: 'user' | 'assistant'; text: string }

export function TestCallButton() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const vapiRef = useRef<Vapi | null>(null)

  useEffect(() => {
    return () => {
      vapiRef.current?.stop()
      vapiRef.current = null
    }
  }, [])

  async function startCall() {
    setErrorMsg(null)
    setTranscript([])
    setStatus('connecting')

    const config = await getTestCallConfig()
    if (!config.ok) {
      setErrorMsg(config.reason)
      setStatus('error')
      return
    }

    try {
      const vapi = new Vapi(config.publicKey)
      vapiRef.current = vapi

      vapi.on('call-start', () => setStatus('live'))
      vapi.on('call-end', () => {
        setStatus('ended')
        confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
      })
      vapi.on('error', (e: unknown) => {
        console.error('[vapi] error', e)
        setErrorMsg('Call error — please try again.')
        setStatus('error')
      })
      vapi.on('message', (msg: { type?: string; role?: string; transcript?: string; transcriptType?: string }) => {
        if (msg.type === 'transcript' && msg.transcriptType === 'final' && msg.transcript && msg.role) {
          const role = msg.role === 'user' ? 'user' : 'assistant'
          setTranscript((prev) => [...prev, { role, text: msg.transcript! }])
        }
      })

      await vapi.start(config.assistantId, {
        metadata: { test: true },
      } as Parameters<Vapi['start']>[1])
    } catch (e) {
      console.error('[vapi] start failed', e)
      setErrorMsg('Could not start call. Check your microphone permission.')
      setStatus('error')
    }
  }

  function endCall() {
    setStatus('ending')
    vapiRef.current?.stop()
  }

  function reset() {
    setStatus('idle')
    setTranscript([])
    setErrorMsg(null)
  }

  return (
    <div>
      {status === 'idle' && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={startCall}
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Start test call
          </button>
          <p className="mt-3 text-xs text-zinc-500">
            We&apos;ll need your microphone for the test.
          </p>
        </div>
      )}

      {(status === 'connecting' || status === 'live' || status === 'ending') && (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  status === 'live' ? 'animate-pulse bg-emerald-500' : 'bg-zinc-400'
                }`}
              />
              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                {status === 'connecting' && 'Connecting…'}
                {status === 'live' && 'Live — talk to your agent'}
                {status === 'ending' && 'Ending call…'}
              </span>
            </div>
            <button
              type="button"
              onClick={endCall}
              disabled={status !== 'live'}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              End call
            </button>
          </div>

          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md bg-zinc-50 p-3 text-xs dark:bg-zinc-950/40">
            {transcript.length === 0 ? (
              <p className="text-zinc-500">Transcript will appear here as you talk…</p>
            ) : (
              transcript.map((line, i) => (
                <div key={i}>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {line.role === 'user' ? 'You' : 'Agent'}:
                  </span>{' '}
                  <span className="text-zinc-600 dark:text-zinc-400">{line.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {status === 'ended' && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Your agent is built and ready for calls.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs text-emerald-800 underline hover:no-underline dark:text-emerald-300"
          >
            Try again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
          <p className="text-sm text-red-700 dark:text-red-400">{errorMsg ?? 'Something went wrong.'}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs text-red-800 underline hover:no-underline dark:text-red-300"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
