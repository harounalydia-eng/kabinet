import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { CollectionPicker } from '../components/CollectionPicker'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { ImageView } from '../components/ImageView'
import { price } from '../components/ProductCard'
import { PurchaseLink } from '../components/PurchaseLink'
import { findProduct, looksWith } from '../lib/catalog'
import { cx } from '../lib/cx'
import { fromLook } from '../lib/feed'
import { ingredientInfo, knownIngredients } from '../lib/ingredients'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'

const PILL = 'inline-flex h-[38px] items-center rounded-full px-[16px] type-body-sm font-medium whitespace-nowrap transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98]'

/**
 * Product detail: facts and formulation, educationally. What it is, what it is
 * designed to do, the ingredient list and what the key ingredients are commonly
 * used for. No verdicts about you — KABINET has no analysis to base one on yet.
 */
export default function ProductDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const location = useLocation()
  const { saves, collections, owned, saveProduct, updateSave, removeSave, addOwned, removeOwned } = useStore()
  const { markSettled } = useUI()
  const product = findProduct(id)
  const [picking, setPicking] = useState(false)
  const [allIngredients, setAllIngredients] = useState(false)

  const related = useMemo(() => (product ? looksWith(product.id).map((l) => fromLook(l, saves)) : []), [product, saves])
  if (!product) return <Navigate to="/explore" replace />

  const save = saves.find((s) => s.productId === product.id)
  const collection = save?.collectionId ? collections.find((c) => c.id === save.collectionId) : undefined
  const ownedEntry = owned.find((o) => o.productId === product.id)
  const key = knownIngredients(product.keyIngredients ?? [])
  const all = product.ingredients ?? []
  const from = (location.state as { from?: string } | null)?.from
  const back = () => nav(from ?? '/explore', { viewTransition: true })
  const facts = [product.category, product.productType, price(product), product.retailer].filter(Boolean).join(' · ')

  async function pick(collectionId: string | null) {
    if (save) await updateSave(save.id, { collectionId })
    else {
      const s = await saveProduct(product!, collectionId)
      markSettled([s.id])
    }
  }
  async function toggleOwned() {
    if (ownedEntry) await removeOwned(ownedEntry.id)
    else await addOwned({ brand: product!.brand, productName: product!.productName, category: product!.category, productType: product!.productType, role: product!.role, image: product!.image, productId: product!.id })
  }

  return (
    <div className="pt-[12px]">
      <button type="button" onClick={back} aria-label="Back" className="type-h2 font-normal text-foreground max-sm:hidden">←</button>

      <div className="mt-sm lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-2xl">
        <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-content bg-muted lg:sticky lg:top-[72px]">
          {product.image ? <ImageView image={product.image} alt={`${product.brand} ${product.productName}`} priority style={{ viewTransitionName: `p-${product.id}` }} /> : <div className="aspect-[3/4]" />}
        </div>

        <aside className="mt-lg flex flex-col gap-xl lg:mt-0">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">{product.brand}</p>
            <h1 className="m-0 type-title text-foreground">{product.productName}</h1>
            <p className="m-0 type-meta text-muted-foreground">{facts}</p>
            {product.description && <p className="m-0 type-body text-muted-foreground">{product.description}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-[8px]">
            <button type="button" onClick={() => setPicking(true)} className={cx(PILL, save ? 'bg-surface text-foreground' : 'bg-primary text-primary-foreground')}>
              {save ? (collection ? `Saved · ${collection.title}` : 'Saved') : 'Save'}
            </button>
            <button type="button" onClick={() => void toggleOwned()} className={cx(PILL, 'bg-surface text-foreground')}>
              {ownedEntry ? 'In your Kabinet ✓' : 'Add to My Kabinet'}
            </button>
            <PurchaseLink product={product} className="type-body-sm text-muted-foreground hover:text-foreground" />
          </div>

          {(product.whatItIs || product.designedTo) && (
            <section className="flex flex-col gap-sm">
              {product.whatItIs && (
                <div className="flex flex-col gap-[2px]">
                  <p className="m-0 type-eyebrow text-muted-foreground">What it is</p>
                  <p className="m-0 type-body text-foreground">{product.whatItIs}</p>
                </div>
              )}
              {product.designedTo && (
                <div className="flex flex-col gap-[2px]">
                  <p className="m-0 type-eyebrow text-muted-foreground">Designed to</p>
                  <p className="m-0 type-body text-foreground">{product.designedTo}</p>
                </div>
              )}
            </section>
          )}

          {key.length > 0 && (
            <section className="flex flex-col gap-sm">
              <p className="m-0 type-eyebrow text-muted-foreground">Key ingredients</p>
              <div className="flex flex-col gap-sm">
                {key.map((k) => (
                  <div key={k.name} className="flex flex-col gap-[2px]">
                    <span className="type-body-sm font-medium text-foreground">
                      {k.name} <span className="type-micro text-muted-foreground">· {k.family}</span>
                    </span>
                    <span className="type-body-sm text-muted-foreground">{k.function}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {all.length > 0 && (
            <section className="flex flex-col gap-sm">
              <div className="flex items-baseline justify-between">
                <p className="m-0 type-eyebrow text-muted-foreground">Ingredients · {all.length}</p>
                <button type="button" onClick={() => setAllIngredients((v) => !v)} className="type-body-sm font-medium text-foreground">
                  {allIngredients ? 'Hide' : 'View all ingredients →'}
                </button>
              </div>
              {allIngredients ? (
                <ol className="m-0 flex list-none flex-col gap-[6px] p-0">
                  {all.map((n) => {
                    const info = ingredientInfo(n)
                    return (
                      <li key={n} className="flex flex-col gap-[1px]">
                        <span className="type-body-sm text-foreground">
                          {info.name} {info.family !== '—' && <span className="type-micro text-muted-foreground">· {info.family}</span>}
                        </span>
                        <span className="type-meta text-muted-foreground">{info.function}</span>
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="m-0 type-body-sm text-muted-foreground">{all.join(', ')}</p>
              )}
              <p className="m-0 type-meta text-muted-foreground">Ingredient notes describe what an ingredient is commonly used for in a formula. They are not advice about your skin or hair.</p>
            </section>
          )}

          {product.considerations && product.considerations.length > 0 && (
            <section className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Formulation notes</p>
              <ul className="m-0 flex list-none flex-col gap-[4px] p-0">
                {product.considerations.map((c) => (
                  <li key={c} className="type-body-sm text-foreground">{c}</li>
                ))}
              </ul>
            </section>
          )}

          {save && (
            <button type="button" onClick={() => void removeSave(save.id)} className="w-fit type-body-sm text-muted-foreground">Remove from your world</button>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-2xl flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">Looks with this product</p>
          <DiscoveryGrid items={related} revealKey={product.id} />
        </section>
      )}

      <CollectionPicker open={picking} onClose={() => setPicking(false)} current={save ? save.collectionId : undefined} title={save ? 'Move to' : 'Save to'} onPick={pick} onRemove={save ? () => removeSave(save.id) : undefined} />
    </div>
  )
}
