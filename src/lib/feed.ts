import type { Category, ImageRef, Look, Save } from './types'

/** One thing the discovery grid can show: a save from your world or a look from Explore. */
export interface FeedItem {
  id: string
  category: Category
  subcategory?: string
  title?: string
  image: ImageRef
  href: string
  save?: Save
  look?: Look
}

export const fromSave = (save: Save): FeedItem => ({
  id: save.id,
  category: save.category,
  subcategory: save.subcategory,
  title: save.title ?? save.note ?? undefined,
  image: save.image,
  href: save.productId ? `/product/${save.productId}` : `/s/${save.id}`,
  save,
})

/** A look already in the world is shown as its save, so the grid never shows the same thing twice. */
export const fromLook = (look: Look, saves: Save[]): FeedItem => {
  const saved = saves.find((s) => s.lookId === look.id)
  return saved ? fromSave(saved) : { id: look.id, category: look.category, subcategory: look.subcategory, title: look.title, image: look.image, href: `/look/${look.id}`, look }
}

const STOP = new Set(['for', 'with', 'that', 'the', 'and', 'a', 'an', 'to', 'of', 'on', 'in', 'my', 'me', 'looks', 'look', 'works', 'work'])

export function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t && !STOP.has(t))
}

/** Natural-language friendly: every token scores, ranked by how many matched. */
export function score(hay: string, toks: string[]): number {
  const h = hay.toLowerCase()
  let n = 0
  for (const t of toks) if (h.includes(t) || (t.includes('-') && t.split('-').every((p) => h.includes(p)))) n++
  return n
}

export function haystack(x: Save | Look, collectionTitle?: string): string {
  return [
    x.title,
    x.description,
    x.category,
    x.subcategory,
    ...(x.tags ?? []),
    ...(x.products ?? []).flatMap((p) => [p.brand, p.productName, p.role, ...(p.ingredients ?? [])]),
    'note' in x ? x.note : '',
    collectionTitle,
    x.image.kind === 'tone' ? x.image.label : '',
  ]
    .filter(Boolean)
    .join(' ')
}
