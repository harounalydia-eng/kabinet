import { useEffect, useState } from 'react'
import { KabinetLogo } from './KabinetLogo'

export type SplashPhase = 'showing' | 'leaving' | 'done'

const MIN_MS = 800 // logo fully breathed before we let go
const OUT_MS = 620 // background + logo fade, then unmount

let shownThisSession = false

/**
 * Launch state machine. Shows the splash once per app load, holds it for at
 * least MIN_MS, then hands back `leaving` (the app unfolds underneath) and
 * finally `done`.
 */
export function useSplash(ready: boolean): SplashPhase {
  const [phase, setPhase] = useState<SplashPhase>(() => (shownThisSession ? 'done' : 'showing'))
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    if (phase !== 'showing') return
    const t = setTimeout(() => setMinElapsed(true), MIN_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'showing' || !ready || !minElapsed) return
    setPhase('leaving')
    shownThisSession = true
    const t = setTimeout(() => setPhase('done'), OUT_MS)
    return () => clearTimeout(t)
  }, [phase, ready, minElapsed])

  return phase
}

/** The K, centred on the theme background. Nothing else. */
export function Splash({ phase }: { phase: SplashPhase }) {
  if (phase === 'done') return null
  return (
    <div className="splash" data-leaving={phase === 'leaving' || undefined} aria-hidden="true">
      <span className="splash-logo inline-flex">
        <KabinetLogo size={48} />
      </span>
    </div>
  )
}
