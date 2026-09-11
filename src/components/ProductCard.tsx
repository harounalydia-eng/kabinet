import { Link } from 'react-router'
import { cx } from '../lib/cx'
import { useStore } from '../lib/store'
import type { Product } from '../lib/types'
import { ProductImage } from './ProductImage'
import { PurchaseLink } from './PurchaseLink'

export interface ProductCardProps {
  product: Product
  onSave?: (product: Product) => void
  className?: string
  /** `tile` = photograph-led grid card (default). `row` = compact line for lists inside a look. */
  layout?: 'tile' | 'row'
}

export const price = (p: Product) => (p.price != null ? `${p.currency ?? '€'}${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}` : null)

/** A product, photograph first: packshot, brand, name, one quiet line of facts. */
export function ProductCard({ product, onSave, className, layout = 'tile' }: ProductCardProps) {
  const { saves, owned } = useStore()
  const saved = saves.some((s) => s.productId === product.id)
  const inKabinet = owned.some((o) => o.productId === product.id)
  const facts = [product.productType ?? product.category, price(product)].filter(Boolean).join(' · ')
  const href = `/product/${product.id}`
  const alt = `${product.brand} ${product.productName}`

  if (layout === 'row') {
    return (
      <article className={cx('flex items-center gap-md py-sm', className)}>
        <Link to={href} viewTransition className="w-[64px] shrink-0 overflow-hidden rounded-content">
          <ProductImage catalogProductId={product.catalogProductId} fallback={product.image} alt="" ratio="3/4" style={{ viewTransitionName: `p-${product.id}` }} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="type-eyebrow text-muted-foreground">{product.brand}</span>
          <Link to={href} viewTransition className="type-body-sm font-medium leading-snug text-foreground">{product.productName}</Link>
          <span className="type-meta text-muted-foreground">{inKabinet ? 'In your Kabinet ✓' : facts}</span>
        </div>
        {onSave && (
          <button type="button" onClick={() => onSave(product)} className="shrink-0 type-body-sm font-medium text-foreground">
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
      </article>
    )
  }

  return (
    <article className={cx('group flex flex-col gap-[8px]', className)}>
      <Link to={href} viewTransition className="block overflow-hidden rounded-content bg-muted transition-transform duration-(--motion-fast) ease-soft active:scale-[0.99]">
        <ProductImage catalogProductId={product.catalogProductId} fallback={product.image} alt={alt} ratio="3/4" className="transition-transform duration-(--motion-page) ease-soft group-hover:scale-[1.02]" style={{ viewTransitionName: `p-${product.id}` }} />
      </Link>
      <div className="flex flex-col gap-[2px] px-[2px]">
        <span className="type-eyebrow text-muted-foreground">{product.brand}</span>
        <Link to={href} viewTransition className="type-body-sm font-medium leading-snug text-foreground">{product.productName}</Link>
        <span className="type-meta text-muted-foreground">{inKabinet ? 'In your Kabinet ✓' : facts}</span>
        {(onSave || product.purchaseUrl) && (
          <div className="mt-[4px] flex items-center gap-md">
            {onSave && (
              <button type="button" onClick={() => onSave(product)} className="type-meta font-medium text-foreground">
                {saved ? 'Saved' : 'Save'}
              </button>
            )}
            <PurchaseLink product={product} className="type-meta text-muted-foreground hover:text-foreground" />
          </div>
        )}
      </div>
    </article>
  )
}
