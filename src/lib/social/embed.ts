import type { SocialPlatform } from './platform'

/**
 * Playback the platforms support without downloading or re-hosting anything:
 * their own embed players. Null when the platform gives us no id to embed.
 */
export function embedUrlFor(platform: SocialPlatform, sourceId: string | null, canonicalUrl: string): string | null {
  if (platform === 'tiktok') return sourceId ? `https://www.tiktok.com/embed/v2/${sourceId}` : null
  if (platform === 'youtube') return sourceId ? `https://www.youtube-nocookie.com/embed/${sourceId}?autoplay=1&playsinline=1&rel=0` : null
  const m = canonicalUrl.match(/instagram\.com\/(reel|p|tv)\/([\w-]+)/)
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed/` : null
}
