import { Link } from 'react-router'
import { ImageView } from './ImageView'
import { PurchaseLink } from './PurchaseLink'
import { cx } from '../lib/cx'
import { useStore } from '../lib/store'
import type { Product } from '../lib/types'

export interface ProductCardProps {
  product: Product
  onSave?: (product: Product) => void
  className?: string
}

export const price = (p: Product) => (p.price != null ? `${p.currency ?? '€'}${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}` : null)

/** A product, editorially: image, brand, name, one line of facts. View · Save · retailer link. */
export function ProductCard({ product, onSave, className }: ProductCardProps) {
  const { saves, owned } = useStore()
  const saved = saves.some((s) => s.productId === product.id)
  const inKabinet = owned.some((o) => o.productId === product.id)
  const facts = [product.category, product.productType, price(product)].filter(Boolean).join(' · ')
  return (
    <article className={cx('flex gap-md py-md', className)}>
      <Link to={`/product/${product.id}`} viewTransition className="w-[72px] shrink-0 overflow-hidden rounded-content bg-muted">
        {product.image ? <ImageView image={product.image} alt="" style={{ viewTransitionName: `p-${product.id}` }} /> : <div className="aspect-[3/4]" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="type-eyebrow text-muted-foreground">{product.brand}</span>
        <Link to={`/product/${product.id}`} viewTransition className="type-h3 text-foreground">{product.productName}</Link>
        <span className="type-meta text-muted-foreground">{facts}</span>
        {inKabinet && <span className="type-meta text-foreground">In your Kabinet ✓</span>}
        <div className="mt-xs flex flex-wrap items-center gap-x-md gap-y-xs">
          <Link to={`/product/${product.id}`} viewTransition className="type-body-sm font-medium text-foreground">View product</Link>
          {onSave && (
            <button type="button" onClick={() => onSave(product)} className="type-body-sm font-medium text-foreground">
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
          <PurchaseLink product={product} className="type-body-sm text-muted-foreground hover:text-foreground" />
        </div>
      </div>
    </article>
  )
}
