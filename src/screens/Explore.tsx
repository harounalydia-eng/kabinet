import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CategoryFilter } from '../components/CategoryFilter'
import { ContextualSearch } from '../components/ContextualSearch'
import { CollectionPicker } from '../components/CollectionPicker'
import { Chip } from '../components/Chip'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { Header } from '../components/Header'
import { CATALOG, PRODUCTS } from '../lib/catalog'
import { fromLook } from '../lib/feed'
import { ProductCard } from '../components/ProductCard'
import { useStore } from '../lib/store'
import type { Category, Product } from '../lib/types'

type Segment = 'foryou' | 'trending' | Category
type Mode = 'looks' | 'products'

/** Explore — discovery beyond your world. Commerce only ever emerges from a look. */
export default function Explore() {
  const { saves, saveProduct } = useStore()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [seg, setSeg] = useState<Segment>('foryou')
  const mode: Mode = pathname.startsWith('/shop') ? 'products' : 'looks'
  const setMode = (m: Mode) => nav(m === 'products' ? '/shop' : '/explore')
  const [savingProduct, setSavingProduct] = useState<Product | null>(null)

  const interests = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const s of saves) c[s.category] = (c[s.category] ?? 0) + 1
    return c
  }, [saves])

  const looks = useMemo(() => {
    let list = CATALOG
    if (seg === 'trending') list = list.filter((l) => l.trending)
    else if (seg !== 'foryou') list = list.filter((l) => l.category === seg)
    else list = [...list].sort((a, b) => (interests[b.category] ?? 0) - (interests[a.category] ?? 0))
    return list.map((l) => fromLook(l, saves))
  }, [seg, saves, interests])

  const products = useMemo(() => {
    const list = seg === 'foryou' || seg === 'trending' ? PRODUCTS : PRODUCTS.filter((p) => p.category === seg)
    return list
  }, [seg])

  return (
    <>
      <Header
        title={mode === 'products' ? 'Shop' : 'Explore'}
        right={
          <div className="mt-[4px] flex shrink-0 gap-[4px] rounded-full bg-surface p-[3px]">
            {(['looks', 'products'] as Mode[]).map((m) => (
              <Chip key={m} selected={mode === m} onClick={() => setMode(m)} className="h-[28px] px-[12px]">
                {m === 'looks' ? 'Looks' : 'Products'}
              </Chip>
            ))}
          </div>
        }
      />
      <div className="mb-sm sm:hidden">
        <ContextualSearch />
      </div>
      <CategoryFilter
        value={seg}
        onChange={setSeg}
        leading={[
          { value: 'foryou', label: 'For You' },
          { value: 'trending', label: 'Trending' },
        ]}
        className="mb-[28px]"
      />
      {mode === 'looks' ? (
        <DiscoveryGrid items={looks} revealKey={seg} />
      ) : (
        <>
          <p className="m-0 mb-xs type-meta text-muted-foreground">Products from these looks. Facts and formulation, then the retailer.</p>
          <div className="grid grid-cols-1 gap-x-2xl md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onSave={setSavingProduct} />
            ))}
          </div>
          <CollectionPicker
            open={savingProduct !== null}
            onClose={() => setSavingProduct(null)}
            current={savingProduct ? saves.find((s) => s.productId === savingProduct.id)?.collectionId : undefined}
            title="Save product to"
            onPick={async (collectionId) => {
              if (savingProduct) await saveProduct(savingProduct, collectionId)
            }}
          />
        </>
      )}
    </>
  )
}
