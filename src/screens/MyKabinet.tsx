import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router'
import { CategoryFilter } from '../components/CategoryFilter'
import { ContextualSearch } from '../components/ContextualSearch'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Field } from '../components/Field'
import { Header } from '../components/Header'
import { ImageView } from '../components/ImageView'
import { Sheet } from '../components/Sheet'
import { tone } from '../lib/catalog'
import { useStore } from '../lib/store'
import { CATEGORIES, type Category } from '../lib/types'

/** The shelf. What "use what you own" checks against before anything is recommended. */
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
  const [brand, setBrand] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [category, setCategory] = useState<Category>('Skin')
  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const o of owned) if (o.category) c[o.category] = (c[o.category] ?? 0) + 1
    return c
  }, [owned])
  const shelf = owned.filter((o) => cat === 'All' || o.category === cat)

  async function add() {
    if (!brand.trim() || !name.trim()) return
    await addOwned({ brand: brand.trim(), productName: name.trim(), category, role: role.trim() || undefined, image: tone('bone', 3, 4) })
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
        <p className="m-0 type-body-sm text-muted-foreground">Nothing on the shelf yet. Add what you use, or tap “Add to My Kabinet” on any product.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-[6px] gap-y-md sm:grid-cols-3 md:grid-cols-4 md:gap-x-[10px] xl:grid-cols-6">
          {shelf.map((o) => (
            <div key={o.id} className="group flex flex-col gap-xs">
              <div className="aspect-[3/4] overflow-hidden rounded-content bg-muted">{o.image ? <ImageView fill image={o.image} /> : null}</div>
              <div className="flex flex-col gap-[1px] px-[2px]">
                <span className="type-eyebrow text-muted-foreground">{o.brand}</span>
                <span className="type-body-sm font-medium text-foreground">{o.productName}</span>
                <span className="type-meta text-muted-foreground">{[o.category, o.productType ?? o.role].filter(Boolean).join(' · ')}</span>
                <button type="button" onClick={() => void removeOwned(o.id)} className="mt-[2px] w-fit type-meta text-muted-foreground hover:text-foreground">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} label="Add a product">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">My Kabinet</p>
            <h2 className="m-0 type-h2 text-foreground">Add what you own</h2>
          </div>
          <Field label="Brand" on="surface" placeholder="Aesop" value={brand} autoFocus onChange={(e) => setBrand(e.target.value)} />
          <Field label="Product" on="surface" placeholder="Parsley Seed Serum" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && void add()} />
          <div className="flex flex-col gap-sm">
            <p className="m-0 type-eyebrow text-muted-foreground">World</p>
            <div className="flex flex-wrap gap-xs">
              {CATEGORIES.map((c) => (
                <Chip key={c} on="surface" selected={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </div>
          </div>
          <Field label="Role in your routine (optional)" on="surface" placeholder="base, spf, treat, curl-cream…" value={role} onChange={(e) => setRole(e.target.value)} />
          <Button variant="primary" disabled={!brand.trim() || !name.trim()} onClick={() => void add()}>Add to my Kabinet</Button>
        </div>
      </Sheet>
    </>
  )
}
