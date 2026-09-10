/**
 * Import inbox — links shared into KABINET from outside the browser (an iOS Shortcut
 * on the share sheet posts to the `import` edge function; the app pulls them here).
 * The device token is the only credential: generated locally, shown once in Settings,
 * never sent anywhere but the import endpoint.
 */
import { guessCategory } from '../routines/textExtract'
import type { NewSave } from '../store'
import { embedUrlFor } from './embed'
import { PLATFORM_LABEL, type SocialPlatform } from './platform'

export const IMPORT_TOKEN_KEY = 'kabinet-inspo:import-token'
export const INBOX_SYNC_EVENT = 'kabinet:inbox-sync'

export interface InboxRow {
  id: string
  source: string
  url: string
  canonical_url: string
  platform: SocialPlatform
  source_id: string | null
  vertical: boolean
  title: string | null
  caption: string | null
  creator_name: string | null
  creator_url: string | null
  thumbnail_url: string | null
  thumbnail_w: number | null
  thumbnail_h: number | null
  embed_url: string | null
  access_note: string | null
  status: 'pending' | 'imported' | 'failed'
  error: string | null
  created_at: string
  imported_at: string | null
}

export function importEndpoint(): string | null {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  return base ? `${base.replace(/\/$/, '')}/functions/v1/import` : null
}

export const importEnabled = () => importEndpoint() !== null

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(27))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `kbt_${b64}`
}

export function getImportToken(): string {
  try {
    const t = localStorage.getItem(IMPORT_TOKEN_KEY)
    if (t && /^kbt_[A-Za-z0-9_-]{32,64}$/.test(t)) return t
    const fresh = generateToken()
    localStorage.setItem(IMPORT_TOKEN_KEY, fresh)
    return fresh
  } catch {
    return generateToken()
  }
}

export function regenerateImportToken(): string {
  const fresh = generateToken()
  try {
    localStorage.setItem(IMPORT_TOKEN_KEY, fresh)
  } catch {
    /* storage unavailable */
  }
  return fresh
}

/** Everything the platform legitimately gave us, joined — the same Level 1 text the in-app import uses. */
const availableText = (r: InboxRow) => [r.title, r.caption].filter((t): t is string => Boolean(t && t.trim())).join('\n')

/**
 * One conversion for both entry points (web paste and the phone Shortcut): an inbox row
 * becomes a VIDEO save. The thumbnail is only the poster; playback uses the platform embed.
 * Never a product — products have their own photography and their own records.
 */
export function inboxRowToSave(r: InboxRow): NewSave {
  const w = r.thumbnail_w ?? (r.vertical ? 720 : 1280)
  const h = r.thumbnail_h ?? (r.vertical ? 1280 : 720)
  const text = availableText(r)
  return {
    category: guessCategory(text) ?? 'Skin',
    collectionId: null,
    note: '',
    title: r.title ?? undefined,
    source: { url: r.canonical_url, title: r.title ?? undefined },
    image: r.thumbnail_url ? { kind: 'url', url: r.thumbnail_url, w, h } : { kind: 'tone', tone: '#383833', tone2: '#2A2A26', label: PLATFORM_LABEL[r.platform], w, h },
    social: {
      platform: r.platform,
      contentType: 'video',
      sourceId: r.source_id,
      sourceUrl: r.url,
      canonicalUrl: r.canonical_url,
      creatorName: r.creator_name,
      creatorUrl: r.creator_url,
      embedUrl: r.embed_url ?? embedUrlFor(r.platform, r.source_id, r.canonical_url),
      posterUrl: r.thumbnail_url,
      vertical: r.vertical,
      caption: r.caption,
      description: null,
      transcript: null,
      availableText: text,
      accessNote: r.access_note ?? undefined,
    },
  }
}

async function call(method: 'GET' | 'POST' | 'PATCH', path = '', body?: unknown) {
  const ep = importEndpoint()
  if (!ep) throw new Error('Import is not configured.')
  const res = await fetch(ep + path, {
    method,
    headers: { Authorization: `Bearer ${getImportToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : `Import endpoint returned ${res.status}.`)
  return data
}

/** Share a link through the server pipeline (same one the phone Shortcut uses). */
export async function postImport(url: string, source: string): Promise<{ item: InboxRow; duplicate: boolean; message: string }> {
  const data = await call('POST', '', { url, source })
  return { item: data.item as InboxRow, duplicate: data.duplicate === true, message: typeof data.message === 'string' ? data.message : '' }
}

export async function fetchInbox(): Promise<InboxRow[]> {
  const data = await call('GET', '?status=pending')
  return Array.isArray(data.items) ? (data.items as InboxRow[]) : []
}

export async function ackInbox(ids: string[], status: 'imported' | 'failed' = 'imported', error?: string): Promise<void> {
  if (ids.length === 0) return
  await call('PATCH', '', { ids, status, error })
}

/** Ask the running sync hook to check the inbox now (Settings → Check now). */
export const requestInboxSync = () => window.dispatchEvent(new Event(INBOX_SYNC_EVENT))
