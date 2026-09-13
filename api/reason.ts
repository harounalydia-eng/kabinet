// KABINET — /api/reason (Vercel serverless function, Node runtime)
//
// The single server-side model call behind CHECK, ASK, the daily photo read and the onboarding plan. The Supabase
// Edge Functions own prompts, user context, validation and database writes; this route only runs the model.
//
// POST { system, parts: [{ text } | { inlineData: { mimeType, data } }], schema, maxOutputTokens?, temperature? }
//   with Authorization: Bearer <the user's Supabase session JWT>
//   → 200 { ok: true, data, model, usage }
//   → 400 bad input · 401 not signed in · 413 too large · 429 too many calls · 503 GEMINI_API_KEY missing · 502 model failed
// POST { ping: true } → 200 { ok: true, ping: true, model, key_present }
//
// Images are never logged or stored here. GEMINI_API_KEY is read from process.env only.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { geminiJson, GeminiFailure, type Part } from './_lib/gemini.js'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

const MODEL = process.env.KABINET_REASON_MODEL ?? process.env.KABINET_EXTRACTION_MODEL ?? 'gemini-3.6-flash'
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60 * 60_000
const MAX_TEXT = 120_000
const MAX_IMAGE_B64 = 3_000_000
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const buckets = new Map<string, number[]>()
function allow(userId: string): boolean {
  const now = Date.now()
  const hits = (buckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) return false
  hits.push(now); buckets.set(userId, hits)
  return true
}
async function verifyUser(authHeader: string | undefined, supabaseUrl: string, publishableKey: string): Promise<string | null> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token.split('.').length !== 3) return null
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: string }
    return typeof user.id === 'string' ? user.id : null
  } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only.' })
  const env = (name: string) => (process.env[name] ?? '').trim() || undefined
  const supabaseUrl = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL') ?? 'https://mdtdcppzrhwmowynzqdp.supabase.co'
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY') ?? env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_GxImfbCCMBMXKYHpsvJExA_KxSyj9Gd'
  const geminiKey = env('GEMINI_API_KEY')

  const userId = await verifyUser(req.headers.authorization, supabaseUrl, publishableKey)
  if (!userId) return res.status(401).json({ ok: false, error: 'Sign in to continue.' })

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as { ping?: boolean; system?: string; parts?: Part[]; schema?: Record<string, unknown>; maxOutputTokens?: number; temperature?: number }
  if (body.ping === true) return res.status(200).json({ ok: true, ping: true, model: MODEL, key_present: Boolean(geminiKey) })
  if (!geminiKey) return res.status(503).json({ ok: false, error: "KABINET's intelligence is not configured on the server (GEMINI_API_KEY missing)." })

  const parts = Array.isArray(body.parts) ? body.parts : []
  if (typeof body.system !== 'string' || !parts.length || !body.schema || typeof body.schema !== 'object') return res.status(400).json({ ok: false, error: 'system, parts and schema are required.' })
  let textChars = 0, images = 0
  for (const p of parts) {
    if ('text' in p && typeof p.text === 'string') textChars += p.text.length
    else if ('inlineData' in p && p.inlineData && MIMES.has(p.inlineData.mimeType) && typeof p.inlineData.data === 'string') {
      images++
      if (p.inlineData.data.length > MAX_IMAGE_B64) return res.status(413).json({ ok: false, error: 'An image is too large.' })
    } else return res.status(400).json({ ok: false, error: 'Unsupported part.' })
  }
  if (textChars > MAX_TEXT || images > 4) return res.status(413).json({ ok: false, error: 'The request is too large.' })
  if (!allow(userId)) return res.status(429).json({ ok: false, error: 'KABINET is thinking a lot for one hour. Try again a little later.' })

  try {
    const { data, usage } = await geminiJson(geminiKey, MODEL, body.system, parts, body.schema, { maxOutputTokens: Math.min(8000, Number(body.maxOutputTokens) || 6000), temperature: typeof body.temperature === 'number' ? body.temperature : 0.2 })
    return res.status(200).json({ ok: true, data, model: MODEL, usage })
  } catch (err) {
    const status = err instanceof GeminiFailure ? err.status : 502
    const message = err instanceof Error ? err.message : String(err)
    console.error('[reason] model failed', status, message)
    return res.status(status === 429 ? 503 : 502).json({ ok: false, error: status === 429 ? 'The model is busy right now. Try again in a moment.' : "KABINET couldn't finish thinking. Try again.", detail: message.slice(0, 200) })
  }
}
