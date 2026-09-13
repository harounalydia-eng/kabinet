// KABINET — /api/analyze-skin (Vercel serverless function, Node runtime)
//
// The ONE piece of the AI skin check that runs outside Supabase: the vision-model call. The Supabase Edge Function
// `skin-scan` owns the rest (loading the user's private photographs, validation, database writes) and calls this
// endpoint server-to-server, forwarding the user's JWT.
//
// POST { images: [{ view: 'front'|'left'|'right', mime, data(base64) }], previous?: { observations, created_at }, focus?: string[] }
//   → 200 { ok: true, analysis, model, usage }
//   → 400 bad input · 401 not signed in · 413 too large · 429 too many checks · 503 GEMINI_API_KEY not configured · 502 model failed
// POST { ping: true } → 200 { ok: true, ping: true, model, key_present }
//
// Photographs are never logged and never stored here. GEMINI_API_KEY is read from process.env only.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { toGeminiSchema } from './_lib/extraction.js'
import { geminiVisionJson, SCHEMA, SYSTEM } from './_lib/skin.js'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } } }

const MODEL = process.env.KABINET_SKIN_MODEL ?? process.env.KABINET_EXTRACTION_MODEL ?? 'gemini-3.6-flash'
const RATE_LIMIT = 12
const RATE_WINDOW_MS = 60 * 60_000
const MAX_IMAGE_B64 = 3_000_000 // ~2.2 MB per image; the app uploads ≤1600px JPEGs (~300 KB)
const VIEWS = new Set(['front', 'left', 'right'])
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

type Image = { view: string; mime: string; data: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only.' })
  const env = (name: string) => (process.env[name] ?? '').trim() || undefined
  const supabaseUrl = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL') ?? 'https://mdtdcppzrhwmowynzqdp.supabase.co'
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY') ?? env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_GxImfbCCMBMXKYHpsvJExA_KxSyj9Gd'
  const geminiKey = env('GEMINI_API_KEY')

  const userId = await verifyUser(req.headers.authorization, supabaseUrl, publishableKey)
  if (!userId) return res.status(401).json({ ok: false, error: 'Sign in to KABINET to run a skin check.' })

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as { ping?: boolean; images?: Image[]; previous?: { observations?: unknown; created_at?: string } | null; focus?: string[] }
  if (body.ping === true) return res.status(200).json({ ok: true, ping: true, model: MODEL, key_present: Boolean(geminiKey) })
  if (!geminiKey) return res.status(503).json({ ok: false, error: 'The skin check is not configured on the server (GEMINI_API_KEY missing).' })

  const images = Array.isArray(body.images) ? body.images : []
  if (images.length < 1 || images.length > 3) return res.status(400).json({ ok: false, error: 'Send one to three photographs (front, left, right).' })
  for (const im of images) {
    if (!VIEWS.has(im.view) || !MIMES.has(im.mime) || typeof im.data !== 'string' || !im.data) return res.status(400).json({ ok: false, error: 'Each image needs a view (front/left/right), a mime type and base64 data.' })
    if (im.data.length > MAX_IMAGE_B64) return res.status(413).json({ ok: false, error: 'A photograph is too large. The app should send images of at most 1600px.' })
  }
  if (!allow(userId)) return res.status(429).json({ ok: false, error: 'That is a lot of skin checks for one hour. Try again a little later.' })

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
  for (const im of images) {
    parts.push({ text: `${im.view.toUpperCase()} view:` })
    parts.push({ inlineData: { mimeType: im.mime, data: im.data } })
  }
  const focus = Array.isArray(body.focus) ? body.focus.filter((f) => typeof f === 'string').slice(0, 6) : []
  const previous = body.previous && typeof body.previous === 'object' && body.previous.observations ? body.previous : null
  parts.push({ text: [
    `Describe what is visible in these photographs today.`,
    focus.length ? `The person has said they want to work on: ${focus.join(', ')}. Look at those areas with care, but report only what is visible.` : '',
    previous ? `PREVIOUS CHECK (${previous.created_at ?? 'earlier'}), the only reference to compare with: ${JSON.stringify(previous.observations)}. Fill "comparison" per observation type; use "not_comparable" when light or framing differ too much.` : 'There is no previous check: set comparison to null.',
  ].filter(Boolean).join('\n') })

  try {
    const { data, usage } = await geminiVisionJson(geminiKey, MODEL, SYSTEM, parts, SCHEMA as unknown as Record<string, unknown>, toGeminiSchema)
    return res.status(200).json({ ok: true, analysis: data, model: MODEL, usage })
  } catch (err) {
    const status = (err as { status?: number }).status ?? 502
    const message = err instanceof Error ? err.message : String(err)
    console.error('[analyze-skin] model failed', status, message) // message only — never the images
    return res.status(status >= 400 && status < 600 ? (status === 429 ? 503 : 502) : 502).json({ ok: false, error: `KABINET couldn't read these photographs right now. ${status === 429 ? 'The model is busy.' : ''}`.trim(), detail: message.slice(0, 200) })
  }
}
