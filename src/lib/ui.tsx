import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Density = 'large' | 'medium' | 'dense'
const DENSITY_KEY = 'kabinet-inspo:density'
function readDensity(): Density {
  try {
    const v = localStorage.getItem(DENSITY_KEY)
    if (v === 'large' || v === 'medium' || v === 'dense') return v
  } catch {
    /* storage unavailable */
  }
  return 'medium'
}

export interface SavePrefill {
  collectionId?: string | null
}

interface UI {
  saveOpen: boolean
  savePrefill: SavePrefill
  openSave: (prefill?: SavePrefill) => void
  closeSave: () => void
  /** Ids of saves created a moment ago — their tiles settle into the feed. */
  settled: ReadonlySet<string>
  markSettled: (ids: string[]) => void
  /** Discovery grid density — persisted on this device. */
  density: Density
  setDensity: (d: Density) => void
}

const Ctx = createContext<UI | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [savePrefill, setPrefill] = useState<SavePrefill>({})
  const openSave = useCallback((p: SavePrefill = {}) => {
    setPrefill(p)
    setSaveOpen(true)
  }, [])
  const closeSave = useCallback(() => setSaveOpen(false), [])
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const markSettled = useCallback((ids: string[]) => {
    setSettled(new Set(ids))
    setTimeout(() => setSettled(new Set()), 1200)
  }, [])
  const [density, setDensityState] = useState<Density>(readDensity)
  const setDensity = useCallback((d: Density) => {
    setDensityState(d)
    try {
      localStorage.setItem(DENSITY_KEY, d)
    } catch {
      /* storage unavailable */
    }
  }, [])
  const value = useMemo(
    () => ({ saveOpen, savePrefill, openSave, closeSave, settled, markSettled, density, setDensity }),
    [saveOpen, savePrefill, openSave, closeSave, settled, markSettled, density, setDensity],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUI(): UI {
  const u = useContext(Ctx)
  if (!u) throw new Error('useUI outside UIProvider')
  return u
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(ts)
}
