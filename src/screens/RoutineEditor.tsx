import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../components/Button'
import { Chip } from '../components/Chip'
import { Field } from '../components/Field'
import { ImageView } from '../components/ImageView'
import { Sheet } from '../components/Sheet'
import { PRODUCTS } from '../lib/catalog'
import { cx } from '../lib/cx'
import { emptyRoutine, newStep, type ExtractionSource } from '../lib/routines/extract'
import { useStore } from '../lib/store'
import { ROUTINE_CATEGORIES, type Routine, type RoutineStep } from '../lib/types'
import { PLATFORM_LABEL, type SocialPlatform } from '../lib/social/platform'

/**
 * Manual builder, editor, and the review step for drafts — one screen.
 * Every step can be edited, reordered, deleted; products can be picked, typed, or skipped.
 */
export default function RoutineEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const nav = useNavigate()
  const { routines, putRoutine, addOwned, owned } = useStore()
  const existing = id ? routines.find((r) => r.id === id) : undefined
  const reviewing = params.get('review') === '1' && existing?.analysisStatus === 'draft'
  const from = (location.state as { from?: ExtractionSource } | null)?.from

  const [draft, setDraft] = useState<Routine>(() =>
    existing ??
    emptyRoutine(
      from
        ? { title: from.title ?? '', category: from.category, description: from.description, sourceType: from.type, sourceMediaId: from.id, sourceThumbnail: from.image, sourceUrl: from.url }
        : {},
    ),
  )
  useEffect(() => {
    if (existing) setDraft(existing)
  }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [productFor, setProductFor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [manualBrand, setManualBrand] = useState('')
  const [manualName, setManualName] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? PRODUCTS.filter((p) => `${p.brand} ${p.productName} ${p.productType ?? ''}`.toLowerCase().includes(q)).slice(0, 8) : PRODUCTS.slice(0, 8)
  }, [query])

  const patch = (p: Partial<Routine>) => setDraft((d) => ({ ...d, ...p }))
  const patchStep = (sid: string, p: Partial<RoutineStep>) => setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.id === sid ? { ...s, ...p } : s)) }))
  const renumber = (steps: RoutineStep[]) => steps.map((s, i) => ({ ...s, order: i + 1 }))
  const addStep = () => setDraft((d) => ({ ...d, steps: [...d.steps, newStep(d.steps.length + 1)] }))
  const removeStep = (sid: string) => setDraft((d) => ({ ...d, steps: renumber(d.steps.filter((s) => s.id !== sid)) }))
  const move = (sid: string, dir: -1 | 1) =>
    setDraft((d) => {
      const i = d.steps.findIndex((s) => s.id === sid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.steps.length) return d
      const steps = [...d.steps]
      ;[steps[i], steps[j]] = [steps[j], steps[i]]
      return { ...d, steps: renumber(steps) }
    })

  async function save() {
    const cleaned: Routine = {
      ...draft,
      title: draft.title.trim() || 'Untitled routine',
      steps: renumber(draft.steps.filter((s) => s.title.trim() || s.description?.trim())),
      analysisStatus: draft.analysisStatus === 'draft' ? 'ready' : draft.analysisStatus,
      updatedAt: Date.now(),
    }
    await putRoutine(cleaned)
    nav(`/routines/${cleaned.id}`, { replace: true })
  }

  const canSave = draft.title.trim().length > 0 || draft.steps.some((s) => s.title.trim())

  return (
    <div className="pt-[12px] lg:max-w-[720px]">
      <button type="button" onClick={() => nav(-1)} aria-label="Back" className="type-h2 font-normal text-foreground">←</button>

      <div className="mt-sm flex flex-col gap-xl">
        <div className="flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">{reviewing ? 'Review your routine' : existing ? 'Edit routine' : 'New routine'}</p>
          <h1 className="m-0 type-title text-foreground">{reviewing ? 'Check the steps before saving' : existing ? draft.title || 'Untitled routine' : 'Build a routine'}</h1>
          {reviewing && (
            <p className="m-0 type-meta text-muted-foreground">
              {draft.steps.length} {draft.steps.length === 1 ? 'step' : 'steps'} · {draft.steps.filter((s) => s.productName || s.productBrand).length} products
            </p>
          )}
          {reviewing && (
            <p className="m-0 type-body-sm text-muted-foreground">
              {draft.sourceType in PLATFORM_LABEL
                ? `KABINET created this from the ${PLATFORM_LABEL[draft.sourceType as SocialPlatform]} tutorial. Correct anything that is off; products it could not name are marked unclear.`
                : 'KABINET created a draft from this content. Products marked “to confirm” are the look’s listed products matched to a step — confirm, change or skip them.'}
            </p>
          )}
        </div>

        {draft.sourceThumbnail && (
          <div className="flex items-center gap-md">
            <div className="w-[56px] shrink-0 overflow-hidden rounded-content bg-muted"><ImageView image={draft.sourceThumbnail} /></div>
            <span className="type-meta text-muted-foreground">Created from {draft.sourceType in PLATFORM_LABEL ? PLATFORM_LABEL[draft.sourceType as SocialPlatform] : 'saved inspiration'}</span>
          </div>
        )}

        <Field label="Routine title" placeholder="e.g. Defined curl wash day" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />

        <div className="flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">Category</p>
          <div className="flex flex-wrap gap-xs">
            {ROUTINE_CATEGORIES.map((c) => (
              <Chip key={c} selected={draft.category === c} onClick={() => patch({ category: c })}>{c}</Chip>
            ))}
          </div>
        </div>

        <Field multiline label="Notes (optional)" placeholder="When you do it, what to watch for." value={draft.description ?? ''} rows={2} onChange={(e) => patch({ description: e.target.value })} />

        <section className="flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">Steps</p>
          {draft.steps.length === 0 && <p className="m-0 type-body-sm text-muted-foreground">Add the first step. Cleanse, condition, apply, diffuse — in the order you do them.</p>}
          <ol className="m-0 flex list-none flex-col p-0">
            {draft.steps.map((st, i) => (
              <li key={st.id} className="flex gap-sm border-t border-border py-md">
                <div className="flex shrink-0 flex-col items-center gap-[2px] pt-[2px]">
                  <span className="type-eyebrow text-muted-foreground">{String(st.order).padStart(2, '0')}</span>
                  <button type="button" onClick={() => move(st.id, -1)} disabled={i === 0} aria-label="Move up" className="type-meta text-muted-foreground disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => move(st.id, 1)} disabled={i === draft.steps.length - 1} aria-label="Move down" className="type-meta text-muted-foreground disabled:opacity-30">↓</button>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-xs">
                  <Field placeholder="Step, e.g. Cleanse scalp" value={st.title} onChange={(e) => patchStep(st.id, { title: e.target.value })} />
                  <Field placeholder="How, e.g. rake through, then scrunch" value={st.description ?? ''} onChange={(e) => patchStep(st.id, { description: e.target.value })} />
                  <div className="grid grid-cols-2 gap-xs">
                    <Field placeholder="Technique" value={st.technique ?? ''} onChange={(e) => patchStep(st.id, { technique: e.target.value })} />
                    <Field placeholder="Timing, if stated" value={st.duration ?? ''} onChange={(e) => patchStep(st.id, { duration: e.target.value })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-md gap-y-[4px]">
                    {st.productName ? (
                      <span className="type-body-sm text-foreground">
                        {[st.productBrand, st.productName].filter(Boolean).join(' · ')}
                        {st.productConfidence === 'possible' && <span className="type-micro text-muted-foreground"> · to confirm</span>}
                        {st.productId && owned.some((o) => o.productId === st.productId) && <span className="type-meta text-foreground"> · In your Kabinet ✓</span>}
                      </span>
                    ) : (
                      <span className="type-meta text-muted-foreground">{st.productConfidence === 'unclear' ? 'Product unclear' : 'No product'}</span>
                    )}
                    {st.productName && st.productConfidence === 'possible' && (
                      <button type="button" onClick={() => patchStep(st.id, { productConfidence: 'identified' })} className="type-body-sm font-medium text-foreground">Confirm</button>
                    )}
                    <button type="button" onClick={() => { setProductFor(st.id); setQuery(''); setManualBrand(''); setManualName('') }} className="type-body-sm font-medium text-foreground">
                      {st.productName ? 'Change product' : 'Identify product'}
                    </button>
                    {st.productName && (
                      <button type="button" onClick={() => patchStep(st.id, { productId: undefined, productName: undefined, productBrand: undefined, productConfidence: undefined })} className="type-body-sm text-muted-foreground">Skip product</button>
                    )}
                    <button type="button" onClick={() => removeStep(st.id)} className="ml-auto type-body-sm text-muted-foreground">Delete step</button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={addStep} className="w-fit type-body-sm font-medium text-foreground">+ Add step</button>
        </section>

        <div className="flex flex-wrap gap-xs">
          <Button variant="primary" disabled={!canSave} onClick={() => void save()} className="sm:w-fit sm:px-[24px]">
            {reviewing ? 'Save routine' : existing ? 'Save changes' : 'Save routine'}
          </Button>
          <Button variant="ghost" onClick={() => nav(-1)} className="sm:w-fit sm:px-[16px]">Cancel</Button>
        </div>
      </div>

      <Sheet open={productFor !== null} onClose={() => setProductFor(null)} label="Identify product">
        <div className="flex flex-col gap-lg">
          <div className="flex flex-col gap-[6px]">
            <p className="m-0 type-eyebrow text-muted-foreground">Step {draft.steps.find((s) => s.id === productFor)?.order ?? ''}</p>
            <h2 className="m-0 type-h2 text-foreground">Which product?</h2>
          </div>
          <Field on="surface" placeholder="Search products" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-col">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  patchStep(productFor!, { productId: p.id, productBrand: p.brand, productName: p.productName, productConfidence: 'identified' })
                  setProductFor(null)
                }}
                className="flex items-center justify-between rounded-tile-sm px-sm py-[10px] text-left transition-colors duration-(--motion-fast) hover:bg-background"
              >
                <span className="flex flex-col">
                  <span className="type-eyebrow text-muted-foreground">{p.brand}</span>
                  <span className="type-body text-foreground">{p.productName}</span>
                </span>
                <span className="type-meta text-muted-foreground">{p.productType}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-sm">
            <p className="m-0 type-eyebrow text-muted-foreground">Or enter it</p>
            <div className="grid grid-cols-2 gap-xs">
              <Field on="surface" placeholder="Brand" value={manualBrand} onChange={(e) => setManualBrand(e.target.value)} />
              <Field on="surface" placeholder="Product" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            </div>
            <div className="flex gap-lg">
              <button
                type="button"
                disabled={!manualName.trim()}
                onClick={async () => {
                  patchStep(productFor!, { productId: undefined, productBrand: manualBrand.trim() || undefined, productName: manualName.trim(), productConfidence: 'identified' })
                  setProductFor(null)
                }}
                className={cx('type-body-sm font-medium text-foreground disabled:opacity-40')}
              >
                Use this
              </button>
              <button
                type="button"
                disabled={!manualName.trim()}
                onClick={async () => {
                  const o = await addOwned({ brand: manualBrand.trim() || '—', productName: manualName.trim(), category: draft.category })
                  patchStep(productFor!, { productId: o.productId, productBrand: o.brand, productName: o.productName, productConfidence: 'identified' })
                  setProductFor(null)
                }}
                className="type-body-sm text-muted-foreground disabled:opacity-40"
              >
                Use and add to My Kabinet
              </button>
              <button type="button" onClick={() => { patchStep(productFor!, { productId: undefined, productName: undefined, productBrand: undefined, productConfidence: undefined }); setProductFor(null) }} className="type-body-sm text-muted-foreground">Skip</button>
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
