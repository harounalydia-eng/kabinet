import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Header } from '../../components/Header'
import { ImageView } from '../../components/ImageView'
import { ProductImage } from '../../components/ProductImage'
import { cx } from '../../lib/cx'
import type { CatalogProduct } from '../../lib/catalogProducts'
import { getRoutine, PLATFORM_NAME, ROUTINE_TYPE_LABEL, saveRoutine, unsaveRoutine, type ImportedRoutine as Imported, type RoutineProduct } from '../../lib/routines/importApi'
import { useStore } from '../../lib/store'
import type { Category } from '../../lib/types'

const PILL = 'inline-flex h-[38px] items-center rounded-full px-[16px] type-body-sm font-medium whitespace-nowrap transition-transform duration-(--motion-fast) ease-soft active:scale-[0.98] disabled:opacity-50'
const CHECK_URL = (import.meta.env.VITE_KABINET_CHECK_URL as string | undefined)?.trim() || null
const SOURCE_LABEL: Record<string, string> = { open_beauty_facts: 'Open Beauty Facts', open_food_facts: 'Open Food Facts', brand: 'the brand', retailer: 'the retailer' }
const CAT: Record<string, Category> = { skin: 'Skin', hair: 'Hair', makeup: 'Makeup', nails: 'Nails', body: 'Body', wellness: 'Wellness' }

/**
 * A beauty recipe. Title, the creator it came from, the original post, then the products (with the catalog's
 * photograph and label data when it has them) and the steps in the creator's order. The creator stays visible.
 */
export default function ImportedRoutine() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { owned, addOwned } = useStore()
  const [data, setData] = useState<Imported | null | undefined>(undefined)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void getRoutine(id).then((d) => live && setData(d)).catch(() => live && setData(null))
    return () => {
      live = false
    }
  }, [id])

  if (data === undefined) return <p className="m-0 pt-lg type-body-sm text-muted-foreground">Loading…</p>
  if (!data) return <p className="m-0 pt-lg type-body-sm text-muted-foreground">This routine isn't available. <Link to="/routines" className="text-foreground">Back to routines</Link></p>

  const imp = data.import
  const creator = imp?.creator_handle ?? imp?.creator_name ?? null
  const platform = imp ? PLATFORM_NAME[imp.platform] : null
  const resolved = data.products.filter((p) => p.catalog_product_id && data.catalog.get(p.catalog_product_id))
  const addable = resolved.filter((p) => !owned.some((o) => o.catalogProductId === p.catalog_product_id))
  const sources = new Set(resolved.map((p) => data.catalog.get(p.catalog_product_id!)?.source).filter((s): s is string => !!s && !!SOURCE_LABEL[s]))

  async function toggleSave() {
    setBusy(true)
    setNote(null)
    try {
      if (data!.saved) await unsaveRoutine(id)
      else await saveRoutine(id)
      setData({ ...data!, saved: !data!.saved })
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  async function addAllToKabinet() {
    setBusy(true)
    try {
      for (const p of addable) {
        const c = data!.catalog.get(p.catalog_product_id!)!
        await addOwned({ brand: c.brand ?? p.raw_brand ?? '', productName: c.name, category: c.category ? CAT[c.category] : undefined, catalogProductId: c.id, image: c.image_url ? { kind: 'url', url: c.image_url, w: 600, h: 800 } : { kind: 'tone', tone: '#EBE5DB', tone2: '#DCD3C4', w: 600, h: 800 } })
      }
      setNote(addable.length ? `Added ${addable.length} to your Kabinet.` : 'Everything matched is already in your Kabinet.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <Header
        eyebrow={[data.routine.routine_type ? ROUTINE_TYPE_LABEL[data.routine.routine_type] : null, creator ? `extracted from ${creator}` : null].filter(Boolean).join(' · ')}
        title={data.routine.title}
        sub={data.routine.description ?? undefined}
        onBack={() => nav(-1)}
      />

      {imp && (
        <section className="flex flex-col gap-sm">
          <div className="flex flex-wrap items-baseline gap-x-sm gap-y-[2px]">
            <p className="m-0 type-body text-foreground">
              by {imp.creator_profile_url ? <a href={imp.creator_profile_url} target="_blank" rel="noreferrer" className="font-medium">{creator}</a> : <span className="font-medium">{creator ?? 'unknown creator'}</span>}
            </p>
            <p className="m-0 type-meta text-muted-foreground">{platform}</p>
            <a href={imp.source_url} target="_blank" rel="noreferrer" className="type-meta text-foreground">View original ↗</a>
          </div>
          {(imp.thumbnail_url || imp.embed_url) && (
            <div className="w-full max-w-[380px] overflow-hidden rounded-content bg-muted" style={{ aspectRatio: imp.thumbnail_w && imp.thumbnail_h ? `${imp.thumbnail_w} / ${imp.thumbnail_h}` : imp.platform === 'youtube' ? '16 / 9' : '9 / 16' }}>
              {playing && imp.embed_url ? (
                <iframe src={imp.embed_url} title={`${platform} video by ${creator ?? 'creator'}`} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
              ) : (
                <button type="button" onClick={() => (imp.embed_url ? setPlaying(true) : window.open(imp.source_url, '_blank', 'noopener'))} aria-label={`Play ${platform} video`} className="relative block h-full w-full">
                  {imp.thumbnail_url && <ImageView fill image={{ kind: 'url', url: imp.thumbnail_url, w: imp.thumbnail_w ?? 16, h: imp.thumbnail_h ?? 9 }} alt="" />}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-on-image/92 text-on-image-ink shadow-toolbar">
                      <svg width="20" height="20" viewBox="0 0 22 22" fill="currentColor" aria-hidden="true"><path d="M7 4.5v13l10-6.5z" /></svg>
                    </span>
                  </span>
                </button>
              )}
            </div>
          )}
          {data.routine.skin_hair_context && <p className="m-0 type-meta text-muted-foreground">{creator ?? 'The creator'} on their own skin/hair: “{data.routine.skin_hair_context}”</p>}
        </section>
      )}

      <div className="mt-lg flex flex-wrap items-center gap-[8px]">
        <button type="button" disabled={busy} onClick={() => void toggleSave()} className={cx(PILL, data.saved ? 'bg-surface text-foreground' : 'bg-primary text-primary-foreground')}>{data.saved ? 'Saved ✓' : 'Save routine'}</button>
        {resolved.length > 0 && (
          <button type="button" disabled={busy || addable.length === 0} onClick={() => void addAllToKabinet()} className={cx(PILL, 'bg-surface text-foreground')}>
            {addable.length === 0 ? 'Products in your Kabinet ✓' : `Add ${addable.length === resolved.length ? 'products' : `${addable.length} products`} to My Kabinet`}
          </button>
        )}
        {CHECK_URL && resolved.length > 0 && (
          <a href={`${CHECK_URL}/check`} target="_blank" rel="noreferrer" className={cx(PILL, 'bg-surface text-foreground')}>Check products with KABINET</a>
        )}
        <span className="inline-flex items-center gap-[6px] type-body-sm text-muted-foreground" title="Coming once KABINET knows your skin, hair and shelf">
          Adapt routine for me <span className="type-micro">· soon</span>
        </span>
      </div>
      {note && <p className="m-0 mt-sm type-body-sm text-muted-foreground">{note}</p>}

      <section className="mt-2xl flex flex-col gap-md">
        <p className="m-0 type-eyebrow text-muted-foreground">Products · {data.products.length}</p>
        {data.products.length === 0 && <p className="m-0 type-body-sm text-muted-foreground">No products were named in what {creator ?? 'the creator'} shared.</p>}
        <div className="flex flex-col">
          {data.products.map((p) => (
            <RoutineProductCard key={p.id} product={p} catalog={p.catalog_product_id ? data.catalog.get(p.catalog_product_id) : undefined} inKabinet={owned.some((o) => o.catalogProductId && o.catalogProductId === p.catalog_product_id)} />
          ))}
        </div>
      </section>

      <section className="mt-2xl flex flex-col gap-md">
        <p className="m-0 type-eyebrow text-muted-foreground">Routine · {data.steps.length} {data.steps.length === 1 ? 'step' : 'steps'}</p>
        {data.steps.length === 0 && <p className="m-0 type-body-sm text-muted-foreground">{creator ?? 'The creator'} listed products without an order, so there are no steps yet.</p>}
        <ol className="m-0 flex list-none flex-col gap-md p-0">
          {data.steps.map((s) => {
            const p = s.routine_product_id ? data.products.find((x) => x.id === s.routine_product_id) : undefined
            const c = s.catalog_product_id ? data.catalog.get(s.catalog_product_id) : undefined
            return (
              <li key={s.id} className="flex gap-md">
                <span className="type-h3 w-[28px] shrink-0 pt-[1px] text-muted-foreground">{String(s.step_number).padStart(2, '0')}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  {s.title && <p className="m-0 type-h3 text-foreground">{s.title}</p>}
                  <p className="m-0 type-body text-foreground">{s.instruction}</p>
                  {(s.timing_text || s.area_text) && <p className="m-0 type-meta text-muted-foreground">{[s.timing_text, s.area_text].filter(Boolean).join(' · ')}</p>}
                  {(c || p) && <p className="m-0 type-meta text-muted-foreground">{c ? `${c.brand ?? ''} ${c.name}`.trim() : [p!.raw_brand, p!.raw_product_name].filter(Boolean).join(' ')}</p>}
                </div>
                {c?.image_url && <span className="w-[44px] shrink-0 overflow-hidden rounded-content"><ProductImage imageUrl={c.image_url} ratio="3/4" alt="" /></span>}
              </li>
            )
          })}
        </ol>
      </section>

      <footer className="mt-2xl flex flex-col gap-[4px] border-t border-border pt-md">
        {imp && (
          <p className="m-0 type-micro text-muted-foreground">
            Routine extracted from {creator ?? 'a creator'} on {platform} — <a href={imp.source_url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">view the original ↗</a>. Steps and product names follow what was shared publicly; KABINET adds nothing that wasn't said.
          </p>
        )}
        {sources.size > 0 && <p className="m-0 type-micro text-muted-foreground">Product photos and label data from {[...sources].map((s) => SOURCE_LABEL[s]).join(' and ')}.</p>}
      </footer>
    </div>
  )
}

function RoutineProductCard({ product: p, catalog: c, inKabinet }: { product: RoutineProduct; catalog: CatalogProduct | undefined; inKabinet: boolean }) {
  const [open, setOpen] = useState(false)
  const raw = [p.raw_brand, p.raw_product_name, p.raw_variant].filter(Boolean).join(' ')
  const category = c?.category ? CAT[c.category] : null
  return (
    <article className="flex gap-md border-b border-border py-md last:border-b-0">
      <div className="w-[88px] shrink-0 overflow-hidden rounded-content">
        <ProductImage imageUrl={c?.image_url ?? null} ratio="3/4" alt={c ? `${c.brand ?? ''} ${c.name}` : ''} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="type-eyebrow text-muted-foreground">{c?.brand ?? p.raw_brand ?? (p.resolution_status === 'none' ? 'Category' : 'Unmatched')}</span>
        <span className="type-h3 leading-snug text-foreground">{c?.name ?? p.raw_product_name}{!c && p.raw_variant ? ` · ${p.raw_variant}` : ''}</span>
        <span className="type-meta text-muted-foreground">
          {[category, p.usage_notes, p.amount_text].filter(Boolean).join(' · ') || (c ? null : p.resolution_status === 'none' ? 'Named only as a type of product' : 'Not in KABINET\'s catalog yet')}
        </span>
        {c && raw && raw.toLowerCase() !== `${c.brand ?? ''} ${c.name}`.toLowerCase().trim() && <span className="type-micro text-muted-foreground">Creator said: “{raw}”</span>}
        {inKabinet && <span className="type-meta text-foreground">In your Kabinet ✓</span>}
        {c && (
          <div className="mt-[4px] flex flex-col gap-[4px]">
            <button type="button" onClick={() => setOpen((v) => !v)} className="w-fit type-body-sm font-medium text-foreground">{open ? 'Hide ingredients' : 'View ingredients'}</button>
            {open && (c.ingredients.length ? <p className="m-0 type-body-sm text-muted-foreground">{c.ingredients.join(', ')}</p> : <p className="m-0 type-body-sm text-muted-foreground">Ingredient list not available yet.</p>)}
          </div>
        )}
      </div>
    </article>
  )
}
