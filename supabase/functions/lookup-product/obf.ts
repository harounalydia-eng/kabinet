// Open Beauty Facts / Open Food Facts → KABINET catalog normaliser.
//
// PURE MODULE: no Deno globals, no Supabase, `fetch` is injected — so it can be exercised with Node
// (`node --experimental-strip-types`) and a mocked fetch, including the "provider is down" path.
//
// Verified 2026-09-11 against the live API:
//   • barcode  GET {base}/api/v2/product/{code}.json?product_type=all&fields=…  → { status: 1|0, product }
//     A code filed under another product type (e.g. Olaplex No.3 is filed as "food") redirects to
//     world.openfoodfacts.org with product_type=all — we follow it and record which domain answered.
//   • search   GET {base}/cgi/search.pl?search_terms=…&search_simple=1&action=process&json=1&page_size=…
//     (the v2 /api/v2/search endpoint filters by tags only, no free text). Multi-word queries are AND-ed
//     against product names, so "the ordinary niacinamide" finds nothing while "the ordinary" finds 25 —
//     hence the fallback chain in searchProducts().
//   • A descriptive User-Agent is required by the project's terms.

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export const OBF_BASE = 'https://world.openbeautyfacts.org'
export const OFF_BASE = 'https://world.openfoodfacts.org'
export const DEFAULT_USER_AGENT = 'KABINET/0.1 (+https://github.com/harounalydia-eng/kabinet)'

export type CatalogSource = 'open_beauty_facts' | 'open_food_facts'
export type KabinetCategory = 'skin' | 'hair' | 'makeup' | 'nails' | 'body' | 'wellness'

/** One row of public.catalog_products as the edge function writes it (generated columns excluded). */
export type NormalizedProduct = {
  brand: string | null
  name: string
  category: KabinetCategory | null
  category_tags: string[]
  barcode: string | null
  quantity: string | null
  image_url: string | null
  ingredients: string[]
  ingredients_text: string | null
  source: CatalogSource
  source_id: string
  source_url: string
  raw: Record<string, unknown>
  fetched_at: string
}

export class UpstreamError extends Error {
  readonly status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'UpstreamError'
    this.status = status
  }
}

const FIELDS = [
  'code', 'product_name', 'product_name_en', 'brands', 'brands_tags', 'categories_tags', 'ingredients_text',
  'ingredients_text_en', 'ingredients', 'image_front_url', 'image_url', 'quantity', 'product_type', 'last_modified_t', 'lang',
].join(',')

type ObfProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  brands_tags?: string[]
  categories_tags?: string[]
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients?: Array<{ text?: string; id?: string }>
  image_front_url?: string
  image_url?: string
  quantity?: string
  product_type?: string
  last_modified_t?: number
  lang?: string
}

// ── Text helpers ───────────────────────────────────────────────────────────────

/** Mirrors public.kabinet_normalize(): lower-case, accent-free, alphanumeric words. */
export function normalizeText(t: string | null | undefined): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const tokens = (t: string | null | undefined): string[] => normalizeText(t).split(' ').filter(Boolean)

const clean = (s: string | undefined | null): string | null => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim()
  return v.length ? v : null
}

/**
 * GTIN as digits. UPC-A (12) is stored as its 13-digit EAN form so one product has one barcode however it
 * was scanned. Returns null when the input is not a plausible barcode.
 */
export function normalizeBarcode(input: string | number | null | undefined): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length === 12) return `0${digits}`
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length === 8 || digits.length === 13 || digits.length === 14) return digits
  return null
}

// ── Category mapping (heuristic; raw tags are kept on the row for re-mapping) ──

const RULES: Array<[KabinetCategory, RegExp]> = [
  ['hair', /\b(hair|shampoo|shampoing|shampooing|conditioner|apres shampooing|scalp|cheveux|haar|cabello|capillaire|capilar|coiffant|hairspray|bond maintenance)\b/],
  ['nails', /\b(nail|nails|ongle|ongles|unha|unhas|manicure|vernis)\b/],
  ['wellness', /\b(supplement|supplements|vitamin|vitamins|complement alimentaire|gummies)\b/],
  ['body', /\b(body|corps|corporal|deodorant|deodorants|deo|antiperspirant|douche|shower|bath|hand cream|hands|soap|savon|savons|body lotion)\b/],
  ['skin', /\b(lip balm|baume a levres|lipbalm)\b/],
  ['makeup', /\b(makeup|make up|maquillage|maquillaje|foundation|fond de teint|mascara|lipstick|rouge a levres|lip gloss|gloss|lip|lips|concealer|blush|eyeshadow|eye shadow|eyeliner|bronzer|highlighter|primer|powder|poudre|tonal krem|setting spray|brow|brows)\b/],
  ['skin', /\b(skincare|skin care|skin|face|facial|visage|gezicht|huid|serum|moisturiser|moisturizer|moisturising|moisturizing|hydrating|hydratant|hydraterende|cream|creme|dagcreme|nachtcreme|nightcream|cleanser|nettoyant|toner|tonique|tonico|tonic|exfoliant|exfoliating|esfoliante|sunscreen|sun cream|spf|retinol|niacinamide|acid|mask|masque|eye cream|micellar|micellaire)\b/],
]

export function mapCategory(categoryTags: string[], name: string | null, brand: string | null): KabinetCategory | null {
  const haystack = normalizeText([...categoryTags.map((t) => t.replace(/^[a-z]{2}:/, '')), name ?? '', brand ?? ''].join(' | '))
  for (const [category, re] of RULES) if (re.test(haystack)) return category
  return null
}

// ── Normalisation ──────────────────────────────────────────────────────────────

const IMAGE_HOSTS = /^https:\/\/images\.open(beauty|food)facts\.org\//

/** The API hands back the 400px rendition; the full-size file sits next to it (verified with HEAD). */
function fullSizeImage(url: string | undefined): string | null {
  if (!url || !IMAGE_HOSTS.test(url)) return null
  return url.replace(/\.(\d+)\.jpg$/, '.full.jpg')
}

/** INCI lists are comma-separated; commas inside parentheses (e.g. "Parfum (Fragrance)") are not separators. */
export function splitIngredients(text: string | null): string[] {
  if (!text) return []
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === '.') && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  const seen = new Set<string>()
  return out
    .map((s) => s.replace(/^\s*(ingredients?|inci)\s*:\s*/i, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 1 && s.length < 120)
    .filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)))
}

export function normalizeProduct(p: ObfProduct, answeredBy: string): NormalizedProduct | null {
  const code = clean(p.code)
  if (!code) return null
  const brand = clean((p.brands ?? '').split(',')[0])
  const name = clean(p.product_name_en) ?? clean(p.product_name) ?? brand
  if (!name) return null // nothing a person could recognise — not worth a catalog row
  const source: CatalogSource = /openfoodfacts\.org/.test(answeredBy) ? 'open_food_facts' : 'open_beauty_facts'
  const base = source === 'open_food_facts' ? OFF_BASE : OBF_BASE
  const ingredientsText = clean(p.ingredients_text_en) ?? clean(p.ingredients_text)
  const fromArray = (p.ingredients ?? []).map((i) => clean(i.text)).filter((s): s is string => !!s)
  const categoryTags = (p.categories_tags ?? []).filter((t) => typeof t === 'string')
  return {
    brand,
    name,
    category: mapCategory(categoryTags, name, brand),
    category_tags: categoryTags,
    barcode: normalizeBarcode(code),
    quantity: clean(p.quantity),
    image_url: fullSizeImage(p.image_front_url) ?? fullSizeImage(p.image_url),
    ingredients: fromArray.length ? fromArray : splitIngredients(ingredientsText),
    ingredients_text: ingredientsText,
    source,
    source_id: code,
    source_url: `${base}/product/${code}`,
    raw: {
      code, product_name: p.product_name ?? null, product_name_en: p.product_name_en ?? null, brands: p.brands ?? null,
      brands_tags: p.brands_tags ?? [], categories_tags: categoryTags, quantity: p.quantity ?? null, product_type: p.product_type ?? null,
      lang: p.lang ?? null, last_modified_t: p.last_modified_t ?? null, image_front_url: p.image_front_url ?? null,
    },
    fetched_at: new Date().toISOString(),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

export type ClientOptions = { fetch?: Fetch; base?: string; userAgent?: string; timeoutMs?: number }

async function getJson(url: string, opts: ClientOptions): Promise<{ body: Record<string, unknown>; answeredBy: string }> {
  const fetchImpl = opts.fetch ?? (globalThis.fetch as Fetch)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  let res: Response
  try {
    res = await fetchImpl(url, {
      headers: { 'User-Agent': opts.userAgent ?? DEFAULT_USER_AGENT, Accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (err) {
    const reason = err instanceof Error && err.name === 'AbortError' ? 'timed out' : (err instanceof Error ? err.message : String(err))
    throw new UpstreamError(`Open Beauty Facts did not answer (${reason}).`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new UpstreamError(`Open Beauty Facts answered ${res.status}.`, res.status)
  let body: Record<string, unknown>
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    throw new UpstreamError('Open Beauty Facts sent something that is not JSON.')
  }
  return { body, answeredBy: res.url || url }
}

/** One product by barcode, or null when the provider has never seen it. */
export async function fetchByBarcode(barcode: string, opts: ClientOptions = {}): Promise<NormalizedProduct | null> {
  const base = opts.base ?? OBF_BASE
  const { body, answeredBy } = await getJson(`${base}/api/v2/product/${encodeURIComponent(barcode)}.json?product_type=all&fields=${FIELDS}`, opts)
  if (body.status !== 1 || !body.product || typeof body.product !== 'object') return null
  return normalizeProduct(body.product as ObfProduct, answeredBy)
}

async function searchOnce(text: string, limit: number, opts: ClientOptions, brandFilter?: string): Promise<NormalizedProduct[]> {
  const base = opts.base ?? OBF_BASE
  const params = new URLSearchParams({ search_terms: text, search_simple: '1', action: 'process', json: '1', page_size: String(limit), fields: FIELDS })
  if (brandFilter) {
    params.set('tagtype_0', 'brands')
    params.set('tag_contains_0', 'contains')
    params.set('tag_0', brandFilter)
  }
  const { body, answeredBy } = await getJson(`${base}/cgi/search.pl?${params}`, opts)
  const products = Array.isArray(body.products) ? (body.products as ObfProduct[]) : []
  const seen = new Set<string>()
  return products
    .map((p) => normalizeProduct(p, answeredBy))
    .filter((n): n is NormalizedProduct => !!n && (seen.has(n.source_id) ? false : (seen.add(n.source_id), true)))
}

export type SearchInput = { query?: string | null; brand?: string | null; name?: string | null }

/**
 * Free-text / brand + name search with a fallback chain, because the provider AND-s every word:
 *   1. the whole text                       ("maybelline fit me" → 56 hits)
 *   2. name only, filtered to the brand tag ("niacinamide" within brand "the ordinary")
 *   3. brand only, then keep hits whose name shares a word with the requested name
 */
export async function searchProducts(input: SearchInput, limit: number, opts: ClientOptions = {}): Promise<NormalizedProduct[]> {
  const brand = clean(input.brand)
  const name = clean(input.name)
  const text = clean(input.query) ?? [brand, name].filter(Boolean).join(' ')
  if (!text) return []

  const direct = await searchOnce(text, limit, opts)
  if (direct.length) return direct

  if (brand && name) {
    const withinBrand = await searchOnce(name, limit, opts, brand)
    if (withinBrand.length) return withinBrand
  }

  if (brand && (name || input.query)) {
    const wanted = new Set(tokens(name ?? input.query).filter((t) => t.length > 2))
    if (!wanted.size) return []
    const byBrand = await searchOnce(brand, 50, opts)
    const scored = byBrand
      .map((p) => ({ p, hits: tokens(p.name).filter((t) => wanted.has(t)).length }))
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
    return scored.slice(0, limit).map((x) => x.p)
  }

  return []
}
