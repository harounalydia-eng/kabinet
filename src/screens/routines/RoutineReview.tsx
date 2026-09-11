import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Header } from '../../components/Header'
import { ProductImage } from '../../components/ProductImage'
import { Sheet } from '../../components/Sheet'
import { cx } from '../../lib/cx'
import { lookupProduct, type CatalogProduct } from '../../lib/catalogProducts'
import { confirmProduct, getRoutine, PLATFORM_NAME, saveRoutine, type ImportedRoutine, type RoutineProduct } from '../../lib/routines/importApi'

/**
 * "Here's what I found." The person checks the extraction before it becomes theirs: every product shows
 * whether KABINET matched it (✓), has candidates to choose from (?), or could not find it yet.
 */
export default function RoutineReview() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<ImportedRoutine | null | undefined>(undefined)
  const [picking, setPicking] = useState<RoutineProduct | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => setData(await getRoutine(id).catch(() => null))
  useEffect(() => {
    void load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (data === undefined) return <p className="m-0 pt-lg type-body-sm text-muted-foreground">Loading…</p>
  if (!data) return <p className="m-0 pt-lg type-body-sm text-muted-foreground">This routine isn't available. <Link to="/routines/import" className="text-foreground">Import again</Link></p>

  const imp = data.import
  const creator = imp?.creator_handle ?? imp?.creator_name ?? null

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await saveRoutine(id)
      nav(`/routines/r/${id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Header eyebrow="Import" title="Here's what I found." sub="Check it before it goes in your routines. Tap a product marked ? to choose the right one." back="/routines/import" />

      <section className="flex flex-col gap-[6px]">
        <p className="m-0 type-eyebrow text-muted-foreground">Routine</p>
        <p className="m-0 type-h2 text-foreground">{data.routine.title}</p>
        {data.routine.description && <p className="m-0 type-body-sm text-muted-foreground">{data.routine.description}</p>}
        {data.routine.extraction_notes && <p className="m-0 type-meta text-muted-foreground">{data.routine.extraction_notes}</p>}
      </section>

      {imp && (
        <section className="mt-lg flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">Creator</p>
          <p className="m-0 type-body text-foreground">
            {creator ?? 'Unknown'} <span className="type-meta text-muted-foreground">· {PLATFORM_NAME[imp.platform]}</span>
          </p>
        </section>
      )}

      <section className="mt-lg flex flex-col gap-sm">
        <p className="m-0 type-eyebrow text-muted-foreground">Products · {data.products.length}</p>
        {data.products.length === 0 && <p className="m-0 type-body-sm text-muted-foreground">No products were named in what the platform shared.</p>}
        <ul className="m-0 flex list-none flex-col p-0">
          {data.products.map((p) => (
            <ProductRow key={p.id} product={p} catalog={data.catalog} onPick={() => setPicking(p)} />
          ))}
        </ul>
      </section>

      <section className="mt-lg flex flex-col gap-sm">
        <p className="m-0 type-eyebrow text-muted-foreground">Steps · {data.steps.length}</p>
        {data.steps.length === 0 && <p className="m-0 type-body-sm text-muted-foreground">No ordered steps were described — the products are listed without an order.</p>}
        <ol className="m-0 flex list-none flex-col gap-[6px] p-0">
          {data.steps.map((s) => (
            <li key={s.id} className="flex gap-sm type-body-sm text-foreground">
              <span className="type-eyebrow w-[22px] shrink-0 pt-[3px] text-muted-foreground">{String(s.step_number).padStart(2, '0')}</span>
              <span>{s.title ? <span className="font-medium">{s.title} · </span> : null}{s.instruction}</span>
            </li>
          ))}
        </ol>
      </section>

      {error && <p className="m-0 mt-md type-body-sm text-accent-text">{error}</p>}
      <div className="mt-xl flex flex-wrap items-center gap-sm">
        <Button variant="primary" disabled={busy} onClick={() => void confirm()}>Confirm routine</Button>
        <Link to="/routines/import" className="type-body-sm font-medium text-foreground">Import another</Link>
      </div>
      <p className="m-0 mt-md type-micro text-muted-foreground">Extracted from what {creator ?? 'the creator'} shared publicly. KABINET does not invent products: anything not named stays unresolved.</p>

      <ProductPicker product={picking} catalog={data.catalog} onClose={() => setPicking(null)} onDone={() => { setPicking(null); void load() }} />
    </div>
  )
}

const MARK: Record<RoutineProduct['resolution_status'], { glyph: string; label: string }> = {
  matched: { glyph: '✓', label: 'Matched' },
  manual: { glyph: '✓', label: 'You chose this' },
  possible_match: { glyph: '?', label: 'Is this right?' },
  unresolved: { glyph: '?', label: 'Not found yet' },
  none: { glyph: '·', label: 'Category only' },
}

function ProductRow({ product: p, catalog, onPick }: { product: RoutineProduct; catalog: Map<string, CatalogProduct>; onPick: () => void }) {
  const c = p.catalog_product_id ? catalog.get(p.catalog_product_id) : undefined
  const first = !c && p.candidate_ids[0] ? catalog.get(p.candidate_ids[0]) : undefined
  const raw = [p.raw_brand, p.raw_product_name, p.raw_variant].filter(Boolean).join(' ')
  const mark = MARK[p.resolution_status]
  const tappable = p.resolution_status !== 'none'
  return (
    <li className="flex items-center gap-md border-b border-border py-sm last:border-b-0">
      <button type="button" onClick={onPick} disabled={!tappable} className="flex min-w-0 flex-1 items-center gap-md text-left disabled:cursor-default">
        <span className={cx('flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full type-meta font-medium', mark.glyph === '✓' ? 'bg-foreground text-background' : 'bg-surface text-foreground')} aria-label={mark.label}>{mark.glyph}</span>
        <span className="w-[44px] shrink-0 overflow-hidden rounded-content bg-muted">
          <ProductImage imageUrl={c?.image_url ?? first?.image_url ?? null} ratio="3/4" fallback={undefined} alt="" />
        </span>
        <span className="flex min-w-0 flex-col gap-[1px]">
          {c ? (
            <>
              <span className="type-eyebrow text-muted-foreground">{c.brand ?? p.raw_brand ?? ''}</span>
              <span className="truncate type-body-sm font-medium text-foreground">{c.name}</span>
              {raw && raw.toLowerCase() !== `${c.brand ?? ''} ${c.name}`.toLowerCase().trim() && <span className="truncate type-micro text-muted-foreground">Creator said: “{raw}”</span>}
            </>
          ) : (
            <>
              <span className="type-eyebrow text-muted-foreground">{p.resolution_status === 'possible_match' && first ? 'Possible product' : mark.label}</span>
              <span className="truncate type-body-sm font-medium text-foreground">{p.resolution_status === 'possible_match' && first ? `${first.brand ?? ''} ${first.name}`.trim() : raw}</span>
              {p.resolution_status === 'possible_match' && first && <span className="truncate type-micro text-muted-foreground">Creator said: “{raw}” · tap to confirm</span>}
              {p.resolution_status === 'unresolved' && <span className="type-micro text-muted-foreground">Not in KABINET's catalog yet · tap to search</span>}
            </>
          )}
        </span>
      </button>
    </li>
  )
}

/** Choose the right catalog product for an extracted one: the pipeline's candidates first, then a search. */
function ProductPicker({ product, catalog, onClose, onDone }: { product: RoutineProduct | null; catalog: Map<string, CatalogProduct>; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  useEffect(() => {
    setQ(product ? [product.raw_brand, product.raw_product_name].filter(Boolean).join(' ') : '')
    setResults([])
    setNote(null)
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!product) return null
  const candidates = product.candidate_ids.map((id) => catalog.get(id)).filter((c): c is CatalogProduct => !!c)

  async function search() {
    if (!q.trim()) return
    setSearching(true)
    setNote(null)
    try {
      const r = await lookupProduct({ query: q.trim(), limit: 6 })
      setResults(r.products)
      if (!r.products.length) setNote('Nothing matching that in the catalog or Open Beauty Facts yet.')
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setSearching(false)
    }
  }
  async function choose(c: CatalogProduct | null) {
    setBusy(true)
    try {
      await confirmProduct(product!.id, c?.id ?? null)
      onDone()
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const Row = ({ c }: { c: CatalogProduct }) => (
    <button type="button" disabled={busy} onClick={() => void choose(c)} className="flex w-full items-center gap-md rounded-tile-sm py-[6px] text-left hover:bg-background">
      <span className="w-[40px] shrink-0 overflow-hidden rounded-content bg-muted"><ProductImage imageUrl={c.image_url} ratio="3/4" alt="" /></span>
      <span className="flex min-w-0 flex-col">
        <span className="type-eyebrow text-muted-foreground">{c.brand ?? ''}</span>
        <span className="truncate type-body-sm text-foreground">{c.name}</span>
      </span>
    </button>
  )
  return (
    <Sheet open onClose={onClose} label="Choose product">
      <div className="flex flex-col gap-lg">
        <div className="flex flex-col gap-[6px]">
          <p className="m-0 type-eyebrow text-muted-foreground">Which product is this?</p>
          <h2 className="m-0 type-h2 text-foreground">“{[product.raw_brand, product.raw_product_name, product.raw_variant].filter(Boolean).join(' ')}”</h2>
          {product.raw_text && <p className="m-0 type-meta text-muted-foreground">From: “{product.raw_text}”</p>}
        </div>
        {candidates.length > 0 && (
          <div className="flex flex-col gap-[4px]">
            <p className="m-0 type-eyebrow text-muted-foreground">KABINET's guesses</p>
            {candidates.map((c) => <Row key={c.id} c={c} />)}
          </div>
        )}
        <div className="flex flex-col gap-sm">
          <Field label="Search the catalog" on="surface" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} />
          <Button variant="secondary" on="surface" disabled={searching || !q.trim()} onClick={() => void search()}>{searching ? 'Searching…' : 'Search'}</Button>
          {results.map((c) => <Row key={c.id} c={c} />)}
          {note && <p className="m-0 type-meta text-muted-foreground">{note}</p>}
        </div>
        {product.catalog_product_id && (
          <button type="button" disabled={busy} onClick={() => void choose(null)} className="w-fit type-body-sm text-muted-foreground">Not this — leave unresolved</button>
        )}
      </div>
    </Sheet>
  )
}
