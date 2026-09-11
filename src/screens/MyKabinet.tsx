import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { CategoryFilter } from '../components/CategoryFilter'
import { Chip } from '../components/Chip'
import { ContextualSearch } from '../components/ContextualSearch'
import { Field } from '../components/Field'
import { Header } from '../components/Header'
import { ProductImage } from '../components/ProductImage'
import { Sheet } from '../components/Sheet'
import { tone } from '../lib/catalog'
import { findCatalogProduct } from '../lib/catalogProducts'
import { accountsAvailable } from '../lib/supabase'
import { useStore } from '../lib/store'
import { CATEGORIES, type Category, type OwnedProduct } from '../lib/types'
import { preloadCatalogProducts } from '../lib/useCatalogProduct'

/** The shelf, as a shelf: what you own, recognisable at a glance. */
export default function MyKabinet() {
  const { owned, addOwned, removeOwned } = useStore()
  const [params, setParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [cat, setCat] = useState<Category | 'All'>('All')
  useEffect(() => {
    if (params.get('add') === '1') {
      setAdding(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])
  useEffect(() => {
    void preloadCatalogProducts(owned.map((o) => o.catalogProductId))
  }, [owned])
  const [brand, setBrand] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [category, setCategory] = useState<Category>('Skin')
  const [looking, setLooking] = useState(false)
  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const o of owned) if (o.category) c[o.category] = (c[o.category] ?? 0) + 1
    return c
  }, [owned])
  const shelf = owned.filter((o) => cat === 'All' || o.category === cat)

  async function add() {
    if (!brand.trim() || !name.trim() || looking) return
    setLooking(true)
    // Find what this product IS, so the shelf shows its photograph. No match → the tone tile, honestly.
    const match = accountsAvailable ? await findCatalogProduct(brand.trim(), name.trim()) : null
    setLooking(false)
    await addOwned({ brand: brand.trim(), productName: name.trim(), category, role: role.trim() || undefined, image: tone('bone', 3, 4), catalogProductId: match?.id })
    setAdding(false)
    setBrand('')
    setName('')
    setRole('')
  }

  return (
    <>
      <Header
        eyebrow={`Your shelf · ${owned.length} ${owned.length === 1 ? 'product' : 'products'}`}
        title="My Kabinet"
        right={
          <button type="button" onClick={() => setAdding(true)} className="mt-[6px] shrink-0 type-body-sm font-medium text-foreground">+ Add</button>
        }
      />
      <div className="mb-md flex flex-col gap-sm sm:hidden">
        <ContextualSearch />
      </div>
      {owned.length > 0 && <CategoryFilter value={cat} onChange={setCat} leading={[{ value: 'All', label: 'All' }]} counts={counts} className="mb-md" />}
      {owned.length === 0 ? (
        <p className="m-0 type-body-sm text-muted-foreground">Nothing on the shelf yet. Add what you use, or tap “Add to Kabinet” on any product.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-lg sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {shelf.map((o) => (
            <ShelfTile key={o.id} product={o} onRemove={() => void removeOwned(o.id)} />
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} label="Add a product">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">My Kabinet</p>
            <h2 className="m-0 type-h2 text-foreground">Add what you own</h2>
          </div>
          <Field label="Brand" on="surface" placeholder="CeraVe" value={brand} autoFocus onChange={(e) => setBrand(e.target.value)} />
          <Field label="Product" on="surface" placeholder="Hydrating Cleanser" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void add()} />
          <div className="flex flex-col gap-sm">
            <p className="m-0 type-eyebrow text-muted-foreground">World</p>
            <div className="flex flex-wrap gap-xs">
              {CATEGORIES.map((c) => (
                <Chip key={c} on="surface" selected={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </div>
          </div>
          <Field label="Role in your routine (optional)" on="surface" placeholder="base, spf, treat, curl-cream…" value={role} onChange={(e) => setRole(e.target.value)} />
          {looking && <p className="m-0 type-meta text-muted-foreground" aria-live="polite">Looking for its photograph…</p>}
          <Button variant="primary" disabled={!brand.trim() || !name.trim() || looking} onClick={() => void add()}>Add to my Kabinet</Button>
        </div>
      </Sheet>
    </>
  )
}

/** One product on the shelf: the packshot, then the two lines that identify it, then one useful fact. */
function ShelfTile({ product: o, onRemove }: { product: OwnedProduct; onRemove: () => void }) {
  const fact = o.role ?? o.productType ?? o.category
  return (
    <div className="group flex flex-col gap-[8px]">
      <div className="overflow-hidden rounded-content bg-muted">
        <ProductImage catalogProductId={o.catalogProductId} fallback={o.image} alt={`${o.brand} ${o.productName}`} ratio="3/4" />
      </div>
      <div className="flex flex-col gap-[2px] px-[2px]">
        <span className="type-eyebrow text-muted-foreground">{o.brand}</span>
        <span className="type-body-sm font-medium leading-snug text-foreground">{o.productName}</span>
        {fact && <span className="type-meta text-muted-foreground">{fact}</span>}
        <button type="button" onClick={onRemove} className="mt-[2px] w-fit type-micro text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100">Remove</button>
      </div>
    </div>
  )
}
