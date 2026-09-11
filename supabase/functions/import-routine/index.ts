// KABINET — import-routine
//
// Beauty content → structured routine. The beauty equivalent of a recipe importer:
//   URL → platform → public metadata (title · caption · description · creator · thumbnail) → transcript when one
//   exists → ONE Gemini call that turns the evidence into {products, steps} without inventing anything →
//   every product resolved against catalog_products (cache first, then lookup-product) → rows in
//   content_imports / routines / routine_products / routine_steps.
//
// POST /import-routine            { url, transcript? }                     → runs the pipeline (or returns the cached routine)
// POST /import-routine/rerun      { import_id, transcript? }               → extracts again with new evidence (e.g. a pasted transcript)
// POST /import-routine/confirm    { routine_product_id, catalog_product_id | null } → the person picks the right product
// POST /import-routine/diagnose   {}                                       → is GEMINI_API_KEY readable, does the model answer (never returns the key)
//
// Identity: the user's session JWT. Writes use the service role. Status is written to content_imports as the
// pipeline moves (reading → listening → extracting → matching → ready | failed) so the app can show honest copy.
// Third-party video is never downloaded or re-hosted: source URL, thumbnail URL, metadata, extraction only.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { detectPlatform, type DetectedLink } from './platform.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => json({ ok: false, error: message, message, ...extra }, status)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const YOUTUBE_KEY = Deno.env.get('YOUTUBE_API_KEY')
const MODEL = Deno.env.get('KABINET_EXTRACTION_MODEL') ?? 'gemini-3.6-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const UA = 'KABINET/0.1 (+https://github.com/harounalydia-eng/kabinet)'
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

type Confidence = 'high' | 'medium' | 'low'
type Evidence = 'title' | 'caption' | 'description' | 'hashtags' | 'transcript'

// ── Identity ───────────────────────────────────────────────────────────────────

async function identify(req: Request): Promise<string | Response> {
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!bearer || bearer.split('.').length !== 3) return fail(401, 'Sign in to KABINET to import a routine.')
  const { data, error } = await db.auth.getUser(bearer)
  if (error || !data.user) return fail(401, 'Your session has expired. Sign in again.')
  return data.user.id
}

// ── Metadata (public, no credentials) ──────────────────────────────────────────

interface OEmbed { title?: string; author_name?: string; author_url?: string; embed_product_id?: string; thumbnail_url?: string; thumbnail_width?: number | string; thumbnail_height?: number | string }

type Meta = {
  sourceId: string | null; title: string | null; caption: string | null; description: string | null; creatorName: string | null; creatorHandle: string | null
  creatorUrl: string | null; thumb: string | null; w: number | null; h: number | null; embed: string | null; raw: Record<string, unknown>; note: string | null
}

const handleFrom = (url: string | null): string | null => {
  const m = url?.match(/\/@([\w.-]+)/)
  return m ? `@${m[1]}` : null
}
const hashtagsIn = (...texts: Array<string | null>): string[] => {
  const out = new Set<string>()
  for (const t of texts) for (const m of (t ?? '').matchAll(/#([\p{L}\p{N}_]+)/gu)) out.add(m[1].toLowerCase())
  return [...out]
}

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`The platform did not return details for this link (${res.status}).`)
  return (await res.json()) as T
}

/** YouTube description: the official Data API when a key is configured, else the watch page's own player JSON (unofficial; may stop working). */
async function youtubeDescription(videoId: string): Promise<{ description: string | null; tags: string[]; via: 'data_api' | 'watch_page' | null }> {
  if (YOUTUBE_KEY) {
    try {
      const d = await getJson<{ items?: Array<{ snippet?: { description?: string; tags?: string[] } }> }>(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_KEY}`)
      const s = d.items?.[0]?.snippet
      return { description: s?.description ?? null, tags: s?.tags ?? [], via: 'data_api' }
    } catch (e) {
      console.warn('[import-routine] youtube data api', (e as Error).message)
    }
  }
  try {
    // The EU consent interstitial (edge runtime sits in eu-west-1) hides the player JSON; these cookies decline it.
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Accept-Language': 'en', Cookie: 'CONSENT=YES+cb.20240101-00-p0.en+FX+000; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwMTAxLjAwX3AwGgJlbiACGgYIgLC_rQY' }, signal: AbortSignal.timeout(10_000) })
    const html = await res.text()
    const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
    const description = m ? (JSON.parse(`"${m[1]}"`) as string) : null
    const k = html.match(/"keywords":(\[[^\]]*\])/)
    const tags = k ? (JSON.parse(k[1]) as string[]) : []
    return { description, tags, via: description ? 'watch_page' : null }
  } catch {
    return { description: null, tags: [], via: null }
  }
}

async function metadata(link: DetectedLink): Promise<Meta> {
  const m: Meta = { sourceId: link.sourceId, title: null, caption: null, description: null, creatorName: null, creatorHandle: null, creatorUrl: null, thumb: null, w: null, h: null, embed: null, raw: {}, note: null }
  if (link.platform === 'tiktok') {
    const o = await getJson<OEmbed>(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}`)
    m.caption = o.title ?? null
    m.title = o.title ? o.title.split(/[\n#]/)[0].trim() || null : null
    m.creatorName = o.author_name ?? null
    m.creatorUrl = o.author_url ?? null
    m.creatorHandle = handleFrom(o.author_url ?? null)
    if (!m.sourceId && o.embed_product_id && /^\d+$/.test(o.embed_product_id)) m.sourceId = o.embed_product_id
    m.thumb = o.thumbnail_url ?? null
    m.w = Number(o.thumbnail_width) || null
    m.h = Number(o.thumbnail_height) || null
    m.embed = m.sourceId ? `https://www.tiktok.com/embed/v2/${m.sourceId}` : null
    m.raw = { oembed: o }
    m.note = 'TikTok shares the caption, creator and thumbnail. Spoken words are not available to apps.'
  } else if (link.platform === 'youtube') {
    const o = await getJson<OEmbed>(`https://www.youtube.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}&format=json`)
    m.title = o.title ?? null
    m.creatorName = o.author_name ?? null
    m.creatorUrl = o.author_url ?? null
    m.creatorHandle = handleFrom(o.author_url ?? null)
    m.thumb = link.sourceId ? `https://i.ytimg.com/vi/${link.sourceId}/hqdefault.jpg` : o.thumbnail_url ?? null
    m.w = 480
    m.h = 360
    m.embed = link.sourceId ? `https://www.youtube-nocookie.com/embed/${link.sourceId}?playsinline=1&rel=0` : null
    const d = link.sourceId ? await youtubeDescription(link.sourceId) : { description: null, tags: [], via: null }
    m.description = d.description
    m.raw = { oembed: o, description_via: d.via, tags: d.tags }
    m.note = d.via ? null : 'YouTube shared the title, creator and thumbnail; the description could not be read.'
  } else {
    m.embed = link.canonicalUrl.replace(/\/$/, '') + '/embed/'
    m.note = 'Instagram does not share captions or thumbnails with apps. Paste the caption or what is said and KABINET will work from that.'
  }
  return m
}

// ── Extraction (one Gemini call) ───────────────────────────────────────────────

/** Standard JSON Schema — Gemini accepts it as `responseJsonSchema`; `toGeminiSchema` converts it for the older `responseSchema` field. */
const CONF = { type: 'string', enum: ['high', 'medium', 'low'] } as const
const SCHEMA = {
  type: 'object',
  required: ['title', 'routine_type', 'description', 'skin_hair_context', 'confidence', 'notes', 'products', 'steps'],
  properties: {
    title: { type: 'string', description: "What this routine is, in the creator's framing. Not marketing copy." },
    routine_type: { type: 'string', enum: ['skincare', 'makeup', 'haircare', 'scalp', 'body', 'nails', 'mixed', 'unknown'] },
    description: { type: ['string', 'null'] },
    skin_hair_context: { type: ['string', 'null'], description: 'What the creator says about their own skin/hair, close to verbatim. Null if not stated.' },
    confidence: CONF,
    notes: { type: ['string', 'null'], description: 'What evidence was thin or missing.' },
    products: {
      type: 'array',
      items: {
        type: 'object',
        required: ['raw_brand', 'raw_product_name', 'raw_variant', 'raw_text', 'usage_order', 'usage_notes', 'amount_text', 'evidence', 'confidence'],
        properties: {
          raw_brand: { type: ['string', 'null'], description: 'Only when the evidence names it.' },
          raw_product_name: { type: 'string', description: 'Exactly as named in the evidence. A generic category ("sunscreen") is allowed when no name is given — never guess a brand or a specific product for it.' },
          raw_variant: { type: ['string', 'null'], description: 'Shade, size, strength, formula if stated.' },
          raw_text: { type: 'string', description: 'The exact words in the evidence this product comes from, copied verbatim.' },
          usage_order: { type: 'integer' },
          usage_notes: { type: ['string', 'null'] },
          amount_text: { type: ['string', 'null'] },
          evidence: { type: 'array', items: { type: 'string', enum: ['title', 'caption', 'description', 'hashtags', 'transcript'] } },
          confidence: CONF,
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step_number', 'title', 'instruction', 'product_index', 'timing_text', 'area_text', 'confidence'],
        properties: {
          step_number: { type: 'integer' },
          title: { type: ['string', 'null'], description: 'A short label such as Cleanse, Prep, Protect.' },
          instruction: { type: 'string', description: "What the creator does, in the creator's terms." },
          product_index: { type: ['integer', 'null'], description: 'Index into products (0-based) when this step uses one.' },
          timing_text: { type: ['string', 'null'], description: 'Only if explicitly mentioned.' },
          area_text: { type: ['string', 'null'], description: 'Only if explicitly mentioned.' },
          confidence: CONF,
        },
      },
    },
  },
}

/** JSON Schema → Gemini `Schema` (uppercase types, `nullable` instead of type arrays, no keywords Gemini rejects). */
function toGeminiSchema(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let type = node.type as string | string[]
  if (Array.isArray(type)) {
    if (type.includes('null')) out.nullable = true
    type = type.find((t) => t !== 'null') ?? 'string'
  }
  out.type = String(type).toUpperCase()
  if (node.description) out.description = node.description
  if (node.enum) out.enum = node.enum
  if (node.required) out.required = node.required
  if (node.properties) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node.properties as Record<string, Record<string, unknown>>)) props[k] = toGeminiSchema(v)
    out.properties = props
    out.propertyOrdering = Object.keys(props)
  }
  if (node.items) out.items = toGeminiSchema(node.items as Record<string, unknown>)
  return out
}

const SYSTEM = `You turn the text around a beauty video into a structured routine, the way a recipe importer turns a cooking video into ingredients and steps. You are a careful transcriber of what the creator shared, not an expert filling gaps.

Rules that must never be broken:
- Use ONLY the evidence given. Never add a brand, product, shade, amount, timing or step that the evidence does not state. Your general knowledge of beauty products must not add anything.
- A product needs a name in the evidence. If only a category is stated ("a sunscreen", "my toner", "this one is from CeraVe"), record what IS stated (category and, if named, the brand) as raw_product_name / raw_brand with confidence low — do not guess which specific product it is.
- raw_text must be an exact quote copied from the evidence.
- Steps only when the evidence states actions; keep the creator's order. If products are merely listed with no actions, return steps as an empty array.
- timing_text and area_text only when explicitly mentioned.
- Say nothing about whether anything is good for anyone. No claims, no advice.
- If the evidence is not about a beauty routine at all, return routine_type "unknown", empty products and steps, and explain in notes.
Return JSON only.`

type Extraction = {
  title: string; routine_type: string; description: string | null; skin_hair_context: string | null; confidence: Confidence; notes: string | null
  products: Array<{ raw_brand: string | null; raw_product_name: string; raw_variant: string | null; raw_text: string; usage_order: number; usage_notes: string | null; amount_text: string | null; evidence: Evidence[]; confidence: Confidence }>
  steps: Array<{ step_number: number; title: string | null; instruction: string; product_index: number | null; timing_text: string | null; area_text: string | null; confidence: Confidence }>
}

class GeminiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

/** One generateContent call with a JSON schema. Tries the standard-JSON-Schema field first, then Gemini's own Schema shape. */
async function geminiJson(model: string, system: string, user: string, schema: Record<string, unknown>, maxOutputTokens = 6000): Promise<{ data: unknown; usage: Record<string, unknown> | null; schemaField: string }> {
  if (!GEMINI_KEY) throw new GeminiError(503, 'GEMINI_API_KEY is not configured on the server.')
  const attempts: Array<[string, Record<string, unknown>]> = [
    ['responseJsonSchema', { responseJsonSchema: schema }],
    ['responseSchema', { responseSchema: toGeminiSchema(schema) }],
  ]
  let lastErr: GeminiError | null = null
  for (const [field, cfg] of attempts) {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens, ...cfg },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg = ((body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`).slice(0, 300)
      lastErr = new GeminiError(res.status, msg)
      // Only a schema-shape rejection is worth retrying with the other field.
      if (res.status === 400 && /schema|responseJsonSchema|response_json_schema/i.test(msg)) continue
      throw lastErr
    }
    const cands = (body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> | undefined) ?? []
    const text = cands[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new GeminiError(502, `Gemini returned no content (${cands[0]?.finishReason ?? 'no candidate'}).`)
    try {
      return { data: JSON.parse(text), usage: (body.usageMetadata as Record<string, unknown>) ?? null, schemaField: field }
    } catch {
      throw new GeminiError(502, 'Gemini returned something that is not JSON.')
    }
  }
  throw lastErr ?? new GeminiError(502, 'Gemini did not answer.')
}

const str0 = (v: unknown, max = 400): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const conf = (v: unknown): Confidence => (v === 'high' || v === 'medium' ? v : 'low')
const squash = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/**
 * Nothing the model says is trusted as-is. Shapes are enforced, and every product's raw_text must actually occur
 * in the evidence — a quote that is not there means the product was not there either, so it is dropped.
 */
function validateExtraction(v: unknown, evidenceText: string): { x: Extraction; dropped: string[] } {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const hay = squash(evidenceText)
  const TYPES = new Set(['skincare', 'makeup', 'haircare', 'scalp', 'body', 'nails', 'mixed', 'unknown'])
  const EV = new Set(['title', 'caption', 'description', 'hashtags', 'transcript'])
  const dropped: string[] = []
  const rawProducts = Array.isArray(o.products) ? (o.products as Array<Record<string, unknown>>) : []
  const keep: number[] = []
  const products: Extraction['products'] = []
  rawProducts.forEach((p, i) => {
    const name = str0(p.raw_product_name, 120)
    const quote = str0(p.raw_text, 600)
    if (!name || !quote) return
    if (!hay.includes(squash(quote))) {
      dropped.push(name)
      return
    }
    keep.push(i)
    products.push({
      raw_brand: str0(p.raw_brand, 80), raw_product_name: name, raw_variant: str0(p.raw_variant, 120), raw_text: quote,
      usage_order: Number.isInteger(p.usage_order) ? (p.usage_order as number) : products.length + 1,
      usage_notes: str0(p.usage_notes, 300), amount_text: str0(p.amount_text, 80),
      evidence: (Array.isArray(p.evidence) ? p.evidence : []).filter((e): e is Evidence => typeof e === 'string' && EV.has(e)),
      confidence: conf(p.confidence),
    })
  })
  const remap = new Map(keep.map((oldIdx, newIdx) => [oldIdx, newIdx]))
  const steps: Extraction['steps'] = (Array.isArray(o.steps) ? (o.steps as Array<Record<string, unknown>>) : [])
    .map((s, i) => ({
      step_number: i + 1, title: str0(s.title, 40), instruction: str0(s.instruction, 300) ?? '',
      product_index: Number.isInteger(s.product_index) && remap.has(s.product_index as number) ? (remap.get(s.product_index as number) as number) : null,
      timing_text: str0(s.timing_text, 80), area_text: str0(s.area_text, 80), confidence: conf(s.confidence),
    }))
    .filter((s) => s.instruction)
  const x: Extraction = {
    title: str0(o.title, 90) ?? '', routine_type: TYPES.has(String(o.routine_type)) ? String(o.routine_type) : 'unknown',
    description: str0(o.description, 300), skin_hair_context: str0(o.skin_hair_context, 200), confidence: conf(o.confidence),
    notes: [str0(o.notes, 300), dropped.length ? `Dropped ${dropped.length} product mention${dropped.length === 1 ? '' : 's'} whose quoted evidence was not in the source: ${dropped.join(', ')}.` : null].filter(Boolean).join(' ') || null,
    products, steps,
  }
  return { x, dropped }
}

async function extract(platform: string, m: Meta, transcript: string | null, hashtags: string[]): Promise<Extraction> {
  const parts = [
    m.title && `TITLE:\n${m.title}`,
    m.caption && m.caption !== m.title && `CAPTION:\n${m.caption}`,
    m.description && `DESCRIPTION:\n${m.description.slice(0, 6000)}`,
    hashtags.length && `HASHTAGS:\n${hashtags.map((h) => `#${h}`).join(' ')}`,
    transcript && `TRANSCRIPT (what is said or written in the video, supplied by the person importing it):\n${transcript.slice(0, 12_000)}`,
  ].filter(Boolean) as string[]
  const user = `Platform: ${platform}\nCreator: ${m.creatorHandle ?? m.creatorName ?? 'unknown'}\n\nEVIDENCE\n\n${parts.join('\n\n')}`
  const { data } = await geminiJson(MODEL, SYSTEM, user, SCHEMA)
  const { x } = validateExtraction(data, parts.join('\n'))
  return x
}

// ── Product resolution (catalog first, then lookup-product) ───────────────────

type Catalog = { id: string; brand: string | null; name: string; image_url: string | null }

const STOP = new Set(['the', 'le', 'la', 'les', 'de', 'by', 'my', 'a', 'an'])
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const toks = (s: string | null | undefined) => norm(s ?? '').split(' ').filter((t) => t.length > 1 && !STOP.has(t))
const GENERIC = new Set(['sunscreen', 'spf', 'cleanser', 'toner', 'serum', 'moisturizer', 'moisturiser', 'cream', 'oil', 'mask', 'shampoo', 'conditioner', 'gel', 'mousse', 'foundation', 'concealer', 'blush', 'mascara', 'lipstick', 'balm', 'essence', 'mist', 'primer', 'powder', 'exfoliant', 'retinol', 'eye cream'])

function score(brand: string | null, name: string, c: Catalog): number {
  const b = toks(brand)
  const n = new Set(toks(name))
  const cb = toks(c.brand)
  const cn = toks(c.name)
  const brandInBrand = b.some((t) => cb.includes(t))
  const brandInName = b.some((t) => cn.includes(t))
  if (b.length && !brandInBrand && !brandInName) return 0
  const overlap = cn.filter((t) => n.has(t)).length
  if (overlap === 0 && !b.length) return 0
  return overlap + (brandInBrand ? 1.5 : brandInName ? 0.5 : 0) + (c.image_url ? 0.25 : 0)
}

async function searchCatalog(words: string[]): Promise<Catalog[]> {
  if (!words.length) return []
  let q = db.from('catalog_products').select('id, brand, name, image_url')
  for (const w of words) q = q.ilike('search_text', `%${w}%`)
  const { data } = await q.limit(8)
  return (data ?? []) as Catalog[]
}

async function lookup(brand: string | null, name: string): Promise<Catalog[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/lookup-product`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify(brand ? { brand, name, limit: 6 } : { query: name, limit: 6 }),
      signal: AbortSignal.timeout(25_000),
    })
    const body = (await res.json()) as { products?: Catalog[] }
    return body.products ?? []
  } catch (e) {
    console.warn('[import-routine] lookup-product', (e as Error).message)
    return []
  }
}

type Resolution = { status: 'matched' | 'possible_match' | 'unresolved' | 'none'; catalogProductId: string | null; candidates: string[] }

/**
 * matched        — one candidate clearly this product (brand agrees and the name shares words)
 * possible_match — plausible candidates, but not clear enough to choose for the person
 * unresolved     — a named product the catalog and provider do not know yet
 * none           — only a category was named ("a sunscreen"); nothing to look up
 */
async function resolve(brand: string | null, name: string): Promise<Resolution> {
  const generic = !brand && GENERIC.has(norm(name))
  if (generic) return { status: 'none', catalogProductId: null, candidates: [] }
  const words = [...toks(brand), ...toks(name)]
  let pool = await searchCatalog(words)
  if (!pool.length && toks(name).length) pool = await searchCatalog(toks(name))
  if (!pool.length) pool = await lookup(brand, name)
  const scored = pool.map((c) => ({ c, s: score(brand, name, c) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
  if (!scored.length) return { status: 'unresolved', catalogProductId: null, candidates: [] }
  const [best, second] = scored
  const strong = best.s >= (brand ? 2.5 : 2) && (!second || best.s - second.s >= 1)
  if (strong) return { status: 'matched', catalogProductId: best.c.id, candidates: scored.slice(0, 4).map((x) => x.c.id) }
  return { status: 'possible_match', catalogProductId: null, candidates: scored.slice(0, 4).map((x) => x.c.id) }
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

const STATUS_COPY: Record<string, string> = {
  reading: 'Reading the post…',
  listening: 'Listening for products…',
  extracting: 'Building the routine…',
  matching: 'Matching products…',
  ready: 'Here\'s what I found.',
}

async function setStatus(importId: string, status: string, extra: Record<string, unknown> = {}) {
  await db.from('content_imports').update({ import_status: status, status_message: STATUS_COPY[status] ?? null, ...extra }).eq('id', importId)
}

const ROUTINE_SELECT = 'id, content_import_id, origin, title, routine_type, description, skin_hair_context, extraction_confidence, extraction_notes, created_at'
const PRODUCT_SELECT = 'id, routine_id, catalog_product_id, raw_brand, raw_product_name, raw_variant, raw_text, usage_order, usage_notes, amount_text, evidence_sources, extraction_confidence, resolution_status, candidate_ids'
const STEP_SELECT = 'id, routine_id, step_number, title, instruction, routine_product_id, catalog_product_id, timing_text, area_text, notes, extraction_confidence'
const IMPORT_SELECT = 'id, platform, source_url, canonical_url, source_content_id, creator_name, creator_handle, creator_profile_url, title, caption, description, hashtags, thumbnail_url, thumbnail_w, thumbnail_h, embed_url, transcript_source, evidence_sources, import_status, status_message, error, extraction_confidence, model, created_at'

async function payload(importId: string, routineId: string | null) {
  const { data: imp } = await db.from('content_imports').select(IMPORT_SELECT).eq('id', importId).single()
  if (!routineId) return { import: imp, routine: null, products: [], steps: [] }
  const [{ data: routine }, { data: products }, { data: steps }] = await Promise.all([
    db.from('routines').select(ROUTINE_SELECT).eq('id', routineId).single(),
    db.from('routine_products').select(PRODUCT_SELECT).eq('routine_id', routineId).order('usage_order'),
    db.from('routine_steps').select(STEP_SELECT).eq('routine_id', routineId).order('step_number'),
  ])
  return { import: imp, routine, products: products ?? [], steps: steps ?? [] }
}

async function runPipeline(importId: string, link: DetectedLink, userTranscript: string | null, userId: string): Promise<string> {
  // 1 · read the post
  await setStatus(importId, 'reading', { error: null })
  const m = await metadata(link)
  const hashtags = hashtagsIn(m.caption, m.description)
  const evidence: Evidence[] = []
  if (m.title) evidence.push('title')
  if (m.caption && m.caption !== m.title) evidence.push('caption')
  if (m.description) evidence.push('description')
  if (hashtags.length) evidence.push('hashtags')
  await db.from('content_imports').update({
    source_content_id: m.sourceId ?? link.sourceId ?? link.canonicalUrl, creator_name: m.creatorName, creator_handle: m.creatorHandle, creator_profile_url: m.creatorUrl,
    title: m.title, caption: m.caption, description: m.description, hashtags, thumbnail_url: m.thumb, thumbnail_w: m.w, thumbnail_h: m.h, embed_url: m.embed,
    raw_metadata: { ...m.raw, note: m.note },
  }).eq('id', importId)

  // 2 · listen — a transcript only exists when the person gives one (platforms do not share spoken words with apps)
  await setStatus(importId, 'listening')
  const transcript = userTranscript?.trim() || null
  if (transcript) evidence.push('transcript')
  await db.from('content_imports').update({ transcript, transcript_source: transcript ? 'user' : null, evidence_sources: evidence }).eq('id', importId)
  if (!evidence.length) throw new Error(m.note ?? 'Nothing readable came back for this link. Paste the caption or what is said and try again.')

  // 3 · build the routine — one model call over the evidence
  if (!GEMINI_KEY) throw new Error('KABINET\'s extraction is not configured yet (GEMINI_API_KEY missing). The post was read and kept; run it again once the key is set.')
  await setStatus(importId, 'extracting')
  const x = await extract(link.platform, m, transcript, hashtags)

  // 4 · match products — the catalog first, then Open Beauty Facts through lookup-product
  await setStatus(importId, 'matching')
  const { data: routine, error: rErr } = await db.from('routines').insert({
    content_import_id: importId, origin: 'import', title: x.title || m.title || 'Routine', routine_type: x.routine_type ?? 'unknown', description: x.description,
    skin_hair_context: x.skin_hair_context, extraction_confidence: x.confidence, extraction_notes: x.notes, created_by: userId,
  }).select('id').single()
  if (rErr || !routine) throw new Error(rErr?.message ?? 'Could not save the routine.')

  const productIds: Array<string | null> = []
  const productCatalog: Array<string | null> = []
  for (const [i, p] of x.products.entries()) {
    const r = await resolve(p.raw_brand, p.raw_product_name)
    const { data: row } = await db.from('routine_products').insert({
      routine_id: routine.id, catalog_product_id: r.catalogProductId, raw_brand: p.raw_brand, raw_product_name: p.raw_product_name, raw_variant: p.raw_variant, raw_text: p.raw_text,
      usage_order: p.usage_order ?? i + 1, usage_notes: p.usage_notes, amount_text: p.amount_text, evidence_sources: p.evidence ?? [], extraction_confidence: p.confidence,
      resolution_status: r.status, candidate_ids: r.candidates,
    }).select('id').single()
    productIds.push(row?.id ?? null)
    productCatalog.push(r.catalogProductId)
  }
  const steps = x.steps.map((s, i) => {
    const pi = s.product_index != null && s.product_index >= 0 && s.product_index < productIds.length ? s.product_index : null
    return {
      routine_id: routine.id, step_number: i + 1, title: s.title, instruction: s.instruction, routine_product_id: pi == null ? null : productIds[pi],
      catalog_product_id: pi == null ? null : productCatalog[pi], timing_text: s.timing_text, area_text: s.area_text, extraction_confidence: s.confidence,
    }
  })
  if (steps.length) await db.from('routine_steps').insert(steps)

  await setStatus(importId, 'ready', { extraction_confidence: x.confidence, model: MODEL })
  return routine.id
}

async function latestRoutineFor(importId: string): Promise<string | null> {
  const { data } = await db.from('routines').select('id').eq('content_import_id', importId).eq('origin', 'import').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ?? null
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'POST only.')
  const who = await identify(req)
  if (who instanceof Response) return who
  const route = new URL(req.url).pathname.replace(/^.*\/import-routine/, '') || '/'
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const str = (v: unknown, max = 20_000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

  try {
    if (route === '/diagnose') {
      // Proves the secret is readable and the model answers. The key itself is never returned or logged.
      // Names of secrets only (never values) so a mis-named key is diagnosable; `model` in the body tests a candidate without redeploying.
      const envNames = Object.keys(Deno.env.toObject()).filter((n) => !/^(SUPABASE_|DENO_|SB_|HOME$|PATH$|HOSTNAME$|LANG|LC_|TERM|PWD$|USER$|SHELL$|TMPDIR$)/.test(n)).sort()
      const model = str(body.model, 80) ?? MODEL
      const out: Record<string, unknown> = { ok: false, key_present: !!GEMINI_KEY, model, default_model: MODEL, env_names: envNames }
      if (!GEMINI_KEY) return json({ ...out, message: 'GEMINI_API_KEY is not set in the function secrets.' }, 503)
      try {
        const list = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_KEY }, signal: AbortSignal.timeout(15_000) })
        const lb = (await list.json().catch(() => ({}))) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }>; error?: { message?: string } }
        out.models_endpoint = list.status
        if (!list.ok) return json({ ...out, message: `Model listing failed: ${(lb.error?.message ?? `HTTP ${list.status}`).slice(0, 200)}` }, 502)
        const names = (lb.models ?? []).filter((mm) => (mm.supportedGenerationMethods ?? []).includes('generateContent')).map((mm) => mm.name.replace(/^models\//, ''))
        out.model_listed = names.includes(model)
        out.flash_models = names.filter((n) => /flash/.test(n)).slice(0, 40)
        const t0 = Date.now()
        const r = await geminiJson(model, 'Answer with JSON only.', 'Return {"ok": true, "word": "kabinet"}', { type: 'object', required: ['ok', 'word'], properties: { ok: { type: 'boolean' }, word: { type: 'string' } } }, 64)
        out.test_ms = Date.now() - t0
        out.test_reply = r.data
        out.schema_field = r.schemaField
        out.usage = r.usage
        return json({ ...out, ok: true, message: 'Gemini answered.' })
      } catch (e) {
        const status = e instanceof GeminiError ? e.status : 502
        return json({ ...out, message: (e as Error).message }, status)
      }
    }

    if (route === '/confirm') {
      const rpId = str(body.routine_product_id)
      const cpId = body.catalog_product_id === null ? null : str(body.catalog_product_id)
      if (!rpId) return fail(400, 'routine_product_id is required.')
      const { data: rp } = await db.from('routine_products').select('id, routine_id').eq('id', rpId).maybeSingle()
      if (!rp) return fail(404, 'That product is not part of a routine any more.')
      if (cpId) {
        const { data: cp } = await db.from('catalog_products').select('id').eq('id', cpId).maybeSingle()
        if (!cp) return fail(404, 'That catalog product does not exist.')
      }
      const { data: row, error } = await db.from('routine_products').update({ catalog_product_id: cpId, resolution_status: cpId ? 'manual' : 'unresolved', resolved_by: who }).eq('id', rpId).select(PRODUCT_SELECT).single()
      if (error) throw new Error(error.message)
      await db.from('routine_steps').update({ catalog_product_id: cpId }).eq('routine_product_id', rpId)
      return json({ ok: true, product: row, message: cpId ? 'Linked.' : 'Left unresolved.' })
    }

    if (route === '/rerun') {
      const importId = str(body.import_id)
      if (!importId) return fail(400, 'import_id is required.')
      const { data: imp } = await db.from('content_imports').select('id, source_url').eq('id', importId).maybeSingle()
      if (!imp) return fail(404, 'Unknown import.')
      const link = detectPlatform(imp.source_url)
      if (!link) return fail(400, 'The stored link is not supported.')
      try {
        const routineId = await runPipeline(importId, link, str(body.transcript), who)
        return json({ ok: true, cached: false, ...(await payload(importId, routineId)) })
      } catch (e) {
        await setStatus(importId, 'failed', { error: (e as Error).message, status_message: null })
        return json({ ok: false, error: (e as Error).message, message: (e as Error).message, ...(await payload(importId, null)) }, 422)
      }
    }

    // ── POST / : import a URL ──
    const url = str(body.url, 2000)
    if (!url) return fail(400, 'Paste a link first.')
    const link = detectPlatform(url)
    if (!link) return fail(400, 'That is not a TikTok, Instagram or YouTube link.')
    const transcript = str(body.transcript)

    // Same post already read for someone? Reuse it — the content is public and the extraction is the same for everyone.
    let existing = null as null | { id: string; import_status: string }
    if (link.sourceId) {
      const { data } = await db.from('content_imports').select('id, import_status').eq('platform', link.platform).eq('source_content_id', link.sourceId).maybeSingle()
      existing = data
    }
    if (!existing) {
      const { data } = await db.from('content_imports').select('id, import_status').eq('canonical_url', link.canonicalUrl).maybeSingle()
      existing = data
    }
    if (existing && existing.import_status === 'ready' && !transcript) {
      const routineId = await latestRoutineFor(existing.id)
      if (routineId) return json({ ok: true, cached: true, ...(await payload(existing.id, routineId)) })
    }

    let importId = existing?.id ?? null
    if (!importId) {
      const { data, error } = await db.from('content_imports').insert({
        platform: link.platform, source_url: url, canonical_url: link.canonicalUrl, source_content_id: link.sourceId ?? link.canonicalUrl, import_status: 'queued', created_by: who,
      }).select('id').single()
      if (error || !data) throw new Error(error?.message ?? 'Could not record the import.')
      importId = data.id
    }
    try {
      const routineId = await runPipeline(importId, link, transcript, who)
      return json({ ok: true, cached: false, ...(await payload(importId, routineId)) })
    } catch (e) {
      const message = (e as Error).message
      console.error('[import-routine]', message)
      await setStatus(importId, 'failed', { error: message, status_message: null })
      return json({ ok: false, error: message, message, ...(await payload(importId, null)) }, 422)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[import-routine] fatal', message)
    return fail(500, message)
  }
})
