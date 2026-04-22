import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
const APP_SECRET = process.env.META_APP_SECRET

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  const signatureHeader = request.headers.get('x-hub-signature-256')
  if (!signatureHeader || !APP_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rawBody = await request.text()
  const expected =
    'sha256=' + createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')

  const sigBuf = Buffer.from(signatureHeader)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  console.log('[meta-webhook] received', JSON.stringify(payload))

  // TODO: enqueue payload to Inngest for AI Engine processing (WF-01).
  return NextResponse.json({ received: true })
}
