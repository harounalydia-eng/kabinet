import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import type { ImageRef } from '../lib/types'
import { useCatalogProduct } from '../lib/useCatalogProduct'
import { ImageView } from './ImageView'

export interface ProductImageProps {
  /** Canonical record; its image_url is the photograph. */
  catalogProductId?: string | null
  /** A known photograph URL (skips the catalog round trip). */
  imageUrl?: string | null
  /** What to show when there is no photograph: the product's own ImageRef (tone tile, user photo…). */
  fallback?: ImageRef
  alt?: string
  className?: string
  /** Box proportion. `auto` follows the fallback's own ratio. */
  ratio?: '3/4' | '4/5' | '1/1' | 'auto'
  /** Fill the parent instead of owning a ratio. */
  fill?: boolean
  priority?: boolean
  style?: CSSProperties
  /** Packshots sit inside the box; a user's own photo may fill it. */
  fit?: 'contain' | 'cover'
  /** Breathing room around a packshot. */
  inset?: boolean
}

const PLACEHOLDER: ImageRef = { kind: 'tone', tone: '#EBE5DB', tone2: '#DCD3C4', w: 600, h: 800 }
const RATIO: Record<Exclude<NonNullable<ProductImageProps['ratio']>, 'auto'>, string> = { '3/4': '3 / 4', '4/5': '4 / 5', '1/1': '1 / 1' }

/**
 * Renders the product's photograph. Resolution order: an explicit url → the catalog row's image_url →
 * the fallback ImageRef → KABINET's tone placeholder. A URL that fails to load falls through the same
 * chain, so a broken-image icon is never shown. Lazy by default, quiet skeleton while loading, soft
 * opacity reveal when the pixels arrive.
 */
export function ProductImage({ catalogProductId, imageUrl, fallback, alt = '', className, ratio = '3/4', fill = false, priority = false, style, fit = 'contain', inset = true }: ProductImageProps) {
  const { product, loading } = useCatalogProduct(imageUrl ? null : catalogProductId)
  // A `url` fallback is itself a photograph (e.g. the packshot snapshotted in the static catalog): show it at once,
  // then let the live catalog row replace it if it differs.
  const url = imageUrl ?? product?.image_url ?? (fallback?.kind === 'url' ? fallback.url : null)
  const [failed, setFailed] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    setLoaded(false)
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true)
  }, [url])

  const aspect = fill ? undefined : ratio === 'auto' ? (fallback ? `${fallback.w} / ${fallback.h}` : RATIO['3/4']) : RATIO[ratio]
  // Packshots mostly arrive on white; the near-white surface lets them sit in the box instead of on a sticker.
  const box = cx('relative w-full overflow-hidden', url ? 'bg-surface' : 'bg-muted', fill && 'h-full', className)
  const boxStyle: CSSProperties = { aspectRatio: aspect, ...style }

  if (url && failed !== url) {
    return (
      <div className={cx(box, !loaded && 'img-skeleton')} style={boxStyle}>
        <img
          ref={ref}
          src={url}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(url)}
          className={cx(
            'absolute inset-0 size-full transition-opacity duration-200 ease-soft',
            fit === 'contain' ? 'object-contain' : 'object-cover',
            fit === 'contain' && inset && 'p-[7%]',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      </div>
    )
  }
  if (loading && !fallback) return <div className={cx(box, 'img-skeleton')} style={boxStyle} aria-busy="true" />
  return <ImageView image={fallback && fallback.kind !== 'url' ? fallback : PLACEHOLDER} alt={alt} fill className={cx(box, 'h-auto')} style={boxStyle} priority={priority} />
}
