import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { CollectionPicker } from '../components/CollectionPicker'
import { CreateRoutineAction } from '../components/CreateRoutineAction'
import { BlobVideo } from '../components/ImageView'
import { SocialPlayer } from '../components/SocialPlayer'
import { sourceFromLook, sourceFromSave } from '../lib/routines/extract'
import { PLATFORM_LABEL } from '../lib/social/platform'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { Field } from '../components/Field'
import { ImageView } from '../components/ImageView'
import { ProductCard } from '../components/ProductCard'
import { CATALOG, findLook } from '../lib/catalog'
import { cx } from '../lib/cx'
import { fromLook, fromSave } from '../lib/feed'
import { useStore } from '../lib/store'
import type { Product } from '../lib/types'
import { formatDate, useUI } from '../lib/ui'

const PILL = 'inline-flex h-[38px] items-center rounded-full px-[16px] type-body-sm font-medium whitespace-nowrap transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98]'

/**
 * One look, immersive. The image leads; then what it is, what makes it, whether
 * it would work for you, and what you already own that gets you there.
 */
export default function Detail() {
  const { id = '' } = useParams()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const location = useLocation()
  const { saves, collections, updateSave, removeSave, saveLook, saveProduct } = useStore()
  const { markSettled } = useUI()

  const isLookRoute = pathname.startsWith('/look/')
  const save = isLookRoute ? saves.find((s) => s.lookId === id) : saves.find((s) => s.id === id)
  const look = isLookRoute ? findLook(id) : save?.lookId ? findLook(save.lookId) : undefined
  const item = save ?? look

  const [note, setNote] = useState(save?.note ?? '')
  const [picking, setPicking] = useState(false)
  const [savingProduct, setSavingProduct] = useState<Product | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setNote(save?.note ?? ''), [save?.id, save?.note])

  const related = useMemo(() => {
    if (!item) return []
    const pool = [...saves.filter((s) => s.id !== save?.id && s.category === item.category).map(fromSave), ...CATALOG.filter((l) => l.id !== look?.id && l.category === item.category && !saves.some((s) => s.lookId === l.id)).map((l) => fromLook(l, saves))]
    return pool.slice(0, 8)
  }, [item, saves, save?.id, look?.id])

  if (!item) return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from
  const back = () => nav(from ?? (isLookRoute ? '/explore' : '/'), { viewTransition: true })
  const collection = save?.collectionId ? collections.find((c) => c.id === save.collectionId) : undefined
  const title = item.title ?? save?.note ?? undefined
  const products = item.products ?? []
  const ratio = item.image.w / item.image.h
  const vtId = save?.id ?? look?.id ?? id

  async function pick(collectionId: string | null) {
    if (save) await updateSave(save.id, { collectionId })
    else if (look) {
      const s = await saveLook(look, collectionId)
      markSettled([s.id])
    }
  }
  async function remove() {
    if (!save) return
    await removeSave(save.id)
    back()
  }
  const scrollTo = (sel: string) => document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="pt-[12px]">
      <button type="button" onClick={back} aria-label="Back" className="type-h2 font-normal text-foreground max-sm:hidden">←</button>

      <div className="mt-sm lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-2xl">
        <div className="overflow-hidden rounded-content lg:justify-self-center" style={{ width: `min(100%, calc(86vh * ${ratio.toFixed(4)}))` }}>
          {save?.social ? (
            // Social saves are video: poster first, the platform's own player on tap.
            <SocialPlayer save={save} social={save.social} style={{ viewTransitionName: `s-${vtId}` }} />
          ) : item.image.kind === 'video' ? (
            <BlobVideo id={item.image.id} controls className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: `${item.image.w} / ${item.image.h}`, viewTransitionName: `s-${vtId}` }} />
          ) : (
            <ImageView image={item.image} alt={title ?? ''} priority style={{ viewTransitionName: `s-${vtId}` }} />
          )}
        </div>

        <aside className="mt-lg flex flex-col gap-xl lg:mt-0 lg:max-h-[calc(100dvh-88px)] lg:overflow-y-auto lg:pr-[4px]">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">
              {save?.social ? `${PLATFORM_LABEL[save.social.platform]} video` : item.category}
              {save?.social?.creatorName && (
                <>
                  {' · '}
                  {save.social.creatorUrl ? <a href={save.social.creatorUrl} target="_blank" rel="noreferrer" className="text-foreground">{save.social.creatorName}</a> : save.social.creatorName}
                </>
              )}
              {!save?.social && item.subcategory && ` · ${item.subcategory}`}
              {collection && (
                <>
                  {' · '}
                  <Link to={`/collections/${collection.id}`} className="text-foreground">{collection.title}</Link>
                </>
              )}
            </p>
            {title && <h1 className="m-0 type-title text-foreground">{title}</h1>}
            {item.description && <p className="m-0 type-body text-muted-foreground">{item.description}</p>}
            {save?.social?.caption && save.social.caption !== title && <p className="m-0 type-body-sm text-muted-foreground">{save.social.caption}</p>}
            {save?.social && !save.social.availableText && <p className="m-0 type-meta text-muted-foreground">{save.social.accessNote}</p>}
            {item.tags && item.tags.length > 0 && <p className="m-0 type-micro text-muted-foreground">{item.tags.join(' · ')}</p>}
            {save && (
              <p className="m-0 type-meta text-muted-foreground">
                Saved {formatDate(save.createdAt)}
                {save.source?.url && (
                  <>
                    {' · '}
                    <a href={save.source.url} target="_blank" rel="noreferrer" className="text-foreground">{save.social ? `Open on ${PLATFORM_LABEL[save.social.platform]} ↗` : 'Source ↗'}</a>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-[8px]">
            <button type="button" onClick={() => setPicking(true)} className={cx(PILL, save ? 'bg-surface text-foreground' : 'bg-primary text-primary-foreground')}>
              {save ? (collection ? `Saved · ${collection.title}` : 'Saved') : 'Save'}
            </button>
            <CreateRoutineAction source={save ? sourceFromSave(save) : sourceFromLook(look!)} save={save} />
            {products.length > 0 && (
              <button type="button" onClick={() => scrollTo('#products')} className={cx(PILL, 'bg-surface text-foreground')}>View products</button>
            )}
          </div>

          {products.length > 0 && (
            <section id="products" className="flex scroll-mt-[72px] flex-col">
              <p className="m-0 type-eyebrow text-muted-foreground">Products in this look · {products.length}</p>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onSave={setSavingProduct} />
              ))}
            </section>
          )}

          {item.steps && item.steps.length > 0 && (
            <section className="flex flex-col gap-xs">
              <p className="m-0 type-eyebrow text-muted-foreground">How it is done</p>
              <ol className="m-0 flex list-none flex-col gap-[6px] p-0">
                {item.steps.map((s, i) => (
                  <li key={i} className="flex gap-sm type-body-sm text-foreground">
                    <span className="type-eyebrow w-[18px] shrink-0 pt-[3px] text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {save && (
            <>
              <Field multiline label="Your note" placeholder="What do you like about this?" value={note} rows={2} onChange={(e) => setNote(e.target.value)} onBlur={() => note.trim() !== save.note && void updateSave(save.id, { note: note.trim() })} />
              <div>
                {!confirm ? (
                  <button type="button" onClick={() => setConfirm(true)} className="type-body-sm text-muted-foreground">Remove from your world</button>
                ) : (
                  <div className="flex items-center gap-lg">
                    <span className="type-body-sm text-muted-foreground">Remove this save?</span>
                    <button type="button" onClick={() => void remove()} className="type-body-sm font-medium text-accent-text">Remove</button>
                    <button type="button" onClick={() => setConfirm(false)} className="type-body-sm font-medium text-foreground">Keep</button>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-2xl flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">More in {item.category}</p>
          <DiscoveryGrid items={related} revealKey={vtId} />
        </section>
      )}

      <CollectionPicker open={picking} onClose={() => setPicking(false)} current={save ? save.collectionId : undefined} title={save ? 'Move to' : 'Save to'} onPick={pick} onRemove={save ? remove : undefined} />
      <CollectionPicker
        open={savingProduct !== null}
        onClose={() => setSavingProduct(null)}
        current={savingProduct ? saves.find((s) => s.productId === savingProduct.id)?.collectionId : undefined}
        title="Save product to"
        onPick={async (collectionId) => {
          if (!savingProduct) return
          const s = await saveProduct(savingProduct, collectionId)
          markSettled([s.id])
        }}
      />
    </div>
  )
}
