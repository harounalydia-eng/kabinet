// KABINET — /api/extract-routine (Vercel serverless function, Node runtime)
//
// The ONE piece of the routine-import pipeline that runs outside Supabase: the Gemini call. Everything else
// (reading the post, dedup, status, verbatim-evidence validation, product resolution, database writes) stays in the
// Supabase Edge Function `import-routine`, which calls this endpoint server-to-server and forwards the user's JWT.
//
// POST { platform, creator, evidence: string[] }  with  Authorization: Bearer <the user's Supabase session JWT>
//   → 200 { ok: true, extraction, model, usage }
//   → 401 not signed in · 429 too many imports · 503 GEMINI_API_KEY not configured · 502 Gemini failed
// POST { ping: true }  → 200 { ok: true, ping: true, model, key_present }   (reachability check, no Gemini call)
//
// Secrets: GEMINI_API_KEY is read from process.env only. It is never logged, never returned, never sent to a browser.
// SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are public values, kept as env vars so nothing is hard-coded. This function
// has no database access and no service-role key.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GeminiError, geminiJson, SCHEMA, SYSTEM, type ExtractionRequest } from './_lib/extraction.js'

const MODEL = process.env.KABINET_EXTRACTION_MODEL ?? 'gemini-3.6-flash'
const RATE_LIMIT = 20            // imports per user…
const RATE_WINDOW_MS = 60 * 60_000 // …per hour (per warm instance — a floor against abuse, not a billing control)
const MAX_EVIDENCE_CHARS = 24_000

const buckets = new Map<string, number[]>()
function allow(userId: string): boolean {
  const now = Date.now()
  const hits = (buckets.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) return false
  hits.push(now)
  buckets.set(userId, hits)
  return true
}

/** Who is calling: the JWT is checked against the project's own Auth server. No secret needed — the publishable key is public. */
async function verifyUser(authHeader: string | undefined, supabaseUrl: string, publishableKey: string): Promise<string | null> {
  const token = (authHeader ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token || token.split('.').length !== 3) return null
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: string }
    return typeof user.id === 'string' ? user.id : null
  } catch {
    return null
  }
}

const PLATFORMS = new Set(['tiktok', 'instagram', 'youtube'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only.' })

  // Public values only: the project URL and publishable key. The VITE_ names are the ones the frontend build already
  // has on this Vercel project, so they double as a fallback. GEMINI_API_KEY has no such fallback — server-side only.
  // A variable that exists but is blank counts as missing (this project has had empty values before).
  const env = (name: string) => (process.env[name] ?? '').trim() || undefined
  // Both are PUBLIC values (the same URL and publishable key ship in every browser bundle of the app), so a
  // hard-coded default is safe; env vars still win when set. There is deliberately no default for GEMINI_API_KEY.
  const supabaseUrl = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL') ?? 'https://mdtdcppzrhwmowynzqdp.supabase.co'
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY') ?? env('VITE_SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_GxImfbCCMBMXKYHpsvJExA_KxSyj9Gd'
  const geminiKey = env('GEMINI_API_KEY')
  if (!supabaseUrl || !publishableKey) {
    // Names only, never values: which relevant variables this deployment actually received, and which are blank.
    const seen = Object.keys(process.env).filter((n) => /SUPABASE|GEMINI|KABINET/i.test(n)).sort().map((n) => (process.env[n] ?? '').trim() ? n : `${n} (blank)`)
    return res.status(503).json({ ok: false, error: 'The extractor is not configured (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY missing or blank).', env_seen: seen })
  }

  const userId = await verifyUser(req.headers.authorization, supabaseUrl, publishableKey)
  if (!userId) return res.status(401).json({ ok: false, error: 'Sign in to KABINET to import a routine.' })

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Partial<ExtractionRequest> & { ping?: boolean }
  if (body.ping === true) {
    // Reachability + configuration. With a key present, also list the Flash models this key can call (names only).
    let flashModels: string[] | null = null
    let modelListed: boolean | null = null
    if (geminiKey) {
      try {
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': geminiKey }, signal: AbortSignal.timeout(8000) })
        const j = (await r.json().catch(() => ({}))) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> }
        if (r.ok) {
          const names = (j.models ?? []).filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
          flashModels = names.filter((n) => /flash/.test(n))
          modelListed = names.includes(MODEL)
        }
      } catch { /* listing is informational */ }
    }
    return res.status(200).json({ ok: true, ping: true, model: MODEL, key_present: !!geminiKey, model_listed: modelListed, flash_models: flashModels })
  }
  if (!geminiKey) return res.status(503).json({ ok: false, error: "KABINET's extraction is not configured yet (GEMINI_API_KEY missing on the server)." })

  const platform = typeof body.platform === 'string' && PLATFORMS.has(body.platform) ? body.platform : null
  const evidence = Array.isArray(body.evidence) ? body.evidence.filter((e): e is string => typeof e === 'string' && e.trim().length > 0) : []
  if (!platform || !evidence.length) return res.status(400).json({ ok: false, error: 'platform and evidence are required.' })
  const creator = typeof body.creator === 'string' && body.creator.trim() ? body.creator.trim().slice(0, 80) : 'unknown'
  if (!allow(userId)) return res.status(429).json({ ok: false, error: 'Too many imports in the last hour. Try again a little later.' })

  const user = `Platform: ${platform}\nCreator: ${creator}\n\nEVIDENCE\n\n${evidence.join('\n\n').slice(0, MAX_EVIDENCE_CHARS)}`
  try {
    const { data, usage } = await geminiJson(geminiKey, MODEL, SYSTEM, user, SCHEMA)
    return res.status(200).json({ ok: true, extraction: data, model: MODEL, usage })
  } catch (err) {
    const status = err instanceof GeminiError ? (err.status >= 500 || err.status === 429 ? 502 : err.status) : 502
    console.error('[extract-routine]', status, (err as Error).message) // message only — never the key, never the token
    return res.status(status).json({ ok: false, error: `Gemini could not build the routine: ${(err as Error).message}` })
  }
}
