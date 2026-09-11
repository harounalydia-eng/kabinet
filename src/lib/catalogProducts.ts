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
