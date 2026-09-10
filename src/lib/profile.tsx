import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Category } from './types'

/**
 * The user's beauty identity on this device. Nothing here is invented: every
 * field starts empty and only the user fills it. There is no skin or hair analysis in
 * this build, so nothing of that kind is stored or shown.
 */
export interface BeautyProfile {
  name: string
  username: string
  interests: Category[]
  goals: string[]
}

const KEY = 'kabinet-inspo:profile'
const EMPTY: BeautyProfile = { name: '', username: '', interests: [], goals: [] }

function read(): BeautyProfile {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<BeautyProfile>) }
  } catch {
    /* storage unavailable */
  }
  return EMPTY
}

interface Ctx {
  profile: BeautyProfile
  update: (patch: Partial<BeautyProfile>) => void
}

const ProfileCtx = createContext<Ctx | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BeautyProfile>(read)
  const update = useCallback((patch: Partial<BeautyProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }, [])
  const value = useMemo(() => ({ profile, update }), [profile, update])
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>
}

export function useProfile(): Ctx {
  const c = useContext(ProfileCtx)
  if (!c) throw new Error('useProfile outside ProfileProvider')
  return c
}

/** Suggested goals — choices the user picks for themselves, never something KABINET diagnoses. */
export const GOAL_SUGGESTIONS = ['Clearer-looking skin', 'Less frizz', 'Defined curls', 'Stronger nails', 'Everyday makeup', 'Simpler routine', 'Even tone', 'Scalp comfort']
