import { useEffect, useState, type CSSProperties } from 'react'
import { K_PATH, K_VIEWBOX } from './KabinetLogo'
import { setThemeColorOverride } from '../lib/theme'

export type SplashPhase = 'showing' | 'leaving' | 'done'

/**
 * The entry: dark before the lights come on. index.html paints the first frames and React
 * joins the same timeline mid-flight, so every delay below is measured from navigation start.
 *
 *   0ms      dark
 *   200ms    the K wakes (opacity, 0.97 → 1)
 *   1000ms   the name flickers in, letter by letter
 *   1430ms   KABINET — held
 *   2180ms   the dark dissolves into the canvas (once the app is ready)
 */
export const ENTRY = {
  bg: '#0E0E0E',
  iconIn: 200,
  iconDur: 520,
  wordIn: 1000,
  letterStep: 45,
  letterDur: 160,
  hold: 750,
  dissolve: 520,
} as const
const LETTERS = 'KABINET'.split('')
const WORD_END = ENTRY.wordIn + (LETTERS.length - 1) * ENTRY.letterStep + ENTRY.letterDur
const SEQUENCE_END = WORD_END + ENTRY.hold
/** Dissolve, breathing room, then the welcome typography — the layer stays mounted (invisible) until all of it has run. */
const OUT_MS = 1150

let shownThisSession = false

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
function sequenceEnd() {
  return reducedMotion() ? 0 : SEQUENCE_END
}

/**
 * Launch state machine. Leaves when BOTH are true: the brand reveal has finished, and the
 * library, the session and the account have loaded. Never a spinner, never fake progress —
 * if loading takes longer, the name simply stays.
 */
export function useSplash(ready: boolean): SplashPhase {
  const [phase, setPhase] = useState<SplashPhase>(() => (shownThisSession ? 'done' : 'showing'))
  const [revealed, setRevealed] = useState(() => performance.now() >= sequenceEnd())

  useEffect(() => {
    if (revealed) return
    const t = setTimeout(() => setRevealed(true), Math.max(0, sequenceEnd() - performance.now()))
    return () => clearTimeout(t)
  }, [revealed])

  useEffect(() => {
    if (phase !== 'showing' || !ready || !revealed) return
    setPhase('leaving')
    shownThisSession = true
  }, [phase, ready, revealed])

  // Separate effect on purpose: scheduling 'done' inside the transition above would be cancelled
  // by that effect's own cleanup the moment the phase changed, and the layer would never unmount.
  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('done'), OUT_MS)
    return () => clearTimeout(t)
  }, [phase])

  return phase
}

/** Dark screen. Icon. Blink. KABINET. Nothing else — no card, no copy, no progress. */
export function Splash({ phase }: { phase: SplashPhase }) {
  // Negative delay so the CSS animations resume exactly where index.html's boot paint left them.
  const [t0] = useState(() => -Math.round(performance.now()))

  useEffect(() => {
    if (phase === 'done') return
    setThemeColorOverride(phase === 'showing' ? ENTRY.bg : null)
    return () => setThemeColorOverride(null)
  }, [phase])

  if (phase === 'done') return null
  return (
    <div className="entry" data-leaving={phase === 'leaving' || undefined} style={{ '--t0': `${t0}ms` } as CSSProperties} aria-hidden="true">
      <div className="entry-brand">
        <span className="entry-icon">
          <svg viewBox={K_VIEWBOX} width={26.91} height={48} className="block">
            <path fill="currentColor" d={K_PATH} />
          </svg>
        </span>
        <span className="entry-word">
          {LETTERS.map((ch, i) => (
            <span key={i} style={{ '--i': i } as CSSProperties}>{ch}</span>
          ))}
        </span>
      </div>
    </div>
  )
}
