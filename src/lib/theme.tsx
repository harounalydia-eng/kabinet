import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_KEY = 'kabinet-inspo:theme'
const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#F4F2EC', dark: '#161513' }
/** Browser-tab icon per resolved theme: near-black K on a light UI, ivory K on a dark UI. Transparent canvas, no square. */
const FAVICON: Record<ResolvedTheme, string> = { light: '/brand/favicon-light.svg?v=3', dark: '/brand/favicon-dark.svg?v=3' }
const MQ = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}

/** Pure: preference + the OS answer → the theme that is painted. */
export function resolveTheme(pref: ThemePreference, osPrefersDark: boolean): ResolvedTheme {
  if (pref !== 'system') return pref
  return osPrefersDark ? 'dark' : 'light'
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return resolveTheme(pref, window.matchMedia(MQ).matches)
}

/** Mirrors the inline boot script in index.html so there is never a flash. The only place the DOM is themed. */
function apply(theme: ResolvedTheme, pref: ThemePreference) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.dataset.themePreference = pref
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  swapFavicon(FAVICON[theme])
}

/**
 * Chrome updates the tab icon most reliably when the <link rel="icon"> node is replaced,
 * not when its href is mutated. Idempotent: no-op when the icon already matches.
 */
function swapFavicon(href: string) {
  const old = document.getElementById('favicon') as HTMLLinkElement | null
  if (old?.getAttribute('href') === href) return
  const link = document.createElement('link')
  link.id = 'favicon'
  link.rel = 'icon'
  link.type = 'image/svg+xml'
  link.setAttribute('sizes', 'any')
  link.href = href
  if (old) old.replaceWith(link)
  else document.head.appendChild(link)
}

interface Theme {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (p: ThemePreference) => void
}

const Ctx = createContext<Theme | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(preference))

  useEffect(() => {
    const next = resolve(preference)
    setResolved(next)
    apply(next, preference)
    if (preference !== 'system') return
    // System: follow the OS live. Listener is removed when the preference changes or the provider unmounts.
    const mq = window.matchMedia(MQ)
    const onChange = (e: MediaQueryListEvent) => {
      const r = resolveTheme('system', e.matches)
      setResolved(r)
      apply(r, 'system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  // Another tab (or window) changing the preference updates this one too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setPref(readPreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p)
    try {
      localStorage.setItem(THEME_KEY, p) // 'system' is stored as 'system', never as the theme it resolved to
    } catch {
      /* storage unavailable */
    }
  }, [])

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): Theme {
  const t = useContext(Ctx)
  if (!t) throw new Error('useTheme outside ThemeProvider')
  return t
}
