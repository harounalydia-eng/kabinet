import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { isDark, useBlobUrl } from '../lib/images'
import type { ImageRef } from '../lib/types'

export interface ImageViewProps {
  image: ImageRef
  alt?: string
  className?: string
  /** Ignore the image's own ratio and fill the parent box (collection covers). */
  fill?: boolean
  priority?: boolean
  /** How the label on an image-less object scales. */
  labelSize?: 'tile' | 'hero'
  /** Extra inline style on the outer box (used for view-transition-name). */
  style?: CSSProperties
  /** Render the baked-in label of an image-less object. Off in feeds — metadata lives in the hover layer. */
  showLabel?: boolean
}

/** Renders any ImageRef at its native proportions, with a soft fade-in on load. */
export function ImageView({ image, alt = '', className, fill = false, priority = false, labelSize = 'tile', style: extra, showLabel = false }: ImageViewProps) {
  const style: CSSProperties | undefined = { ...(fill ? {} : { aspectRatio: `${image.w} / ${image.h}` }), ...extra }
  const box = cx('relative w-full overflow-hidden bg-muted', fill && 'h-full', className)

  if (image.kind === 'tone') {
    return (
      <div className={box} style={{ ...style, background: `linear-gradient(160deg, ${image.tone} 0%, ${image.tone2 ?? image.tone} 100%)` }} role="img" aria-label={alt || image.label}>
        {showLabel && image.label && (
          <span
            className={cx(
              'absolute bottom-[14px] left-[16px]',
              labelSize === 'hero' ? 'type-h2' : 'type-tile',
              isDark(image.tone2 ?? image.tone) ? 'text-on-image' : 'text-on-image-ink',
            )}
          >
            {image.label}
          </span>
        )}
      </div>
    )
  }
  if (image.kind === 'url') return <Photo src={image.url} alt={alt} className={box} style={style} priority={priority} />
  if (image.kind === 'video') return <BlobVideo id={image.id} className={box} style={style} />
  return <BlobPhoto id={image.id} alt={alt} className={box} style={style} priority={priority} />
}

function BlobPhoto({ id, ...rest }: { id: string; alt: string; className: string; style?: CSSProperties; priority: boolean }) {
  const url = useBlobUrl(id)
  if (!url) return <div className={cx(rest.className, 'img-skeleton')} style={rest.style} aria-busy="true" />
  return <Photo src={url} {...rest} />
}

/** A saved video: muted, first frame as the still. `controls` only where the user is meant to watch it. */
export function BlobVideo({ id, className, style, controls = false }: { id: string; className: string; style?: CSSProperties; controls?: boolean }) {
  const url = useBlobUrl(id)
  if (!url) return <div className={cx(className, 'img-skeleton')} style={style} aria-busy="true" />
  return (
    <div className={className} style={style}>
      <video src={url + '#t=0.1'} muted playsInline preload="metadata" controls={controls} className="absolute inset-0 size-full object-cover" />
    </div>
  )
}

function Photo({ src, alt, className, style, priority }: { src: string; alt: string; className: string; style?: CSSProperties; priority: boolean }) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true)
  }, [src])
  return (
    <div className={cx(className, !loaded && 'img-skeleton')} style={style}>
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={cx('absolute inset-0 size-full object-cover transition-opacity duration-(--motion-standard) ease-soft', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
