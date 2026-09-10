import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryFilter } from '../components/CategoryFilter'
import { Header } from '../components/Header'
import { RoutineCard } from '../components/RoutineCard'
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

  return (
    <>
      <Header
        eyebrow={`${routines.length} ${routines.length === 1 ? 'routine' : 'routines'}`}
        title="Routines"
        sub="What you saved, turned into steps you can follow."
        right={
          <Link to="/routines/new" className="mt-[6px] shrink-0 type-body-sm font-medium text-foreground">+ New routine</Link>
        }
      />
      {routines.length > 0 && <CategoryFilter value={cat} onChange={setCat} leading={[{ value: 'All', label: 'All' }]} counts={counts} className="mb-[28px]" />}
      {list.length === 0 ? (
        <div className="flex flex-col gap-md lg:max-w-[520px]">
          <p className="m-0 type-body text-foreground">No routines yet.</p>
          <p className="m-0 type-body-sm text-muted-foreground">Open a saved tutorial and tap Create routine, or build one from scratch in a minute.</p>
          <Link to="/routines/new" className="inline-flex h-[38px] w-fit items-center rounded-full bg-primary px-[16px] type-body-sm font-medium text-primary-foreground">+ New routine</Link>
        </div>
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
