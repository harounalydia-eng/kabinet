import { Link, useLocation } from 'react-router'
import { ImageView } from './ImageView'
import { cx } from '../lib/cx'
import type { FeedItem } from '../lib/feed'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'

export interface InspirationCardProps {
  item: FeedItem
  index?: number
  onSave?: (item: FeedItem) => void
}

/**
 * Content is sharp, controls are soft. The image is the card; title, world and
 * a save action only surface on hover (desktop) — on touch, tap opens the look.
 */
export function InspirationCard({ item, index = 0, onSave }: InspirationCardProps) {
  const location = useLocation()
  const { settled } = useUI()
  const { collections } = useStore()
  const saved = item.save
  const collection = saved?.collectionId ? collections.find((c) => c.id === saved.collectionId) : undefined
  const meta = [item.category, item.subcategory].filter(Boolean).join(' · ')
  return (
    <Link
      to={item.href}
      state={{ from: location.pathname + location.search }}
      viewTransition
      aria-label={item.title ? `${item.title} — ${meta}` : meta}
      style={{ animationDelay: `${Math.min(index * 18, 280)}ms` }}
      className={cx(
        'group relative block w-full overflow-hidden rounded-[6px] bg-muted transition-transform duration-(--motion-fast) ease-soft active:scale-[0.99] sm:rounded-content',
        saved && settled.has(saved.id) ? 'tile-settle' : 'tile-in',
      )}
    >
      <ImageView image={item.image} alt={item.title ?? ''} className="transition-transform duration-(--motion-page) ease-soft group-hover:scale-[1.025]" style={{ viewTransitionName: `s-${item.id}` }} />

      {/* Hover layer — desktop only. Readability gradient stays subtle. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-(--motion-standard) ease-soft group-hover:opacity-100 [@media(hover:hover)]:block">
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-linear-to-t from-scrim/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[2px] p-sm">
          {item.title && <span className="type-body-sm font-medium leading-tight text-on-image">{item.title}</span>}
          <span className="type-micro text-on-image/80">{meta}</span>
        </div>
      </div>

      {(item.image.kind === 'video' || item.save?.social) && (
        <span aria-hidden="true" className="absolute top-[8px] right-[8px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-scrim/45 text-on-image">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1.5 0.8v6.4L7 4z" /></svg>
        </span>
      )}
      {onSave && (
        <button
          type="button"
          aria-label={saved ? 'Move to a collection' : 'Save'}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSave(item)
          }}
          className="absolute top-[8px] right-[8px] hidden h-[30px] items-center rounded-full bg-surface/95 px-[12px] type-body-sm font-medium text-foreground opacity-0 transition-[opacity,transform] duration-(--motion-standard) ease-soft group-hover:opacity-100 active:scale-[0.97] [@media(hover:hover)]:flex"
        >
          {saved ? (collection ? collection.title : 'Saved') : 'Save'}
        </button>
      )}
    </Link>
  )
}
