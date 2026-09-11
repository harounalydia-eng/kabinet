// Lookup + read access to KABINET's shared product catalog. Data layer only — no UI in this phase.
import { supabase } from './supabase'
import type { CatalogProduct, LookupInput, LookupResult } from './catalogProducts.types'

export type { CatalogProduct, CatalogCategory, LookupInput, LookupResult } from './catalogProducts.types'

const CATALOG_SELECT = 'id, brand, name, category, category_tags, barcode, quantity, image_url, ingredients, ingredients_text, source, source_id, source_url, fetched_at, created_at, updated_at'

/**
 * Cache-first lookup through the `lookup-product` edge function: catalog_products first, then Open Beauty Facts,
 * whose answer is normalised and stored before it comes back. "Not found" is a result, not an exception.
 * Throws only when the build has no Supabase keys, the call is rejected, or the provider is down (502).
 */
export async function lookupProduct(input: LookupInput): Promise<LookupResult> {
  if (!supabase) throw new Error('Product lookup needs Supabase keys in this build.')
  const { data, error } = await supabase.functions.invoke<LookupResult>('lookup-product', { body: input })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.json().catch(() => null)) as LookupResult | null
      if (body && ctx.status === 404) return body
      if (body?.message) throw new Error(body.message)
    }
    throw new Error(error.message)
  }
  return data as LookupResult
}

/** One canonical record by id (public read). */
export async function getCatalogProduct(id: string): Promise<CatalogProduct | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('catalog_products').select(CATALOG_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data as CatalogProduct | null
}

/** Several canonical records by id, e.g. to hydrate My Kabinet rows that carry catalogProductId. */
export async function getCatalogProducts(ids: string[]): Promise<Map<string, CatalogProduct>> {
  const out = new Map<string, CatalogProduct>()
  if (!supabase || !ids.length) return out
  const { data, error } = await supabase.from('catalog_products').select(CATALOG_SELECT).in('id', [...new Set(ids)])
  if (error) throw new Error(error.message)
  for (const row of (data ?? []) as CatalogProduct[]) out.set(row.id, row)
  return out
}

// ── Matching ─────────────────────────────────────────────────────────────────

const STOP = new Set(['the', 'le', 'la', 'les', 'de', 'by'])
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const toks = (s: string | null | undefined) => norm(s ?? '').split(' ').filter((t) => t.length > 1 && !STOP.has(t))

/**
 * The candidate that is really this product, or null. A brand, when given, must appear in the candidate's
 * brand or name — so "The Ordinary · Niacinamide" never matches Aroma Zone's niacinamide serum. Then the
 * candidate sharing the most name words wins; a photo breaks ties.
 */
export function pickCatalogMatch(brand: string | null | undefined, name: string, candidates: CatalogProduct[]): CatalogProduct | null {
  const b = toks(brand)
  const n = new Set(toks(name))
  let best: CatalogProduct | null = null
  let bestScore = 0
  for (const c of candidates) {
    const cb = toks(c.brand)
    const cn = toks(c.name)
    const brandInBrand = b.some((t) => cb.includes(t))
    if (b.length && !brandInBrand && !b.some((t) => cn.includes(t))) continue
    const overlap = cn.filter((t) => n.has(t)).length
    if (overlap === 0 && !b.length) continue
    const score = overlap + (brandInBrand ? 1 : 0) + (c.image_url ? 0.5 : 0)
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return best
}

/** Cache-first lookup + strict match. Never throws — a product without a match is a normal outcome. */
export async function findCatalogProduct(brand: string | null | undefined, name: string): Promise<CatalogProduct | null> {
  if (!supabase || !name.trim()) return null
  try {
    const res = await lookupProduct(brand?.trim() ? { brand: brand.trim(), name: name.trim(), limit: 6 } : { query: name.trim(), limit: 6 })
    return pickCatalogMatch(brand, name, res.products)
  } catch {
    return null
  }
}
