import type { Product } from '../lib/types'

/** External purchase link. Names the retailer plainly; never the loudest thing on the card. */
export function PurchaseLink({ product, className }: { product: Product; className?: string }) {
  const href = product.affiliateUrl ?? product.purchaseUrl
  if (!href) return product.retailer ? <span className={className}>{product.retailer}</span> : null
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      Buy at {product.retailer ?? 'retailer'} →
    </a>
  )
}
