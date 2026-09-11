// KABINET — lookup-product
//
// POST /functions/v1/lookup-product
//   { barcode }                       → one product
//   { query }                         → up to `limit` products (default 5, max 10)
//   { brand, name }                   → up to `limit` products
//   optional: refresh: true           → skip KABINET's cache and ask the provider again
//
// CACHE FIRST. catalog_products is checked before any external call; a hit returns `cached: true` and never
// touches the provider. A miss asks Open Beauty Facts, normalises the answer (obf.ts), stores it and returns the
// stored row — so KABINET's own catalog grows with use and a repeated lookup returns the same row, never a copy.
//
// Identity: the user's session JWT (both apps when signed in) OR the project's publishable key in `apikey`
// (what supabase-js sends when signed out). Deployed with gateway JWT verification off because publishable keys
// are not JWTs; both forms are verified here. Writes use the service role; nothing personal is stored.
//
// Provider errors never poison the catalog: on a timeout / 5xx the function answers 502 with a human message.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { fetchByBarcode, normalizeBarcode, searchProducts, tokens, UpstreamError, type NormalizedProduct } from './obf.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => json({ ok: false, error: message, message, ...extra }, status)

/** What clients receive. `raw` stays in the database. */
const SELECT = 'id, brand, name, category, category_tags, barcode, quantity, image_url, ingredients, ingredients_text, source, source_id, source_url, fetched_at, created_at, updated_at'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const USER_AGENT = Deno.env.get('OBF_USER_AGENT') ?? undefined
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// ── Identity ───────────────────────────────────────────────────────────────────

const keyChecks = new Map<string, { ok: boolean; at: number }>()
const KEY_TTL_MS = 10 * 60_000

/** A publishable/anon key is valid iff the project's Auth settings endpoint accepts it. Cached 10 minutes. */
async function keyIsValid(key: string): Promise<boolean> {
  const hit = keyChecks.get(key)
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.ok
  let ok = false
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: key } })
    ok = res.ok
  } catch { ok = false }
  keyChecks.set(key, { ok, at: Date.now() })
  return ok
}

async function identify(req: Request): Promise<{ userId: string | null } | Response> {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (bearer && bearer.split('.').length === 3) {
    const { data, error } = await db.auth.getUser(bearer)
    if (!error && data.user) return { userId: data.user.id }
    // A JWT that is not a user session (e.g. the legacy anon key) falls through to the key check.
  }
  const key = req.headers.get('apikey') ?? bearer
  if (key && (await keyIsValid(key))) return { userId: null }
  return fail(401, 'Sign in to KABINET to look products up.')
}

// ── Storage ────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string; barcode: string | null; source: string; source_id: string | null }

const cachedMessage = (n: number) => (n === 1 ? 'Found in KABINET.' : `Found ${n} in KABINET.`)

async function findByBarcode(barcode: string): Promise<Row | null> {
  const { data, error } = await db.from('catalog_products').select(SELECT).eq('barcode', barcode).maybeSingle()
  if (error) throw new Error(error.message)
  return data as Row | null
}

async function findByText(words: string[], limit: number): Promise<Row[]> {
  let q = db.from('catalog_products').select(SELECT)
  for (const w of words) q = q.ilike('search_text', `%${w}%`)
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as Row[]
}

/**
 * Stores one normalised provider record and returns the KABINET row. Idempotent on (source, source_id).
 * If another provider already owns this barcode, that row wins — the catalog never holds two records for one
 * GTIN, and a later phase can merge providers deliberately.
 */
async function saveProduct(n: NormalizedProduct): Promise<Row> {
  if (n.barcode) {
    const existing = await findByBarcode(n.barcode)
    if (existing && (existing.source !== n.source || existing.source_id !== n.source_id)) {
      console.log('[lookup-product] barcode already catalogued from another source', { barcode: n.barcode, kept: existing.source })
      return existing
    }
  }
  const { data, error } = await db.from('catalog_products').upsert(n, { onConflict: 'source,source_id' }).select(SELECT).single()
  if (error) throw new Error(error.message)
  return data as Row
}

// ── Handler ────────────────────────────────────────────────────────────────────

type Body = { barcode?: string | number; query?: string; brand?: string; name?: string; refresh?: boolean; limit?: number }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'POST only.')

  const who = await identify(req)
  if (who instanceof Response) return who

  const body = ((await req.json().catch(() => null)) ?? {}) as Body
  const refresh = body.refresh === true
  const limit = Math.min(10, Math.max(1, Number(body.limit) || 5))
  const opts = { userAgent: USER_AGENT }

  try {
    // ── Barcode ────────────────────────────────────────────────────────────────
    if (body.barcode !== undefined && body.barcode !== null && String(body.barcode).trim() !== '') {
      const barcode = normalizeBarcode(body.barcode)
      if (!barcode) return fail(400, 'That does not look like a barcode (8, 12, 13 or 14 digits).')

      const cached = await findByBarcode(barcode)
      if (cached && !refresh) return json({ ok: true, cached: true, source: 'kabinet', product: cached, products: [cached], message: cachedMessage(1) })

      let found: NormalizedProduct | null
      try {
        found = await fetchByBarcode(barcode, opts)
      } catch (err) {
        if (cached) return json({ ok: true, cached: true, source: 'kabinet', product: cached, products: [cached], message: 'Provider unavailable — showing what KABINET already has.', warning: String((err as Error).message) })
        throw err
      }
      if (!found) return json({ ok: false, found: false, cached: false, source: 'open_beauty_facts', product: null, products: [], message: 'No product with this barcode in Open Beauty Facts yet.' }, 404)

      const row = await saveProduct(found)
      return json({ ok: true, cached: false, source: found.source, product: row, products: [row], message: `Found via ${found.source === 'open_food_facts' ? 'Open Food Facts' : 'Open Beauty Facts'} and saved to KABINET.` })
    }

    // ── Text search ────────────────────────────────────────────────────────────
    const query = str(body.query)
    const brand = str(body.brand)
    const name = str(body.name)
    const text = query ?? [brand, name].filter(Boolean).join(' ')
    const words = tokens(text)
    if (!words.length) return fail(400, 'Send a barcode, a query, or a brand + name.')

    if (!refresh) {
      const hits = await findByText(words, limit)
      if (hits.length) return json({ ok: true, cached: true, source: 'kabinet', product: hits[0], products: hits, message: cachedMessage(hits.length) })
    }

    const found = await searchProducts({ query, brand, name }, limit, opts)
    if (!found.length) return json({ ok: false, found: false, cached: false, source: 'open_beauty_facts', product: null, products: [], message: `Nothing matching "${text}" in Open Beauty Facts yet.` }, 404)

    const rows: Row[] = []
    for (const n of found) rows.push(await saveProduct(n))
    const sources = [...new Set(found.map((f) => f.source))]
    return json({ ok: true, cached: false, source: sources.length === 1 ? sources[0] : 'mixed', product: rows[0], products: rows, message: `Found ${rows.length} via Open Beauty Facts and saved to KABINET.` })
  } catch (err) {
    if (err instanceof UpstreamError) {
      console.error('[lookup-product] upstream', err.message)
      return fail(502, `${err.message} KABINET's own catalog still works — try again in a moment.`, { upstream: true })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[lookup-product]', message)
    return fail(500, message)
  }
})
