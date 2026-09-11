import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { accountsAvailable, supabase, supabaseKey, supabaseUrl } from './supabase'

/** Sign-in methods the project has actually switched on. Read from Auth's public settings, never assumed. */
export interface Providers {
  apple: boolean
  google: boolean
  email: boolean
}

interface AuthState {
  /** False once the stored session (if any) has been read. The splash waits on this. */
  loading: boolean
  available: boolean
  session: Session | null
  user: User | null
  providers: Providers
  /** Sends a sign-in email (6-digit code and/or link, depending on the project's template). Creates the account when new. */
  sendCode: (email: string) => Promise<string | null>
  verifyCode: (email: string, code: string) => Promise<string | null>
  signInWith: (provider: 'apple' | 'google') => Promise<string | null>
  signOut: () => Promise<void>
}

const NO_PROVIDERS: Providers = { apple: false, google: false, email: false }
const Ctx = createContext<AuthState | null>(null)

/** Supabase error text → something a person can act on. */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many emails in a short time. Wait a few minutes and try again.'
  if (m.includes('invalid') && (m.includes('otp') || m.includes('token'))) return 'That code did not match. Check the newest email and try again.'
  if (m.includes('expired')) return 'That code has expired. Send a new one.'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'That sign-in method is not switched on yet.'
  if (m.includes('signups not allowed') || m.includes('signup')) return 'New accounts are paused right now.'
  if (m.includes('email address') && m.includes('invalid')) return 'That does not look like an email address.'
  if (m.includes('fetch') || m.includes('network')) return 'No connection. Check your internet and try again.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(accountsAvailable)
  const [providers, setProviders] = useState<Providers>(NO_PROVIDERS)

  useEffect(() => {
    if (!supabase) return
    let on = true
    supabase.auth.getSession().then(({ data }) => {
      if (!on) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (on) setSession(s)
    })
    return () => {
      on = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Which buttons to show is a fact about the project, not a guess: ask Auth for its enabled providers.
  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const ctrl = new AbortController()
    fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey }, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { external?: Record<string, boolean> } | null) => {
        if (!s?.external) return
        setProviders({ apple: s.external.apple === true, google: s.external.google === true, email: s.external.email !== false })
      })
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [])

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return 'Accounts are not available in this build.'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/welcome` } })
    return error ? friendlyAuthError(error.message) : null
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    if (!supabase) return 'Accounts are not available in this build.'
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    return error ? friendlyAuthError(error.message) : null
  }, [])

  const signInWith = useCallback(async (provider: 'apple' | 'google') => {
    if (!supabase) return 'Accounts are not available in this build.'
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/welcome` } })
    return error ? friendlyAuthError(error.message) : null
  }, [])

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ loading, available: accountsAvailable, session, user: session?.user ?? null, providers, sendCode, verifyCode, signInWith, signOut }),
    [loading, session, providers, sendCode, verifyCode, signInWith, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
