import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from './Button'
import { Sheet } from './Sheet'
import { cx } from '../lib/cx'
import { extractRoutine, type ExtractionResult, type ExtractionSource, type ExtractionStatus } from '../lib/routines/extract'
import { textHash } from '../lib/routines/textExtract'
import type { Save } from '../lib/types'
import { useStore } from '../lib/store'

const PILL = 'inline-flex h-[38px] items-center gap-[6px] rounded-full px-[16px] type-body-sm font-medium whitespace-nowrap transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98]'

/**
 * "Create routine ✦" — the one place analysis can start, and only on this tap.
 * Nothing runs on load, scroll or save.
 */
export function CreateRoutineAction({ source, save, className }: { source: ExtractionSource; save?: Save; className?: string }) {
  const nav = useNavigate()
  const { putRoutine, updateSave, routines } = useStore()
  const existing = save?.extraction?.routineId ? routines.find((r) => r.id === save.extraction!.routineId) : undefined
  const [status, setStatus] = useState<ExtractionStatus>('idle')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  async function start() {
    if (existing) {
      nav(`/routines/${existing.id}`)
      return
    }
    abort.current?.abort()
    const ac = new AbortController()
    abort.current = ac
    setResult(null)
    setStatus('queued')
    setStatus('analyzing')
    const r = await extractRoutine(source, ac.signal)
    if (ac.signal.aborted) return
    setResult(r)
    setStatus(r.status === 'ready' ? 'review' : r.status === 'unavailable' ? 'unavailable' : 'failed')
    if (save && r.status !== 'ready' && source.social) {
      // Remember the miss so navigating away and back does not re-run analysis by accident.
      void updateSave(save.id, { extraction: { status: 'failed', textHash: await textHash(source.social.availableText), at: Date.now(), reason: r.status === 'failed' ? r.error : r.reason } })
    }
  }

  async function review() {
    if (!result || result.status !== 'ready') return
    await putRoutine(result.draft)
    if (save && source.social) {
      await updateSave(save.id, { extraction: { status: 'complete', routineId: result.draft.id, textHash: await textHash(source.social.availableText), at: Date.now() } })
    }
    setStatus('completed')
    nav(`/routines/${result.draft.id}/edit?review=1`)
  }

  function buildManually() {
    setStatus('idle')
    nav('/routines/new', { state: { from: source } })
  }

  const open = status !== 'idle' && status !== 'completed'
  const label = existing ? 'Open routine' : source.social ? 'Turn into routine' : source.isVideo ? 'Create routine from video' : 'Create routine'

  return (
    <>
      <button type="button" onClick={() => void start()} className={cx(PILL, 'bg-surface text-foreground', className)}>
        {label} {!existing && <span aria-hidden="true" className="text-[12px] text-accent-text">✦</span>}
      </button>

      <Sheet open={open} onClose={() => { abort.current?.abort(); setStatus('idle') }} label="Create routine">
        {status === 'analyzing' || status === 'queued' ? (
          <div className="flex flex-col gap-lg">
            <div className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Creating your routine</p>
              <h2 className="m-0 type-h2 text-foreground">{source.social ? 'Organizing the steps and products from this tutorial…' : 'Identifying steps and products…'}</h2>
            </div>
            <div aria-hidden="true" className="h-[2px] w-full overflow-hidden rounded-full bg-muted">
              <div className="indeterminate h-full w-1/3 rounded-full bg-muted-foreground/60" />
            </div>
          </div>
        ) : status === 'review' && result?.status === 'ready' ? (
          <div className="flex flex-col gap-lg">
            <div className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">KABINET found</p>
              <h2 className="m-0 type-h2 text-foreground">Routine found</h2>
            </div>
            <p className="m-0 type-h3 text-foreground">{result.draft.title}</p>
            <ul className="m-0 flex list-none flex-col gap-[6px] p-0 type-body text-foreground">
              <li>✓ {result.summary.steps} {result.summary.steps === 1 ? 'step' : 'steps'}</li>
              <li>{result.summary.identified > 0 ? '✓' : '·'} {result.summary.identified} {result.summary.identified === 1 ? 'product' : 'products'} identified{result.summary.possible > 0 && ` · ${result.summary.possible} to confirm`}</li>
              {result.summary.unclear > 0 && <li>? {result.summary.unclear} {result.summary.unclear === 1 ? 'product' : 'products'} unclear</li>}
            </ul>
            <p className="m-0 type-body-sm text-muted-foreground">{source.social ? 'Drafted from the text this tutorial shares. Check it before it becomes yours.' : 'This is a draft from the steps this look lists. Check it before it becomes yours.'}</p>
            <Button variant="primary" onClick={() => void review()}>Review routine →</Button>
          </div>
        ) : status === 'unavailable' && result?.status === 'unavailable' ? (
          <div className="flex flex-col gap-lg">
            <div className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Create routine</p>
              <h2 className="m-0 type-h2 text-foreground">{source.social ? 'We couldn’t create this routine.' : 'Not from this one, yet.'}</h2>
            </div>
            <p className="m-0 type-body-sm text-muted-foreground">{result.reason}</p>
            <div className="flex flex-col gap-xs">
              {source.social && <Button variant="secondary" on="surface" onClick={() => void start()}>Try again</Button>}
              <Button variant="primary" onClick={buildManually}>{source.social ? 'Build it myself' : 'Build it manually'}</Button>
              {source.social && <Button variant="ghost" onClick={() => setStatus('idle')}>Keep as inspiration</Button>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-lg">
            <div className="flex flex-col gap-[6px]">
              <p className="m-0 type-eyebrow text-muted-foreground">Create routine</p>
              <h2 className="m-0 type-h2 text-foreground">We couldn’t create a routine from this.</h2>
            </div>
            {result?.status === 'failed' && <p className="m-0 type-body-sm text-muted-foreground">{result.error}</p>}
            <div className="flex gap-xs">
              <Button variant="secondary" on="surface" onClick={() => void start()}>Try again</Button>
              <Button variant="primary" onClick={buildManually}>Build manually</Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
