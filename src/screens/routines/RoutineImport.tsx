import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Header } from '../../components/Header'
import { KabinetMark } from '../../components/KabinetLogo'
import { detectPlatform, PLATFORM_LABEL } from '../../lib/social/platform'
import { importAvailable, importRoutine, subscribeImportStatus, type ImportResult, type ImportStatus } from '../../lib/routines/importApi'

const STEP_COPY: Record<ImportStatus, string> = {
  queued: 'Reading the post…',
  reading: 'Reading the post…',
  listening: 'Listening for products…',
  extracting: 'Building the routine…',
  matching: 'Matching products…',
  ready: 'Here\'s what I found.',
  failed: 'That didn\'t work.',
}

/**
 * Paste a TikTok / YouTube / Instagram link → KABINET reads what the platform shares, builds the routine and
 * matches its products, then hands over to the review screen. Progress copy comes from the server as it moves.
 */
export default function RoutineImport() {
  const nav = useNavigate()
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [withTranscript, setWithTranscript] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failed, setFailed] = useState<ImportResult | null>(null)
  const stop = useRef<() => void>(() => {})
  const link = detectPlatform(url)

  useEffect(() => () => stop.current(), [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!link || running) return
    setRunning(true)
    setError(null)
    setFailed(null)
    setStatus('reading')
    stop.current = subscribeImportStatus(url, (s) => s && setStatus(s.status))
    try {
      const res = await importRoutine(url, withTranscript ? transcript : null)
      stop.current()
      if (res.ok && res.routine) {
        nav(`/routines/review/${res.routine.id}`, { replace: true, state: { fresh: true, cached: res.cached } })
        return
      }
      setStatus('failed')
      setFailed(res)
      setError(res.message ?? res.error ?? 'KABINET could not build a routine from this link.')
    } catch (err) {
      stop.current()
      setStatus('failed')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  if (running) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-[20px] text-center">
        <KabinetMark size={48} decorative />
        <p className="m-0 type-body text-foreground" aria-live="polite">{STEP_COPY[status ?? 'reading']}</p>
        {link && <p className="m-0 type-meta text-muted-foreground">{PLATFORM_LABEL[link.platform]} · this can take a moment</p>}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[560px]">
      <Header eyebrow="Routines" title="Import from a link" sub="Paste a TikTok, YouTube or Instagram post. KABINET reads what the creator shared and turns it into products and steps." back="/routines" />
      {!importAvailable() && <p className="m-0 mb-md type-body-sm text-muted-foreground">Importing needs a signed-in KABINET account in this build.</p>}
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-lg">
        <Field label="Link" placeholder="https://www.tiktok.com/@…/video/…" value={url} autoFocus inputMode="url" autoComplete="off" onChange={(e) => setUrl(e.target.value)} />
        {url.trim() && !link && <p className="m-0 -mt-sm type-meta text-muted-foreground">That doesn't look like a TikTok, YouTube or Instagram link yet.</p>}
        {link?.platform === 'instagram' && !withTranscript && (
          <p className="m-0 -mt-sm type-meta text-muted-foreground">Instagram doesn't share captions with apps. Add what's said or written below and KABINET will work from that.</p>
        )}
        {withTranscript ? (
          <Field multiline label="What's said or written in the video (optional)" placeholder="Paste the caption, the spoken steps, or the products listed…" rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        ) : (
          <button type="button" onClick={() => setWithTranscript(true)} className="w-fit type-body-sm font-medium text-foreground">+ Add what's said in the video</button>
        )}
        {error && (
          <div className="flex flex-col gap-[6px] rounded-tile-sm bg-surface p-md">
            <p className="m-0 type-body-sm text-foreground">{error}</p>
            {failed?.import && !withTranscript && <p className="m-0 type-meta text-muted-foreground">Adding what's said in the video usually fixes this.</p>}
          </div>
        )}
        <Button type="submit" variant="primary" disabled={!link || !importAvailable()}>Build the routine</Button>
        <p className="m-0 type-micro text-muted-foreground">KABINET keeps the original link and creator with the routine. Nothing is downloaded or re-posted.</p>
      </form>
    </div>
  )
}
