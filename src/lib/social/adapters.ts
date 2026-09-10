import { embedUrlFor } from './embed'
import { PLATFORM_LABEL, type DetectedLink, type SocialPlatform } from './platform'

/**
 * Phase 3 — every platform is normalised into the same shape. Fields are null when
 * a platform does not expose them; the rest of KABINET never sees platform specifics.
 */
export interface NormalizedSocialContent {
  platform: SocialPlatform
  sourceUrl: string
  sourceId: string | null
  title: string | null
  description: string | null
  caption: string | null
  transcript: string | null
  thumbnailUrl: string | null
  thumbnailWidth: number | null
  thumbnailHeight: number | null
  creatorName: string | null
  creatorUrl: string | null
  /** Platform embed/playback URL — the saved object is video, the thumbnail only its poster. */
  embedUrl: string | null
  vertical: boolean
  duration: number | null
  publishedAt: string | null
  /** Everything textual we legitimately have, joined — Level 1 input for extraction. */
  availableText: string
  /** What the adapter could and could not get, for honest UI. */
  access: { metadata: boolean; text: boolean; transcript: boolean; note?: string }
}

export interface SocialVideoAdapter {
  platform: SocialPlatform
  /** Metadata we are allowed to read from the browser without keys. Never scrapes. */
  fetchMetadata(link: DetectedLink, signal?: AbortSignal): Promise<NormalizedSocialContent>
}

const base = (link: DetectedLink): NormalizedSocialContent => ({
  platform: link.platform,
  sourceUrl: link.canonicalUrl,
  sourceId: link.sourceId,
  title: null,
  description: null,
  caption: null,
  transcript: null,
  thumbnailUrl: null,
  thumbnailWidth: null,
  thumbnailHeight: null,
  creatorName: null,
  creatorUrl: null,
  embedUrl: embedUrlFor(link.platform, link.sourceId, link.canonicalUrl),
  vertical: link.vertical,
  duration: null,
  publishedAt: null,
  availableText: '',
  access: { metadata: false, text: false, transcript: false },
})

const joinText = (c: NormalizedSocialContent) => [c.title, c.caption, c.description, c.transcript].filter((t): t is string => Boolean(t && t.trim())).join('\n')

interface OEmbed {
  title?: string
  author_name?: string
  author_url?: string
  /** TikTok: the video id, also for short links that do not carry it. */
  embed_product_id?: string
  thumbnail_url?: string
  thumbnail_width?: number | string
  thumbnail_height?: number | string
}

async function oembed(endpoint: string, signal?: AbortSignal): Promise<OEmbed> {
  const res = await fetch(endpoint, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`The platform did not return details for this link (${res.status}).`)
  return (await res.json()) as OEmbed
}

/** TikTok: public oEmbed answers browsers directly. Title is the caption; no transcript is exposed. */
export const TikTokAdapter: SocialVideoAdapter = {
  platform: 'tiktok',
  async fetchMetadata(link, signal) {
    const c = base(link)
    try {
      const o = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}`, signal)
      c.caption = o.title ?? null
      c.title = o.title ? o.title.split(/[\n#]/)[0].trim() || null : null
      c.creatorName = o.author_name ?? null
      c.creatorUrl = o.author_url ?? null
      if (!c.sourceId && o.embed_product_id && /^\d+$/.test(o.embed_product_id)) {
        c.sourceId = o.embed_product_id
        c.embedUrl = embedUrlFor('tiktok', c.sourceId, link.canonicalUrl)
      }
      c.thumbnailUrl = o.thumbnail_url ?? null
      c.thumbnailWidth = Number(o.thumbnail_width) || null
      c.thumbnailHeight = Number(o.thumbnail_height) || null
      c.access = { metadata: true, text: Boolean(c.caption), transcript: false, note: 'TikTok exposes the caption and thumbnail publicly; spoken words are not available.' }
    } catch (e) {
      c.access = { metadata: false, text: false, transcript: false, note: e instanceof Error ? e.message : 'Could not reach TikTok.' }
    }
    c.availableText = joinText(c)
    return c
  },
}

/** YouTube: public oEmbed answers browsers directly with title, channel and thumbnail. Description and captions need the Data API (server-side key). */
export const YouTubeAdapter: SocialVideoAdapter = {
  platform: 'youtube',
  async fetchMetadata(link, signal) {
    const c = base(link)
    try {
      const o = await oembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(link.canonicalUrl)}&format=json`, signal)
      c.title = o.title ?? null
      c.creatorName = o.author_name ?? null
      c.creatorUrl = o.author_url ?? null
      c.thumbnailUrl = link.sourceId ? `https://i.ytimg.com/vi/${link.sourceId}/hqdefault.jpg` : o.thumbnail_url ?? null
      c.thumbnailWidth = 480
      c.thumbnailHeight = 360
      c.access = { metadata: true, text: Boolean(c.title), transcript: false, note: 'YouTube exposes the title and thumbnail publicly. The description and captions need a server-side Data API key.' }
    } catch (e) {
      c.access = { metadata: false, text: false, transcript: false, note: e instanceof Error ? e.message : 'Could not reach YouTube.' }
    }
    c.availableText = joinText(c)
    return c
  },
}

/** Instagram: no public metadata without an approved Meta app token, and scraping is prohibited. We keep the link and say so. */
export const InstagramAdapter: SocialVideoAdapter = {
  platform: 'instagram',
  async fetchMetadata(link) {
    const c = base(link)
    c.access = { metadata: false, text: false, transcript: false, note: 'Instagram does not expose captions or thumbnails without an approved Meta app. The link is saved; add the caption yourself if you want a routine from it.' }
    return c
  },
}

const ADAPTERS: Record<SocialPlatform, SocialVideoAdapter> = { tiktok: TikTokAdapter, youtube: YouTubeAdapter, instagram: InstagramAdapter }

export function adapterFor(platform: SocialPlatform): SocialVideoAdapter {
  return ADAPTERS[platform]
}

export const platformLabel = (p: SocialPlatform) => PLATFORM_LABEL[p]
