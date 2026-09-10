import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { Button } from '../components/Button'
import { findProduct } from '../lib/catalog'
import { useStore } from '../lib/store'

/** Focused step-by-step mode. Entirely from stored routine data — no AI, no network. */
export default function RoutineRun() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { routines } = useStore()
  const routine = routines.find((r) => r.id === id)
  const [i, setI] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, (routine?.steps.length ?? 1) - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
      if (e.key === 'Escape') nav(`/routines/${id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [routine, id, nav])

  if (!routine) return <Navigate to="/routines" replace />
  if (routine.steps.length === 0) return <Navigate to={`/routines/${id}/edit`} replace />
  const st = routine.steps[i]
  const last = i === routine.steps.length - 1
  const product = st.productId ? findProduct(st.productId) : undefined

  return (
    <div className="flex min-h-[calc(100dvh-160px)] flex-col pt-[12px] lg:min-h-[calc(100dvh-140px)] lg:max-w-[640px]">
      <div className="flex items-center justify-between">
        <Link to={`/routines/${routine.id}`} aria-label="Leave routine" className="type-h2 font-normal text-foreground">←</Link>
        <span className="type-eyebrow text-muted-foreground">Step {i + 1} of {routine.steps.length}</span>
      </div>

      <div className="mt-xl flex flex-1 flex-col gap-md">
        <p className="m-0 type-eyebrow text-muted-foreground">{routine.title}</p>
        <h1 className="m-0 type-title text-foreground">{st.title || 'Untitled step'}</h1>
        {st.description && st.description !== st.title && <p className="m-0 type-body text-foreground">{st.description}</p>}
        {(st.technique || st.duration) && <p className="m-0 type-body-sm text-muted-foreground">{[st.technique, st.duration].filter(Boolean).join(' · ')}</p>}
        {(st.productName || st.productBrand) && (
          <div className="mt-md flex flex-col gap-[2px] border-t border-border pt-md">
            <span className="type-eyebrow text-muted-foreground">Product</span>
            <span className="type-body text-foreground">{[st.productBrand, st.productName].filter(Boolean).join(' · ')}</span>
            {product && <Link to={`/product/${product.id}`} className="type-body-sm font-medium text-foreground">View product</Link>}
          </div>
        )}
        {st.notes && <p className="m-0 type-meta text-muted-foreground">{st.notes}</p>}
      </div>

      <div className="mt-xl flex gap-xs">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        {last ? (
          <Button variant="primary" onClick={() => nav(`/routines/${routine.id}`)}>Done</Button>
        ) : (
          <Button variant="primary" onClick={() => setI(i + 1)}>Next</Button>
        )}
      </div>
    </div>
  )
}
