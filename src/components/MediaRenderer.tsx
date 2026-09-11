import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { findProduct } from '../lib/catalog'
import type { FeedItem } from '../lib/feed'
import { useBlobUrl } from '../lib/images'
import type { ImageRef } from '../lib/types'
import { ImageView } from './ImageView'
import { ProductImage } from './ProductImage'

export type Media =
  | { kind: 'image'; image: ImageRef }
  | { kind: 'video'; id: string; w: number; h: number; poster?: string }
  | { kind: 'product'; catalogProductId?: string | null; imageUrl?: string | null; fallback?: ImageRef; w?: number; h?: number }

export interface MediaRendererProps {
  media: Media
  alt?: string
  className?: string
  style?: CSSProperties
  priority?: boolean
  /** Feeds: play muted while substantially visible, pause when scrolled away. Never more than one at once. */
  autoplay?: boolean
  /** Detail views: native controls, the person decides. */
  controls?: boolean
  fill?: boolean
}

/** What a feed tile shows for a saved thing or a look. Product saves lead with the product's photograph. */
export function mediaFor(item: FeedItem): Media {
  if (item.save?.productId) {
    const p = findProduct(item.save.productId)
    return { kind: 'product', catalogProductId: p?.catalogProductId, fallback: item.image, w: item.image.w, h: item.image.h }
  }
  if (item.image.kind === 'video') return { kind: 'video', id: item.image.id, w: item.image.w, h: item.image.h }
  return { kind: 'image', image: item.image }
}

export function MediaRenderer({ media, alt = '', className, style, priority = false, autoplay = false, controls = false, fill = false }: MediaRendererProps) {
  if (media.kind === 'product') {
    return <ProductImage catalogProductId={media.catalogProductId} imageUrl={media.imageUrl} fallback={media.fallback} alt={alt} className={className} style={style} priority={priority} fill={fill} ratio={media.fallback && !fill ? 'auto' : '3/4'} />
  }
  if (media.kind === 'video') return <InlineVideo id={media.id} w={media.w} h={media.h} poster={media.poster} className={className} style={style} autoplay={autoplay} controls={controls} fill={fill} />
  return <ImageView image={media.image} alt={alt} className={className} style={style} priority={priority} fill={fill} />
}

// ── Video ─────────────────────────────────────────────────────────────────────

/** Only one inline video plays at a time, anywhere on the page. */
let playing: HTMLVideoElement | null = null
function claim(el: HTMLVideoElement) {
  if (playing && playing !== el && !playing.paused) playing.pause()
  playing = el
}
function release(el: HTMLVideoElement) {
  if (playing === el) playing = null
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Plays when ≥ 60% of it is on screen (and the tab is visible), pauses when it leaves. */
function InlineVideo({ id, w, h, poster, className, style, autoplay, controls, fill }: { id: string; w: number; h: number; poster?: string; className?: string; style?: CSSProperties; autoplay: boolean; controls: boolean; fill: boolean }) {
  const url = useBlobUrl(id)
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const box = cx('relative w-full overflow-hidden bg-muted', fill && 'h-full', className)
  const boxStyle: CSSProperties = { ...(fill ? {} : { aspectRatio: `${w} / ${h}` }), ...style }

  useEffect(() => {
    const el = ref.current
    if (!el || !url) return
    const onPlay = () => claim(el)
    const onPause = () => release(el)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    if (!autoplay || reducedMotion()) return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
    }
    let visible = false
    const sync = () => {
      if (visible && document.visibilityState === 'visible') {
        claim(el)
        void el.play().catch(() => {})
      } else if (!el.paused) el.pause()
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.6
        sync()
      },
      { threshold: [0, 0.6, 1] },
    )
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.pause()
      release(el)
    }
  }, [url, autoplay])

  if (!url) return <div className={cx(box, 'img-skeleton')} style={boxStyle} aria-busy="true" />
  return (
    <div className={cx(box, !ready && !poster && 'img-skeleton')} style={boxStyle}>
      <video
        ref={ref}
        src={autoplay ? url : url + '#t=0.1'}
        poster={poster}
        muted
        playsInline
        loop={autoplay}
        preload="metadata"
        controls={controls}
        onLoadedData={() => setReady(true)}
        className={cx('absolute inset-0 size-full object-cover transition-opacity duration-200 ease-soft', ready || poster ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
