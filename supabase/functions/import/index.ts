// KABINET — import (v3: account-bound)
//
// POST  /functions/v1/import            { url, source? }     ← iOS Shortcut (device token) or the web app (session)
// GET   /functions/v1/import?status=pending                  ← the app pulls what was shared to this account
// PATCH /functions/v1/import            { ids, status, error? }
// POST  /functions/v1/import/pairings                        ← app (session): a one-time 6-character code, valid 10 minutes
// POST  /functions/v1/import/pair       { code }             ← Shortcut, first run: exchanges the code for a device token
//
// Identity is ONE of:
//   • a device token `kbt_…` minted here for a signed-in user (stored hashed in import_tokens, revocable) — sent as
//     `Authorization: Bearer kbt_…`, `x-kabinet-token`, or `token` in the body
//   • the user's Supabase session JWT (`Authorization: Bearer <jwt>`) — the web app
// Deployed with JWT verification off because the header may carry a device token; JWTs are verified here.
//
// Metadata comes from the platforms' public oEmbed endpoints only — no scraping, no keys. What is saved is VIDEO
// CONTENT: platform, source + canonical URL, creator, caption, poster and the platform's embed URL. Nothing is
// downloaded or re-hosted; no AI, transcription or product identification runs here.
//
// Every response carries a human `message` — the Shortcut shows it as its notification.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { detectPlatform, PLATFORM_LABEL, type DetectedLink } from './platform.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-kabinet-token, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, message: string, extra: Record<string, unknown> = {}) => json({ error: message, message, ...extra }, status)

const TOKEN_RE = /^kbt_[A-Za-z0-9_-]{32,64}$/
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const CODE_LENGTH = 6
const CODE_TTL_MS = 10 * 60_000
const RATE_LIMIT_PER_HOUR = 60
const SELECT = 'id, source, url, canonical_url, platform, source_id, vertical, title, caption, creator_name, creator_url, thumbnail_url, thumbnail_w, thumbnail_h, embed_url, access_note, status, error, created_at, imported_at'

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(27))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `kbt_${b64}`
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

type Identity = { userId: string; via: 'token'; tokenId: string; tokenHash: string } | { userId: string; via: 'session'; tokenHash: string }

const NOT_CONNECTED = 'This Shortcut is not connected to a Kabinet. Open KABINET → Settings → Save to KABINET to reconnect.'

/** Who is calling — a Shortcut with a minted device token, or the app with the user's session. */
async function identify(req: Request, body: Record<string, unknown> | null, db: SupabaseClient, url: string, anon: string): Promise<Identity | Response> {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const deviceToken = (TOKEN_RE.test(bearer) && bearer) || req.headers.get('x-kabinet-token') || (typeof body?.token === 'string' ? body.token : null)

  if (deviceToken && TOKEN_RE.test(deviceToken)) {
    const tokenHash = await sha256(deviceToken)
    const { data } = await db.from('import_tokens').select('id, user_id, revoked_at').eq('token_hash', tokenHash).maybeSingle()
    if (!data || data.revoked_at) return fail(401, NOT_CONNECTED)
    return { userId: data.user_id, via: 'token', tokenId: data.id, tokenHash }
  }

  if (bearer && bearer.split('.').length === 3) {
    const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } }, auth: { persistSession: false } })
    const { data, error } = await asUser.auth.getUser()
    if (error || !data.user) return fail(401, 'Your session has expired. Sign in to KABINET again.')
    return { userId: data.user.id, via: 'session', tokenHash: `user:${data.user.id}` }
  }

  return fail(401, NOT_CONNECTED)
}

interface OEmbed { title?: string; author_name?: string; author_url?: string; embed_product_id?: string; thumbnail_url?: string; thumbnail_width?: number | string; thumbnail_height?: number | string }

/** The platform's own embed player — playback without downloading or re-hosting. Mirrors src/lib/social/embed.ts. */
function embedUrlFor(platform: string, sourceId: string | null, canonicalUrl: string): string | null {
  if (platform === 'tiktok') return sourceId ? `https://www.tiktok.com/embed/v2/${sourceId}` : null
  if (platform === 'youtube') return sourceId ? `https://www.youtube-nocookie.com/embed/${sourceId}?autoplay=1&playsinline=1&rel=0` : null
  const m = canonicalUrl.match(/instagram\.com\/(reel|p|tv)\/([\w-]+)/)
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/` : null
}

/** Same rules as the browser adapters: public oEmbed for TikTok and YouTube; Instagram is link-only. */
async function metadata(link: DetectedLink) {
  const m = { sourceId: link.sourceId, title: null as string | null, caption: null as string | null, creator: null as string | null, creatorUrl: null as string | null, thumb: null as string | null, w: null as number | null, h: null as number | null, note: null as string | null }
  const get = async (endpoint: string): Promise<OEmbed> => {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`The platform did not return details for this link (${res.status}).`)
    return (await res.json()) as OEmbed
  }
  try {
    if (link.platform === 'tiktok') {
      const o = await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}`)
      m.caption = o.title ?? null
      m.title = o.title ? o.title.split(/[\n#]/)[0].trim() || null : null
      m.creator = o.author_name ?? null
      m.creatorUrl = o.author_url ?? null
      if (!m.sourceId && o.embed_product_id && /^\d+$/.test(o.embed_product_id)) m.sourceId = o.embed_product_id
      m.thumb = o.thumbnail_url ?? null
      m.w = Number(o.thumbnail_width) || null
      m.h = Number(o.thumbnail_height) || null
      m.note = 'TikTok exposes the caption and thumbnail publicly; spoken words are not available.'
    } else if (link.platform === 'youtube') {
      const o = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}&format=json`)
      m.title = o.title ?? null
      m.creator = o.author_name ?? null
      m.creatorUrl = o.author_url ?? null
      m.thumb = link.sourceId ? `https://i.ytimg.com/vi/${link.sourceId}/hqdefault.jpg` : o.thumbnail_url ?? null
      m.w = 480
      m.h = 360
      m.note = 'YouTube exposes the title and thumbnail publicly. The description and captions need a server-side Data API key.'
    } else {
      m.note = 'Instagram does not expose captions or thumbnails without an approved Meta app. The link is saved; add the caption yourself if you want a routine from it.'
    }
  } catch (e) {
    m.note = e instanceof Error ? e.message : 'Could not reach the platform.'
  }
  return m
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !service || !anon) return fail(503, 'Saving is not configured on the server.')
  const db = createClient(url, service, { auth: { persistSession: false } })

  let body: Record<string, unknown> | null = null
  if (req.method === 'POST' || req.method === 'PATCH') {
    const raw = await req.text()
    if (raw.length > 8_000) return fail(413, 'Request body too large.')
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    } catch {
      return fail(400, 'Body must be JSON.')
    }
  }

  const path = new URL(req.url).pathname.replace(/^.*\/import/, '').replace(/\/$/, '')

  // ── POST /pair: the Shortcut's first run — exchange a code for a device token ──
  if (path === '/pair') {
    if (req.method !== 'POST') return fail(405, 'Method not allowed.')
    const code = typeof body?.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
    if (code.length !== CODE_LENGTH) return fail(400, 'Enter the 6-character code shown in KABINET.')
    const { data: pairing } = await db.from('import_pairings').select('code, user_id, expires_at, consumed_at').eq('code', code).maybeSingle()
    if (!pairing || pairing.consumed_at || new Date(pairing.expires_at).getTime() < Date.now()) {
      return fail(404, 'That code is no longer valid. Open KABINET → Settings → Save to KABINET for a new one.')
    }
    const token = randomToken()
    const { data: minted, error } = await db.from('import_tokens').insert({ user_id: pairing.user_id, token_hash: await sha256(token), label: 'iPhone Shortcut' }).select('id').single()
    if (error || !minted) return fail(500, 'Could not connect right now. Try again in a moment.')
    await db.from('import_pairings').update({ consumed_at: new Date().toISOString(), token_id: minted.id }).eq('code', code)
    return json({ ok: true, token, message: 'Connected to KABINET.' }, 201)
  }

  const identity = await identify(req, body, db, url, anon)
  if (identity instanceof Response) return identity

  // ── POST /pairings: the app asks for a fresh code to show the customer ──
  if (path === '/pairings') {
    if (req.method !== 'POST') return fail(405, 'Method not allowed.')
    if (identity.via !== 'session') return fail(403, 'Codes are created from the KABINET app.')
    const now = new Date()
    // One live code per account: retire earlier unused ones.
    await db.from('import_pairings').update({ expires_at: now.toISOString() }).eq('user_id', identity.userId).is('consumed_at', null).gt('expires_at', now.toISOString())
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode()
      const expires_at = new Date(now.getTime() + CODE_TTL_MS).toISOString()
      const { error } = await db.from('import_pairings').insert({ code, user_id: identity.userId, expires_at })
      if (!error) return json({ ok: true, code, expires_at, message: 'Enter this code in the Shortcut when it asks.' }, 201)
      if (error.code !== '23505') return fail(500, error.message)
    }
    return fail(500, 'Could not create a code. Try again.')
  }

  if (path !== '') return fail(404, 'Not found.')

  // ── GET: pending rows for this account ──
  if (req.method === 'GET') {
    const status = new URL(req.url).searchParams.get('status') ?? 'pending'
    const { data, error } = await db.from('import_inbox').select(SELECT).eq('user_id', identity.userId).eq('status', status).order('created_at', { ascending: true }).limit(50)
    if (error) return fail(500, error.message)
    return json({ items: data, message: `${data.length} waiting.` })
  }

  // ── PATCH: acknowledge rows ──
  if (req.method === 'PATCH') {
    const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50) : []
    const status = body?.status === 'failed' ? 'failed' : 'imported'
    if (ids.length === 0) return fail(400, 'ids required.')
    const patch: Record<string, unknown> = { status, imported_at: new Date().toISOString() }
    if (status === 'failed' && typeof body?.error === 'string') patch.error = body.error.slice(0, 300)
    const { error } = await db.from('import_inbox').update(patch).eq('user_id', identity.userId).in('id', ids)
    if (error) return fail(500, error.message)
    return json({ ok: true, updated: ids.length, message: 'Done.' })
  }

  if (req.method !== 'POST') return fail(405, 'Method not allowed.')

  // ── POST: share a link in ──
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) return fail(400, 'Share a link to save it.')
  const link = detectPlatform(rawUrl)
  if (!link) return fail(422, 'KABINET saves TikTok, Instagram and YouTube links for now.')
  const source = typeof body?.source === 'string' ? body.source.slice(0, 40) : identity.via === 'token' ? 'ios-shortcut' : 'web'

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('import_inbox').select('id', { count: 'exact', head: true }).eq('user_id', identity.userId).gte('created_at', since)
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) return fail(429, 'Too many saves this hour. Try again later.')

  const touch = identity.via === 'token' ? db.from('import_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', identity.tokenId) : Promise.resolve()

  const { data: existing } = await db.from('import_inbox').select(SELECT).eq('user_id', identity.userId).eq('canonical_url', link.canonicalUrl).neq('status', 'failed').maybeSingle()
  if (existing) {
    await touch
    return json({ ok: true, duplicate: true, item: existing, message: `Already in your Kabinet (${PLATFORM_LABEL[link.platform]}).` })
  }

  const m = await metadata(link)
  const row = {
    user_id: identity.userId,
    token_hash: identity.tokenHash,
    source,
    url: rawUrl.slice(0, 2000),
    canonical_url: link.canonicalUrl,
    platform: link.platform,
    source_id: m.sourceId,
    vertical: link.vertical,
    title: m.title,
    caption: m.caption,
    creator_name: m.creator,
    creator_url: m.creatorUrl,
    thumbnail_url: m.thumb,
    thumbnail_w: m.w,
    thumbnail_h: m.h,
    embed_url: embedUrlFor(link.platform, m.sourceId, link.canonicalUrl),
    access_note: m.note,
  }
  const what = m.title ?? PLATFORM_LABEL[link.platform]
  const savedMessage = `Saved to KABINET: ${what}${m.creator ? ` · ${m.creator}` : ''}`
  const { data, error } = await db.from('import_inbox').insert(row).select(SELECT).single()
  await touch
  if (error) {
    if (error.code === '23505') {
      // A row for this link exists. If the app marked it failed (e.g. cancelled), revive it with fresh metadata.
      const { data: dup } = await db.from('import_inbox').select(SELECT).eq('user_id', identity.userId).eq('canonical_url', link.canonicalUrl).maybeSingle()
      if (dup && dup.status === 'failed') {
        const { data: revived } = await db.from('import_inbox').update({ ...row, status: 'pending', error: null, imported_at: null, created_at: new Date().toISOString() }).eq('id', dup.id).select(SELECT).single()
        return json({ ok: true, duplicate: false, item: revived, message: savedMessage }, 201)
      }
      return json({ ok: true, duplicate: true, item: dup, message: `Already in your Kabinet (${PLATFORM_LABEL[link.platform]}).` })
    }
    return fail(500, error.message)
  }
  return json({ ok: true, duplicate: false, item: data, message: savedMessage }, 201)
})
