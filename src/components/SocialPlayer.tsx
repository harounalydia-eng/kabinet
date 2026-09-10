import { useState, type CSSProperties } from 'react'
import { ImageView } from './ImageView'
import { PLATFORM_LABEL } from '../lib/social/platform'
import { embedUrlFor } from '../lib/social/embed'
import type { Save, SocialMeta } from '../lib/types'

/**
 * A saved social object is video. The poster shows first (cheap, no third-party
 * requests); a tap loads the platform's own embed player. Nothing is downloaded or
 * re-hosted, and when a platform gives us no embed the tap opens the original post.
 */
export function SocialPlayer({ save, social, style }: { save: Save; social: SocialMeta; style?: CSSProperties }) {
  const [playing, setPlaying] = useState(false)
  const canonical = social.canonicalUrl ?? save.source?.url ?? ''
  const embed = social.embedUrl ?? embedUrlFor(social.platform, social.sourceId, canonical)
  const label = PLATFORM_LABEL[social.platform]
  const aspect = `${save.image.w} / ${save.image.h}`

  if (playing && embed) {
    return (
      <div className="relative w-full overflow-hidden rounded-content bg-scrim" style={{ ...style, aspectRatio: aspect }}>
        <iframe
          src={embed}
          title={`${label} video${social.creatorName ? ` by ${social.creatorName}` : ''}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }

  const onPlay = () => {
    if (embed) setPlaying(true)
    else if (canonical) window.open(canonical, '_blank', 'noopener')
  }
  return (
    <div className="group relative w-full overflow-hidden rounded-content bg-muted" style={{ aspectRatio: aspect }}>
      <ImageView image={save.image} alt={save.title ?? `${label} video`} priority style={style} />
      <button
        type="button"
        onClick={onPlay}
        aria-label={embed ? `Play ${label} video` : `Watch on ${label}`}
        className="absolute inset-0 flex items-center justify-center bg-scrim/0 transition-colors duration-(--motion-fast) hover:bg-scrim/10"
      >
        <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-on-image/92 text-on-image-ink shadow-toolbar transition-transform duration-(--motion-fast) ease-soft group-active:scale-95">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><path d="M7 4.5v13l10-6.5z" /></svg>
        </span>
        {!embed && <span className="absolute bottom-[12px] rounded-full bg-on-image/92 px-[12px] py-[6px] type-meta font-medium text-on-image-ink">Watch on {label} ↗</span>}
      </button>
    </div>
  )
}
