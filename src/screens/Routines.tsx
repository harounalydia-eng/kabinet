import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryFilter } from '../components/CategoryFilter'
import { Header } from '../components/Header'
import { RoutineCard } from '../components/RoutineCard'
import { ImageView } from '../components/ImageView'
import { importAvailable, listSavedRoutines, PLATFORM_NAME, type SavedRoutineSummary } from '../lib/routines/importApi'
import { useStore } from '../lib/store'
import type { Category } from '../lib/types'

/** The routines library. Visual and editorial: source imagery leads each routine. */
export default function Routines() {
  const { routines } = useStore()
  const [cat, setCat] = useState<Category | 'All'>('All')
  const counts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {}
    for (const r of routines) c[r.category] = (c[r.category] ?? 0) + 1
    return c
  }, [routines])
  const list = useMemo(() => [...routines].filter((r) => cat === 'All' || r.category === cat).sort((a, b) => b.updatedAt - a.updatedAt), [routines, cat])
  const [imported, setImported] = useState<SavedRoutineSummary[]>([])
  useEffect(() => {
    if (!importAvailable()) return
    void listSavedRoutines().then(setImported).catch(() => setImported([]))
  }, [])
  const total = routines.length + imported.length

  return (
    <>
      <Header
        eyebrow={`${total} ${total === 1 ? 'routine' : 'routines'}`}
        title="Routines"
        sub="What you saved, turned into steps you can follow."
        right={
          <div className="mt-[6px] flex shrink-0 gap-md">
            {importAvailable() && <Link to="/routines/import" className="type-body-sm font-medium text-foreground">+ From a link</Link>}
            <Link to="/routines/new" className="type-body-sm font-medium text-foreground">+ New</Link>
          </div>
        }
      />
      {imported.length > 0 && (
        <section className="mb-xl flex flex-col gap-sm">
          <p className="m-0 type-eyebrow text-muted-foreground">From creators · {imported.length}</p>
          <div className="grid grid-cols-2 gap-x-[6px] gap-y-lg md:grid-cols-3 md:gap-x-[10px] xl:grid-cols-5">
            {imported.map(({ routine, import: imp, productCount, stepCount }) => (
              <Link key={routine.id} to={`/routines/r/${routine.id}`} className="group flex flex-col gap-sm">
                <div className="aspect-[4/5] overflow-hidden rounded-content bg-muted">
                  {imp?.thumbnail_url ? <ImageView fill image={{ kind: 'url', url: imp.thumbnail_url, w: imp.thumbnail_w ?? 4, h: imp.thumbnail_h ?? 5 }} className="transition-transform duration-(--motion-page) ease-soft group-hover:scale-[1.025]" /> : <div className="flex h-full flex-col justify-end p-md"><span className="type-h3 text-foreground">{stepCount} steps</span></div>}
                </div>
                <div className="flex flex-col gap-[2px] px-[2px]">
                  <p className="m-0 type-h3 text-foreground">{routine.title}</p>
                  <p className="m-0 type-meta text-muted-foreground">{[imp?.creator_handle ?? imp?.creator_name, imp ? PLATFORM_NAME[imp.platform] : null, `${productCount} ${productCount === 1 ? 'product' : 'products'}`].filter(Boolean).join(' · ')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {routines.length > 0 && <CategoryFilter value={cat} onChange={setCat} leading={[{ value: 'All', label: 'All' }]} counts={counts} className="mb-[28px]" />}
      {list.length === 0 ? (
        imported.length > 0 ? null : (
        <div className="flex flex-col gap-md lg:max-w-[520px]">
          <p className="m-0 type-body text-foreground">No routines yet.</p>
          <p className="m-0 type-body-sm text-muted-foreground">Paste a TikTok, YouTube or Instagram link and KABINET turns it into products and steps — or build one from scratch.</p>
          <div className="flex flex-wrap gap-[8px]">
            {importAvailable() && <Link to="/routines/import" className="inline-flex h-[38px] w-fit items-center rounded-full bg-primary px-[16px] type-body-sm font-medium text-primary-foreground">Import from a link</Link>}
            <Link to="/routines/new" className="inline-flex h-[38px] w-fit items-center rounded-full bg-surface px-[16px] type-body-sm font-medium text-foreground">+ New routine</Link>
          </div>
        </div>
        )
      ) : (
        <div className="grid grid-cols-2 gap-x-[6px] gap-y-lg md:grid-cols-3 md:gap-x-[10px] xl:grid-cols-5">
          {list.map((r) => (
            <RoutineCard key={r.id} routine={r} />
          ))}
        </div>
      )}
    </>
  )
}
