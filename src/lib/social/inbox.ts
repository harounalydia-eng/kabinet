/**
 * Import inbox — links shared into KABINET from outside the browser (the iPhone Shortcut
 * on the share sheet posts to the `import` edge function; the app pulls them here).
 *
 * Identity is the signed-in account. The app calls the endpoint with the session; the
 * Shortcut calls it with a device token minted for that account by exchanging a one-time
 * pairing code. Tokens are stored hashed on the server and can be disconnected in Settings.
 */
import { guessCategory } from '../routines/textExtract'
import type { NewSave } from '../store'
import { supabase, supabaseUrl } from '../supabase'
import { embedUrlFor } from './embed'
import { PLATFORM_LABEL, type SocialPlatform } from './platform'

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

export interface ImportToken {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface Pairing {
  code: string
  expires_at: string
}

export function importEndpoint(): string | null {
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/import` : null
}

/** Saving through the server needs the endpoint and a signed-in session. */
export const importEnabled = () => importEndpoint() !== null && supabase !== null

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

async function sessionToken(): Promise<string> {
  if (!supabase) throw new Error('Accounts are not available in this build.')
  const { data } = await supabase.auth.getSession()
  const t = data.session?.access_token
  if (!t) throw new Error('Sign in to save through KABINET.')
  return t
}

async function call(method: 'GET' | 'POST' | 'PATCH', path = '', body?: unknown) {
  const ep = importEndpoint()
  if (!ep) throw new Error('Saving is not configured.')
  const res = await fetch(ep + path, {
    method,
    headers: { Authorization: `Bearer ${await sessionToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : typeof data.error === 'string' ? data.error : `Saving failed (${res.status}).`)
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

/** A fresh one-time code for the Shortcut's first run. Valid ten minutes; replaces any earlier unused code. */
export async function createPairing(): Promise<Pairing> {
  const data = await call('POST', '/pairings')
  return { code: String(data.code), expires_at: String(data.expires_at) }
}

/** The Shortcut connections on this account (read through RLS — only the owner sees them). */
export async function listTokens(): Promise<ImportToken[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('import_tokens').select('id, label, created_at, last_used_at, revoked_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ImportToken[]
}

/** Disconnect every Shortcut on this account. The Shortcut then asks for a new code on its next run. */
export async function revokeAllTokens(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('import_tokens').update({ revoked_at: new Date().toISOString() }).is('revoked_at', null)
  if (error) throw new Error(error.message)
}

/** Ask the running sync hook to check the inbox now (Settings → Check now). */
export const requestInboxSync = () => window.dispatchEvent(new Event(INBOX_SYNC_EVENT))
