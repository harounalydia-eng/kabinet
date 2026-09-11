import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { createPairing, listTokens, type ImportToken, type Pairing } from './social/inbox'

/** How the customer gets the Shortcut. An iCloud share link (created once from an iPhone) is the smoothest tap; the signed file is the fallback. */
export const SHORTCUT_NAME = 'Save to KABINET'
export const SHORTCUT_FILE_URL = '/shortcuts/Save%20to%20KABINET.shortcut'
export const SHORTCUT_ICLOUD_URL = (import.meta.env.VITE_SHORTCUT_ICLOUD_URL as string | undefined)?.trim() || null
export const shortcutInstallUrl = () => SHORTCUT_ICLOUD_URL ?? SHORTCUT_FILE_URL
export const shortcutInstallIsFile = () => SHORTCUT_ICLOUD_URL === null

/** A real, public tutorial the customer can share to try the Shortcut. Metadata is read live via YouTube's public oEmbed. */
export const EXAMPLE_TUTORIAL = {
  url: 'https://www.youtube.com/watch?v=5JJ-cW4vYy0',
  canonicalUrl: 'https://www.youtube.com/watch?v=5JJ-cW4vYy0',
  title: 'Skincare 101: Easy Skincare Routine for Beginners',
  creator: 'Sephora',
  poster: 'https://i.ytimg.com/vi/5JJ-cW4vYy0/hqdefault.jpg',
}

export const isIOS = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function relativeTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.floor(h / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/**
 * A live pairing code: created on demand, counts down, and reports the moment the Shortcut
 * redeems it (Realtime on the row, with a poll as the fallback). `connected` is only ever
 * true when the server has really minted a token for this code.
 */
export function usePairing(active: boolean) {
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [connected, setConnected] = useState(false)
  const busy = useRef(false)

  const refresh = async () => {
    if (busy.current) return
    busy.current = true
    setError(null)
    try {
      const p = await createPairing()
      setPairing(p)
      setConnected(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      busy.current = false
    }
  }

  useEffect(() => {
    if (!active) return
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (!pairing) return
    const tick = () => setRemaining(new Date(pairing.expires_at).getTime() - Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [pairing])

  useEffect(() => {
    if (!pairing || !supabase || connected) return
    const code = pairing.code
    let on = true
    const check = async () => {
      const { data } = await supabase!.from('import_pairings').select('consumed_at').eq('code', code).maybeSingle()
      if (on && data?.consumed_at) setConnected(true)
    }
    const channel = supabase.channel(`pairing-${code}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'import_pairings', filter: `code=eq.${code}` }, (payload) => {
      const row = payload.new as { consumed_at: string | null }
      if (on && row.consumed_at) setConnected(true)
    })
    channel.subscribe()
    const poll = setInterval(() => void check(), 4000)
    return () => {
      on = false
      clearInterval(poll)
      void supabase!.removeChannel(channel)
    }
  }, [pairing, connected])

  return { pairing, remaining, expired: pairing !== null && remaining <= 0, connected, error, refresh }
}

/** The Shortcut connections on this account, refreshed on demand. */
export function useTokens() {
  const [tokens, setTokens] = useState<ImportToken[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = async () => {
    try {
      setTokens(await listTokens())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => {
    void reload()
  }, [])
  const active = (tokens ?? []).filter((t) => !t.revoked_at)
  const lastUsed = active.map((t) => t.last_used_at).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null
  return { tokens, active, lastUsed, error, reload, loading: tokens === null }
}
