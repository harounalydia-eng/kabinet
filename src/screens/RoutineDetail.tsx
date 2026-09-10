import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { CollectionPicker } from '../components/CollectionPicker'
import { ImageView } from '../components/ImageView'
import { findProduct } from '../lib/catalog'
import { cx } from '../lib/cx'
import { useStore } from '../lib/store'
import { formatDate } from '../lib/ui'
import { PLATFORM_LABEL, type SocialPlatform } from '../lib/social/platform'

const PILL = 'inline-flex h-[38px] items-center rounded-full px-[16px] type-body-sm font-medium whitespace-nowrap transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98]'

/** A routine's own page: source, steps, products, and the way in to following it. */
export default function RoutineDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { routines, saves, owned, putRoutine, removeRoutine, saveLook } = useStore()
  const routine = routines.find((r) => r.id === id)
  const [confirm, setConfirm] = useState(false)
  const [picking, setPicking] = useState(false)
  if (!routine) return <Navigate to="/routines" replace />

  const products = routine.steps.filter((s) => s.productName || s.productId)
  const sourceSave = routine.sourceMediaId ? saves.find((s) => s.id === routine.sourceMediaId || s.lookId === routine.sourceMediaId) : undefined
  const sourceHref = sourceSave ? `/s/${sourceSave.id}` : routine.sourceType === 'look' && routine.sourceMediaId ? `/look/${routine.sourceMediaId}` : routine.sourceUrl

  async function duplicate() {
    const now = Date.now()
    const copy = { ...routine!, id: crypto.randomUUID(), title: `${routine!.title} (copy)`, createdAt: now, updatedAt: now, analysisStatus: 'manual' as const }
    await putRoutine(copy)
    nav(`/routines/${copy.id}`)
  }
  async function remove() {
    await removeRoutine(routine!.id)
    nav('/routines', { replace: true })
  }

  return (
    <div className="pt-[12px]">
      <button type="button" onClick={() => nav(-1)} aria-label="Back" className="type-h2 font-normal text-foreground">←</button>

      <div className="mt-sm lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-2xl">
        <div className="flex flex-col gap-md">
          {routine.sourceThumbnail && (
            <div className="overflow-hidden rounded-content bg-muted">
              <ImageView image={routine.sourceThumbnail} alt="" priority style={{ viewTransitionName: `s-${routine.sourceMediaId ?? routine.id}` }} />
            </div>
          )}
          {routine.sourceType !== 'manual' && (
            <div className="flex flex-col gap-[2px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Created from</p>
              <p className="m-0 type-body-sm text-foreground">
                {routine.sourceType in PLATFORM_LABEL ? PLATFORM_LABEL[routine.sourceType as SocialPlatform] : 'Saved inspiration'}
                {routine.sourceCreator && ` · ${routine.sourceCreator}`}
              </p>
              {routine.sourceTitle && <p className="m-0 type-meta text-muted-foreground">{routine.sourceTitle}</p>}
              {sourceHref && (
                sourceHref.startsWith('http') ? (
                  <a href={sourceHref} target="_blank" rel="noreferrer" className="type-body-sm font-medium text-foreground">View original ↗</a>
                ) : (
                  <Link to={sourceHref} className="type-body-sm font-medium text-foreground">View original →</Link>
                )
              )}
            </div>
          )}
        </div>

        <div className="mt-lg flex flex-col gap-xl lg:mt-0">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">{routine.category}{routine.analysisStatus === 'draft' && ' · Draft'}</p>
            <h1 className="m-0 type-title text-foreground">{routine.title || 'Untitled routine'}</h1>
            <p className="m-0 type-meta text-muted-foreground">
              {routine.steps.length} {routine.steps.length === 1 ? 'step' : 'steps'}{products.length > 0 && ` · ${products.length} ${products.length === 1 ? 'product' : 'products'}`} · Updated {formatDate(routine.updatedAt)}
            </p>
            {routine.description && <p className="m-0 type-body text-muted-foreground">{routine.description}</p>}
          </div>

          <div className="flex flex-wrap gap-[8px]">
            <Link to={`/routines/${routine.id}/start`} className={cx(PILL, 'bg-primary text-primary-foreground')}>Start routine</Link>
            <Link to={`/routines/${routine.id}/edit`} className={cx(PILL, 'bg-surface text-foreground')}>Edit</Link>
            <button type="button" onClick={() => void duplicate()} className={cx(PILL, 'bg-surface text-foreground')}>Duplicate</button>
          </div>

          <section className="flex flex-col">
            <p className="m-0 mb-xs type-eyebrow text-muted-foreground">Steps</p>
            <ol className="m-0 flex list-none flex-col p-0">
              {routine.steps.map((st) => {
                const product = st.productId ? findProduct(st.productId) : undefined
                const inKabinet = st.productId ? owned.some((o) => o.productId === st.productId) : false
                return (
                  <li key={st.id} className="flex gap-md border-t border-border py-md">
                    <span className="type-eyebrow w-[22px] shrink-0 pt-[4px] text-muted-foreground">{String(st.order).padStart(2, '0')}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                      <span className="type-h3 text-foreground">{st.title || 'Untitled step'}</span>
                      {st.description && st.description !== st.title && <span className="type-body-sm text-muted-foreground">{st.description}</span>}
                      {(st.technique || st.duration) && (
                        <span className="type-meta text-muted-foreground">{[st.technique, st.duration].filter(Boolean).join(' · ')}</span>
                      )}
                      {(st.productName || st.productBrand) ? (
                        <div className="mt-[2px] flex flex-wrap items-center gap-x-md gap-y-[2px]">
                          <span className="type-body-sm text-foreground">
                            {[st.productBrand, st.productName].filter(Boolean).join(' · ')}
                            {st.productConfidence === 'possible' && <span className="type-micro text-muted-foreground"> · to confirm</span>}
                          </span>
                          {inKabinet && <span className="type-meta text-foreground">In your Kabinet ✓</span>}
                          {product && <Link to={`/product/${product.id}`} className="type-body-sm font-medium text-foreground">View product</Link>}
                        </div>
                      ) : st.productConfidence === 'unclear' ? (
                        <span className="type-meta text-muted-foreground">Product not identified</span>
                      ) : null}
                      {st.notes && <span className="type-meta text-muted-foreground">{st.notes}</span>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <div className="flex flex-wrap items-center gap-lg">
            {sourceSave && (
              <button type="button" onClick={() => setPicking(true)} className="type-body-sm text-muted-foreground">Add source to collection</button>
            )}
            {!confirm ? (
              <button type="button" onClick={() => setConfirm(true)} className="type-body-sm text-muted-foreground">Delete routine</button>
            ) : (
              <div className="flex items-center gap-lg">
                <span className="type-body-sm text-muted-foreground">Delete this routine?</span>
                <button type="button" onClick={() => void remove()} className="type-body-sm font-medium text-accent-text">Delete</button>
                <button type="button" onClick={() => setConfirm(false)} className="type-body-sm font-medium text-foreground">Keep</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {sourceSave && (
        <CollectionPicker open={picking} onClose={() => setPicking(false)} current={sourceSave.collectionId} title="Move to" onPick={async (c) => { if (sourceSave.lookId) await saveLook({ id: sourceSave.lookId, category: sourceSave.category, image: sourceSave.image }, c) }} />
      )}
    </div>
  )
}
