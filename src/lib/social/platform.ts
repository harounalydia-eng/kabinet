/**
 * Phase 1 — platform detection and URL normalisation.
 * Recognises the common share-URL shapes of TikTok, Instagram and YouTube
 * (including Shorts and short links) and returns one canonical form.
 */
export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube'

export interface DetectedLink {
  platform: SocialPlatform
  /** Stable id on the platform when the URL carries one; short links may not. */
  sourceId: string | null
  /** Cleaned URL: https, no tracking params, canonical host where known. */
  canonicalUrl: string
  /** True for shorts / reels / TikTok — vertical video. */
  vertical: boolean
}

export const PLATFORM_LABEL: Record<SocialPlatform, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }

const strip = (u: URL) => {
  const keep = new Set(['v', 't'])
  for (const k of [...u.searchParams.keys()]) if (!keep.has(k)) u.searchParams.delete(k)
  u.hash = ''
  u.protocol = 'https:'
  return u
}

export function detectPlatform(raw: string): DetectedLink | null {
  let u: URL
  try {
    u = new URL(raw.trim().match(/^https?:\/\//i) ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www|m|vm|vt)\./, '').toLowerCase()
  const path = u.pathname.replace(/\/+$/, '')

  // ── TikTok ──
  if (host === 'tiktok.com') {
    const m = path.match(/^\/@[\w.-]+\/video\/(\d+)/) || path.match(/^\/(?:v|embed)\/(\d+)/)
    if (m) return { platform: 'tiktok', sourceId: m[1], canonicalUrl: strip(new URL(`https://www.tiktok.com${path}`)).toString(), vertical: true }
    const short = path.match(/^\/t\/([\w-]+)/) || (/^(vm|vt)\./.test(u.hostname) ? path.match(/^\/([\w-]+)/) : null)
    if (short) return { platform: 'tiktok', sourceId: null, canonicalUrl: strip(new URL(u.toString())).toString(), vertical: true }
    return null
  }

  // ── Instagram ──
  if (host === 'instagram.com' || host === 'instagr.am') {
    const m = path.match(/^\/(?:reel|reels|p|tv)\/([\w-]+)/) || path.match(/^\/[\w.]+\/(?:reel|p)\/([\w-]+)/)
    if (m) {
      const kind = /reel/.test(path) ? 'reel' : /\/tv\//.test(path) ? 'tv' : 'p'
      return { platform: 'instagram', sourceId: m[1], canonicalUrl: `https://www.instagram.com/${kind}/${m[1]}/`, vertical: kind === 'reel' }
    }
    return null
  }

  // ── YouTube ──
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const shorts = path.match(/^\/shorts\/([\w-]{6,})/)
    if (shorts) return { platform: 'youtube', sourceId: shorts[1], canonicalUrl: `https://www.youtube.com/shorts/${shorts[1]}`, vertical: true }
    const embed = path.match(/^\/(?:embed|v|live)\/([\w-]{6,})/)
    const v = u.searchParams.get('v')
    const id = v && /^[\w-]{6,}$/.test(v) ? v : embed?.[1]
    if (id) return { platform: 'youtube', sourceId: id, canonicalUrl: `https://www.youtube.com/watch?v=${id}`, vertical: false }
    return null
  }
  if (host === 'youtu.be') {
    const m = path.match(/^\/([\w-]{6,})/)
    if (m) return { platform: 'youtube', sourceId: m[1], canonicalUrl: `https://www.youtube.com/watch?v=${m[1]}`, vertical: false }
    return null
  }
  return null
}

export const isSupportedLink = (raw: string) => detectPlatform(raw) !== null
