import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CategoryFilter } from '../components/CategoryFilter'
import { ContextualSearch, useSearchContext } from '../components/ContextualSearch'
import { DiscoveryGrid } from '../components/DiscoveryGrid'
import { INTENTS } from '../components/DiscoverySearch'
import { ProductImage } from '../components/ProductImage'
import { CollectionCover } from '../components/CollectionCover'
import { CATALOG, PRODUCTS } from '../lib/catalog'
import { RoutineCard } from '../components/RoutineCard'
import { ProductCard } from '../components/ProductCard'
import { fromLook, fromSave, haystack, score, tokens } from '../lib/feed'
import { useFeed, useStore } from '../lib/store'
import type { Category } from '../lib/types'

/** Search, scoped to where the user came from. Keyword search filters real data; ranking is token-based so natural language degrades gracefully. */
export default function Search() {
  const feed = useFeed()
  const { collections, owned, routines } = useStore()
  const ctx = useSearchContext()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const cat = (params.get('cat') as Category | null) ?? 'All'
  const toks = tokens(q)
  const searching = toks.length > 0

  const setCat = (c: Category | 'All') => {
    const next = new URLSearchParams(params)
    if (c === 'All') next.delete('cat')
    else next.set('cat', c)
    setParams(next, { replace: true })
  }
  const inCat = (c?: Category) => cat === 'All' || c === cat
  const rank = <T,>(list: T[], hay: (x: T) => string) =>
    toks.length === 0 ? list : list.map((x) => ({ x, n: score(hay(x), toks) })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).map((r) => r.x)

  const titles = useMemo(() => new Map(collections.map((c) => [c.id, c.title])), [collections])
  const mine = useMemo(() => rank(feed.filter((s) => inCat(s.category)), (s) => haystack(s, s.collectionId ? titles.get(s.collectionId) : undefined)).map(fromSave), [feed, titles, q, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const more = useMemo(() => {
    const savedIds = new Set(feed.map((s) => s.lookId).filter(Boolean))
    return rank(CATALOG.filter((l) => !savedIds.has(l.id) && inCat(l.category)), (l) => haystack(l)).map((l) => fromLook(l, feed))
  }, [feed, q, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const cols = useMemo(() => rank(collections, (c) => `${c.title} ${c.description ?? ''} ${feed.filter((s) => s.collectionId === c.id).map((s) => haystack(s)).join(' ')}`), [collections, feed, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const rts = useMemo(() => rank(routines.filter((r) => inCat(r.category)), (r) => `${r.title} ${r.category} ${r.description ?? ''} ${r.steps.map((st) => `${st.title} ${st.description ?? ''} ${st.productBrand ?? ''} ${st.productName ?? ''}`).join(' ')}`), [routines, q, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const shop = useMemo(() => rank(PRODUCTS.filter((p) => inCat(p.category)), (p) => `${p.brand} ${p.productName} ${p.category ?? ''} ${p.productType ?? ''} ${(p.ingredients ?? []).join(' ')}`), [q, cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const shelf = useMemo(() => rank(owned.filter((o) => inCat(o.category)), (o) => `${o.brand} ${o.productName} ${o.category ?? ''} ${o.role ?? ''}`), [owned, q, cat]) // eslint-disable-line react-hooks/exhaustive-deps

  const nothing =
    (ctx.scope === 'saves' && mine.length === 0) ||
    (ctx.scope === 'explore' && mine.length === 0 && more.length === 0) ||
    (ctx.scope === 'collections' && cols.length === 0) ||
    (ctx.scope === 'kabinet' && shelf.length === 0) ||
    (ctx.scope === 'routines' && rts.length === 0) ||
    (ctx.scope === 'shop' && shop.length === 0)

  return (
    <>
      <div className="flex items-center gap-[4px] pb-md sm:hidden">
        <button type="button" onClick={() => window.history.back()} aria-label="Back" className="-ml-[4px] flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-foreground">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12.5 4 6.5 10l6 6" /></svg>
        </button>
        <ContextualSearch autoFocus className="flex-1" />
      </div>
      <div className="hidden pt-[10px] sm:block" />

      {!searching && (
        <div className="mb-md flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">Try asking</p>
          <div className="no-scrollbar -mx-lg flex gap-[6px] overflow-x-auto px-lg lg:mx-0 lg:flex-wrap lg:px-0">
            {INTENTS.map((s) => (
              <Link key={s} to={`/search?q=${encodeURIComponent(s)}&scope=explore`} className="inline-flex h-[32px] shrink-0 items-center rounded-full bg-surface px-[12px] type-body-sm text-muted-foreground transition-colors duration-(--motion-fast) hover:text-foreground">
                {s}
              </Link>
            ))}
          </div>
        </div>
      )}

      {ctx.scope !== 'collections' && <CategoryFilter value={cat} onChange={setCat} leading={[{ value: 'All', label: 'All' }]} className="mb-[28px]" />}

      {nothing ? (
        <p className="m-0 type-body-sm text-muted-foreground">Nothing in {ctx.label} matches that yet.</p>
      ) : (
        <div className="flex flex-col gap-xl">
          {(ctx.scope === 'saves' || ctx.scope === 'explore') && mine.length > 0 && (
            <section className="flex flex-col gap-sm">
              <p className="m-0 type-eyebrow text-muted-foreground">In your world · {mine.length}</p>
              <DiscoveryGrid items={mine} revealKey={`${cat}|${q}`} />
            </section>
          )}
          {ctx.scope === 'explore' && more.length > 0 && (
            <section className="flex flex-col gap-sm">
              <p className="m-0 type-eyebrow text-muted-foreground">{searching ? `From Explore · ${more.length}` : 'Explore'}</p>
              <DiscoveryGrid items={more} revealKey={`x|${cat}|${q}`} />
            </section>
          )}
          {ctx.scope === 'collections' && (
            <section className="grid grid-cols-2 gap-x-[6px] gap-y-lg md:grid-cols-3 md:gap-x-[10px] xl:grid-cols-5">
              {cols.map((c) => (
                <CollectionCover key={c.id} collection={c} saves={feed.filter((s) => s.collectionId === c.id)} />
              ))}
            </section>
          )}
          {ctx.scope === 'routines' && (
            <section className="grid grid-cols-2 gap-x-[6px] gap-y-lg md:grid-cols-3 md:gap-x-[10px] xl:grid-cols-5">
              {rts.map((r) => (
                <RoutineCard key={r.id} routine={r} />
              ))}
            </section>
          )}
          {ctx.scope === 'shop' && (
            <section className="grid grid-cols-2 gap-x-[10px] gap-y-lg sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shop.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </section>
          )}
          {ctx.scope === 'kabinet' && (
            <section className="flex flex-col gap-xs lg:max-w-[720px]">
              <p className="m-0 type-eyebrow text-muted-foreground">On your shelf · {shelf.length}</p>
              {shelf.map((o) => (
                <Link key={o.id} to="/kabinet" className="flex items-center gap-md py-[6px]">
                  <div className="w-[44px] shrink-0 overflow-hidden rounded-content bg-muted"><ProductImage catalogProductId={o.catalogProductId} fallback={o.image} ratio="3/4" /></div>
                  <div className="flex min-w-0 flex-col">
                    <span className="type-eyebrow text-muted-foreground">{o.brand}</span>
                    <span className="type-body text-foreground">{o.productName}</span>
                    {o.role && <span className="type-meta text-muted-foreground">{o.role}</span>}
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </>
  )
}
