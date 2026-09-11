import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'
import type { Category } from './types'

/**
 * The account record behind a signed-in person: what they chose during the
 * introduction and how far they got. Stored in `kabinet_profiles` (owner-only RLS),
 * so a returning customer resumes exactly where they left off, on any device.
 * When the build has no Supabase keys the same shape lives in localStorage.
 */
export const ONBOARDING_STEPS = ['worlds', 'intents', 'shortcut', 'connect', 'connected'] as const
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export const INTENTS = ['Save inspiration', 'Organize products', 'Build routines'] as const
export type Intent = (typeof INTENTS)[number]

export interface Account {
  displayName: string | null
  worlds: Category[]
  intents: Intent[]
  onboardingStep: OnboardingStep
  onboardingCompletedAt: string | null
}

const EMPTY: Account = { displayName: null, worlds: [], intents: [], onboardingStep: 'worlds', onboardingCompletedAt: null }
const LOCAL_KEY = 'kabinet-inspo:account'

interface Row {
  display_name: string | null
  worlds: string[]
  intents: string[]
  onboarding_step: string
  onboarding_completed_at: string | null
}

const fromRow = (r: Row): Account => ({
  displayName: r.display_name,
  worlds: r.worlds as Category[],
  intents: r.intents as Intent[],
  onboardingStep: (ONBOARDING_STEPS as readonly string[]).includes(r.onboarding_step) ? (r.onboarding_step as OnboardingStep) : 'worlds',
  onboardingCompletedAt: r.onboarding_completed_at,
})

const toRow = (a: Partial<Account>): Partial<Row> => {
  const r: Partial<Row> = {}
  if (a.displayName !== undefined) r.display_name = a.displayName
  if (a.worlds !== undefined) r.worlds = a.worlds
  if (a.intents !== undefined) r.intents = a.intents
  if (a.onboardingStep !== undefined) r.onboarding_step = a.onboardingStep
  if (a.onboardingCompletedAt !== undefined) r.onboarding_completed_at = a.onboardingCompletedAt
  return r
}

function readLocal(): Account {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Account>) }
  } catch {
    /* storage unavailable */
  }
  return EMPTY
}

interface Ctx {
  /** True once the record for the current user has been read (or there is no user). */
  ready: boolean
  account: Account
  onboarded: boolean
  update: (patch: Partial<Account>) => Promise<void>
  /** Move to a later step (never backwards — a resume lands on the furthest point reached). */
  advance: (step: OnboardingStep) => Promise<void>
  complete: () => Promise<void>
}

const AccountCtx = createContext<Ctx | null>(null)

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, available } = useAuth()
  const [account, setAccount] = useState<Account>(() => (available ? EMPTY : readLocal()))
  const [ready, setReady] = useState(!available)
  const userId = user?.id ?? null

  useEffect(() => {
    if (!supabase || authLoading) return
    if (!userId) {
      setAccount(EMPTY)
      setReady(true)
      return
    }
    let on = true
    setReady(false)
    ;(async () => {
      const { data, error } = await supabase!.from('kabinet_profiles').select('display_name, worlds, intents, onboarding_step, onboarding_completed_at').eq('user_id', userId).maybeSingle()
      if (!on) return
      if (error) {
        console.warn('[kabinet] account load failed:', error.message)
        setAccount(EMPTY)
      } else if (data) {
        setAccount(fromRow(data as Row))
      } else {
        // First sign-in on this account: create the record so the step is persisted from here on.
        const { data: created } = await supabase!.from('kabinet_profiles').insert({ user_id: userId }).select('display_name, worlds, intents, onboarding_step, onboarding_completed_at').single()
        if (!on) return
        setAccount(created ? fromRow(created as Row) : EMPTY)
      }
      setReady(true)
    })()
    return () => {
      on = false
    }
  }, [userId, authLoading])

  const update = useCallback(
    async (patch: Partial<Account>) => {
      setAccount((prev) => {
        const next = { ...prev, ...patch }
        if (!supabase) {
          try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
          } catch {
            /* storage unavailable */
          }
        }
        return next
      })
      if (supabase && userId) {
        const { error } = await supabase.from('kabinet_profiles').upsert({ user_id: userId, ...toRow(patch) }, { onConflict: 'user_id' })
        if (error) console.warn('[kabinet] account save failed:', error.message)
      }
    },
    [userId],
  )

  const advance = useCallback(
    async (step: OnboardingStep) => {
      if (ONBOARDING_STEPS.indexOf(step) <= ONBOARDING_STEPS.indexOf(account.onboardingStep)) return
      await update({ onboardingStep: step })
    },
    [account.onboardingStep, update],
  )

  const complete = useCallback(async () => {
    if (account.onboardingCompletedAt) return
    await update({ onboardingCompletedAt: new Date().toISOString(), onboardingStep: 'connected' })
  }, [account.onboardingCompletedAt, update])

  const value = useMemo<Ctx>(() => ({ ready, account, onboarded: account.onboardingCompletedAt !== null, update, advance, complete }), [ready, account, update, advance, complete])
  return <AccountCtx.Provider value={value}>{children}</AccountCtx.Provider>
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx)
  if (!c) throw new Error('useAccount outside AccountProvider')
  return c
}
