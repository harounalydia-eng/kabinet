// KABINET — import
// POST  /functions/v1/import        { url, source? }          ← iOS Shortcut / share sheet
// GET   /functions/v1/import?status=pending                   ← the app pulls what was shared
// PATCH /functions/v1/import        { ids, status, error? }   ← the app acknowledges rows
//
// Auth: a device token the app generates (Settings → Import from iPhone), sent as
// `Authorization: Bearer kbt_…` (or `x-kabinet-token`, or `token` in the POST body).
// Only a SHA-256 of the token is stored. Deployed with JWT verification off because
// this header carries the device token, not a Supabase JWT.
//
// Metadata comes from the platforms' public oEmbed endpoints only — no scraping, no keys.
// What is saved is VIDEO CONTENT: platform, source + canonical URL, creator, caption, poster and the
// platform's embed URL. Nothing is downloaded or re-hosted; no AI, transcription or product identification runs here.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { detectPlatform, PLATFORM_LABEL, type DetectedLink } from './platform.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-kabinet-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const TOKEN_RE = /^kbt_[A-Za-z0-9_-]{32,64}$/
const RATE_LIMIT_PER_HOUR = 60
const SELECT = 'id, source, url, canonical_url, platform, source_id, vertical, title, caption, creator_name, creator_url, thumbnail_url, thumbnail_w, thumbnail_h, embed_url, access_note, status, error, created_at, imported_at'

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function tokenFrom(req: Request, body: Record<string, unknown> | null): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const t = (TOKEN_RE.test(bearer) && bearer) || req.headers.get('x-kabinet-token') || (typeof body?.token === 'string' ? body.token : null)
  return t && TOKEN_RE.test(t) ? t : null
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
  if (!url || !service) return json({ error: 'Import is not configured on the server.' }, 503)
  const db = createClient(url, service, { auth: { persistSession: false } })

  let body: Record<string, unknown> | null = null
  if (req.method === 'POST' || req.method === 'PATCH') {
    const raw = await req.text()
    if (raw.length > 8_000) return json({ error: 'Request body too large.' }, 413)
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    } catch {
      return json({ error: 'Body must be JSON.' }, 400)
    }
  }

  const token = tokenFrom(req, body)
  if (!token) return json({ error: 'Missing or malformed device token. Copy it from KABINET → Settings → Import from iPhone.' }, 401)
  const tokenHash = await sha256(token)

  // ── GET: pending rows for this device ──
  if (req.method === 'GET') {
    const status = new URL(req.url).searchParams.get('status') ?? 'pending'
    const { data, error } = await db.from('import_inbox').select(SELECT).eq('token_hash', tokenHash).eq('status', status).order('created_at', { ascending: true }).limit(50)
    if (error) return json({ error: error.message }, 500)
    return json({ items: data })
  }

  // ── PATCH: acknowledge rows ──
  if (req.method === 'PATCH') {
    const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50) : []
    const status = body?.status === 'failed' ? 'failed' : 'imported'
    if (ids.length === 0) return json({ error: 'ids required.' }, 400)
    const patch: Record<string, unknown> = { status, imported_at: new Date().toISOString() }
    if (status === 'failed' && typeof body?.error === 'string') patch.error = body.error.slice(0, 300)
    const { error } = await db.from('import_inbox').update(patch).eq('token_hash', tokenHash).in('id', ids)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, updated: ids.length })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // ── POST: share a link in ──
  const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) return json({ error: 'url is required.' }, 400)
  const link = detectPlatform(rawUrl)
  if (!link) return json({ error: 'Only TikTok, Instagram and YouTube links can be imported.' }, 422)
  const source = typeof body?.source === 'string' ? body.source.slice(0, 40) : 'unknown'

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('import_inbox').select('id', { count: 'exact', head: true }).eq('token_hash', tokenHash).gte('created_at', since)
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) return json({ error: 'Too many imports this hour. Try again later.' }, 429)

  const { data: existing } = await db.from('import_inbox').select(SELECT).eq('token_hash', tokenHash).eq('canonical_url', link.canonicalUrl).neq('status', 'failed').maybeSingle()
  if (existing) return json({ ok: true, duplicate: true, item: existing, message: `Already in KABINET (${PLATFORM_LABEL[link.platform]}).` })

  const m = await metadata(link)
  const row = {
    token_hash: tokenHash,
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
  const { data, error } = await db.from('import_inbox').insert(row).select(SELECT).single()
  if (error) {
    if (error.code === '23505') {
      // A row for this link exists. If the app marked it failed (e.g. cancelled), revive it with fresh metadata.
      const { data: dup } = await db.from('import_inbox').select(SELECT).eq('token_hash', tokenHash).eq('canonical_url', link.canonicalUrl).maybeSingle()
      if (dup && dup.status === 'failed') {
        const { data: revived } = await db.from('import_inbox').update({ ...row, status: 'pending', error: null, imported_at: null, created_at: new Date().toISOString() }).eq('id', dup.id).select(SELECT).single()
        return json({ ok: true, duplicate: false, item: revived, message: `Saved to KABINET: ${m.title ?? PLATFORM_LABEL[link.platform]}. Open the app to see it.` }, 201)
      }
      return json({ ok: true, duplicate: true, item: dup, message: `Already in KABINET (${PLATFORM_LABEL[link.platform]}).` })
    }
    return json({ error: error.message }, 500)
  }
  const what = m.title ?? PLATFORM_LABEL[link.platform]
  return json({ ok: true, duplicate: false, item: data, message: `Saved to KABINET: ${what}${m.creator ? ` · ${m.creator}` : ''}. Open the app to see it.` }, 201)
})
