/* FUTURE — not used by any screen in this version. Kept as the shape of ownership intelligence
   for when My Kabinet data and similarity logic actually support it. */
import type { OwnedProduct, Product } from './types'

export interface RecreatePlan {
  /** Products in the look the user already owns (exact brand + name). */
  owned: Array<{ product: Product; owned: OwnedProduct }>
  /** Products where something on the shelf plays the same role. */
  alternatives: Array<{ product: Product; owned: OwnedProduct }>
  /** Nothing on the shelf covers this role. */
  missing: Product[]
  total: number
}

const norm = (s: string) => s.trim().toLowerCase()

/** Use what you own first: exact matches, then same-role alternatives, then what is genuinely missing. */
export function planRecreate(products: Product[] | undefined, shelf: OwnedProduct[]): RecreatePlan {
  const plan: RecreatePlan = { owned: [], alternatives: [], missing: [], total: products?.length ?? 0 }
  for (const product of products ?? []) {
    const exact = shelf.find((o) => norm(o.brand) === norm(product.brand) && norm(o.productName) === norm(product.productName))
    if (exact) {
      plan.owned.push({ product, owned: exact })
      continue
    }
    const byId = product.ownedAlternative ? shelf.find((o) => o.id === product.ownedAlternative) : undefined
    const byRole = product.role ? shelf.find((o) => o.role === product.role) : undefined
    const alt = byId ?? byRole
    if (alt) plan.alternatives.push({ product, owned: alt })
    else plan.missing.push(product)
  }
  return plan
}
