// KABINET · canonical product catalog (public.catalog_products) — what a product IS. Shared by both apps.
// Ownership, status, notes, compatibility and evidence never live here; they belong to the user's own records.
export type CatalogCategory = 'skin' | 'hair' | 'makeup' | 'nails' | 'body' | 'wellness'

export type CatalogProduct = {
  id: string
  brand: string | null
  name: string
  category: CatalogCategory | null
  category_tags: string[]
  barcode: string | null
  quantity: string | null
  /** Legitimate product/packshot from the provider, or null. Never stock imagery. */
  image_url: string | null
  ingredients: string[]
  ingredients_text: string | null
  /** open_beauty_facts · open_food_facts · brand · retailer · manual · … (rows of catalog_sources) */
  source: string
  source_id: string | null
  source_url: string | null
  fetched_at: string | null
  created_at: string
  updated_at: string
}

export type LookupInput = ({ barcode: string } | { query: string } | { brand: string; name: string }) & { refresh?: boolean; limit?: number }

export type LookupResult = {
  ok: boolean
  /** false when the provider has never seen the product (HTTP 404 from the function). */
  found?: boolean
  /** true = answered from catalog_products without touching the provider. */
  cached: boolean
  source: string
  product: CatalogProduct | null
  products: CatalogProduct[]
  message: string
  warning?: string
}
