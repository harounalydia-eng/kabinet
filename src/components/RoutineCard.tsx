import { Link } from 'react-router'
import { ImageView } from './ImageView'
import type { Routine } from '../lib/types'

/** A routine in the library: its source imagery, then title, world, steps and products. */
export function RoutineCard({ routine }: { routine: Routine }) {
  const products = routine.steps.filter((s) => s.productName || s.productId).length
  return (
    <Link to={`/routines/${routine.id}`} viewTransition className="group flex flex-col gap-sm">
      <div className="aspect-[4/5] overflow-hidden rounded-content bg-muted transition-transform duration-(--motion-fast) ease-soft active:scale-[0.985]">
        {routine.sourceThumbnail ? (
          <ImageView fill image={routine.sourceThumbnail} className="transition-transform duration-(--motion-page) ease-soft group-hover:scale-[1.025]" />
        ) : (
          <div className="flex h-full flex-col justify-end p-md">
            <span className="type-eyebrow text-muted-foreground">{routine.category}</span>
            <span className="type-h3 text-foreground">{routine.steps.length} steps</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[2px] px-[2px]">
        <p className="m-0 type-h3 text-foreground">{routine.title || 'Untitled routine'}</p>
        <p className="m-0 type-meta text-muted-foreground">
          {routine.category} · {routine.steps.length} {routine.steps.length === 1 ? 'step' : 'steps'}
          {products > 0 && ` · ${products} ${products === 1 ? 'product' : 'products'}`}
          {routine.analysisStatus === 'draft' && ' · Draft'}
        </p>
      </div>
    </Link>
  )
}
