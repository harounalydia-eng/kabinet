import { useEffect, useState } from 'react'
import { getCatalogProduct, getCatalogProducts, type CatalogProduct } from './catalogProducts'

/** One in-memory copy of each canonical record per session; every ProductImage on a page shares it. */
const cache = new Map<string, CatalogProduct | null>()
const inflight = new Map<string, Promise<CatalogProduct | null>>()

export function cachedCatalogProduct(id: string): CatalogProduct | null | undefined {
  return cache.get(id)
}

export function loadCatalogProduct(id: string): Promise<CatalogProduct | null> {
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null)
  let p = inflight.get(id)
  if (!p) {
    p = getCatalogProduct(id)
      .catch(() => null)
      .then((row) => {
        cache.set(id, row)
        inflight.delete(id)
        return row
      })
    inflight.set(id, p)
  }
  return p
}

/** Warm the cache for a list (one request), e.g. a shelf of owned products. */
export async function preloadCatalogProducts(ids: Array<string | null | undefined>): Promise<void> {
  const want = [...new Set(ids.filter((x): x is string => !!x && !cache.has(x) && !inflight.has(x)))]
  if (!want.length) return
  try {
    const rows = await getCatalogProducts(want)
    for (const id of want) cache.set(id, rows.get(id) ?? null)
  } catch {
    /* leave the ids unresolved; per-image loads will retry */
  }
}

export function useCatalogProduct(id: string | null | undefined): { product: CatalogProduct | null; loading: boolean } {
  const [state, setState] = useState<{ id: string | null; product: CatalogProduct | null; loading: boolean }>(() => ({
    id: id ?? null,
    product: id ? (cache.get(id) ?? null) : null,
    loading: !!id && !cache.has(id),
  }))
  useEffect(() => {
    if (!id) {
      setState({ id: null, product: null, loading: false })
      return
    }
    if (cache.has(id)) {
      setState({ id, product: cache.get(id) ?? null, loading: false })
      return
    }
    let live = true
    setState({ id, product: null, loading: true })
    void loadCatalogProduct(id).then((row) => live && setState({ id, product: row, loading: false }))
    return () => {
      live = false
    }
  }, [id])
  return state.id === (id ?? null) ? { product: state.product, loading: state.loading } : { product: null, loading: !!id }
}
