import { useEffect, useRef } from 'react'
import { ackInbox, fetchInbox, importEnabled, inboxRowToSave, INBOX_SYNC_EVENT } from './inbox'
import { useAuth } from '../auth'
import { useStore } from '../store'

const MIN_INTERVAL = 20_000

/**
 * Pulls links shared from the phone into the local library: on load, when the tab
 * becomes visible or focused, and on request. Each row is acknowledged after it is
 * stored locally, so nothing imports twice. Silent when the endpoint is not configured.
 */
export function useInboxSync() {
  const { ready, addSaves } = useStore()
  const { user } = useAuth()
  const last = useRef(0)
  const busy = useRef(false)

  useEffect(() => {
    if (!ready || !importEnabled() || !user) return
    const sync = async (force = false) => {
      if (busy.current) return
      if (!force && Date.now() - last.current < MIN_INTERVAL) return
      busy.current = true
      last.current = Date.now()
      try {
        const rows = await fetchInbox()
        if (rows.length === 0) return
        const created = await addSaves(rows.map(inboxRowToSave))
        await ackInbox(rows.slice(0, created.length).map((r) => r.id))
      } catch (e) {
        // Offline or misconfigured: try again on the next trigger. Never surfaces as an error in the feed.
        console.warn('[kabinet] inbox sync skipped:', (e as Error).message)
      } finally {
        busy.current = false
      }
    }
    void sync(true)
    const onVisible = () => document.visibilityState === 'visible' && void sync()
    const onFocus = () => void sync()
    const onRequest = () => void sync(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener(INBOX_SYNC_EVENT, onRequest)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(INBOX_SYNC_EVENT, onRequest)
    }
  }, [ready, addSaves, user])
}
