// Beauty content → structured routine. Client side of the `import-routine` edge function plus reads of the
// routine tables. Nothing here calls a model or a platform; the pipeline runs on the server.
import { supabase } from '../supabase'
import { detectPlatform } from '../social/platform'
import type { CatalogProduct } from '../catalogProducts'

export type ImportStatus = 'queued' | 'reading' | 'listening' | 'extracting' | 'matching' | 'ready' | 'failed'
export type Confidence = 'high' | 'medium' | 'low'
export type ResolutionStatus = 'matched' | 'possible_match' | 'unresolved' | 'manual' | 'none'

export interface ContentImport {
  id: string
  platform: 'tiktok' | 'instagram' | 'youtube'
  source_url: string
  canonical_url: string
  source_content_id: string
  creator_name: string | null
  creator_handle: string | null
  creator_profile_url: string | null
  title: string | null
  caption: string | null
  description: string | null
  hashtags: string[]
  thumbnail_url: string | null
  thumbnail_w: number | null
  thumbnail_h: number | null
  embed_url: string | null
  transcript_source: 'platform' | 'user' | 'provider' | null
  evidence_sources: string[]
  import_status: ImportStatus
  status_message: string | null
  error: string | null
  extraction_confidence: Confidence | null
  model: string | null
  created_at: string
}

export interface RoutineRecord {
  id: string
  content_import_id: string | null
  origin: 'import' | 'user' | 'adapted'
  title: string
  routine_type: 'skincare' | 'makeup' | 'haircare' | 'scalp' | 'body' | 'nails' | 'mixed' | 'unknown' | null
  description: string | null
  skin_hair_context: string | null
  extraction_confidence: Confidence | null
  extraction_notes: string | null
  created_at: string
}

export interface RoutineProduct {
  id: string
  routine_id: string
  catalog_product_id: string | null
  raw_brand: string | null
  raw_product_name: string
  raw_variant: string | null
  raw_text: string | null
  usage_order: number
  usage_notes: string | null
  amount_text: string | null
  evidence_sources: string[]
  extraction_confidence: Confidence | null
  resolution_status: ResolutionStatus
  candidate_ids: string[]
}

export interface RoutineStep {
  id: string
  routine_id: string
  step_number: number
  title: string | null
  instruction: string
  routine_product_id: string | null
  catalog_product_id: string | null
  timing_text: string | null
  area_text: string | null
  notes: string | null
  extraction_confidence: Confidence | null
}

export interface ImportResult {
  ok: boolean
  cached?: boolean
  message?: string
  error?: string
  import: ContentImport | null
  routine: RoutineRecord | null
  products: RoutineProduct[]
  steps: RoutineStep[]
}

/** A routine with everything the recipe page needs, catalog rows included. */
export interface ImportedRoutine extends ImportResult {
  routine: RoutineRecord
  catalog: Map<string, CatalogProduct>
  saved: boolean
}

const CATALOG_SELECT = 'id, brand, name, category, category_tags, barcode, quantity, image_url, ingredients, ingredients_text, source, source_id, source_url, fetched_at, created_at, updated_at'
const IMPORT_SELECT = 'id, platform, source_url, canonical_url, source_content_id, creator_name, creator_handle, creator_profile_url, title, caption, description, hashtags, thumbnail_url, thumbnail_w, thumbnail_h, embed_url, transcript_source, evidence_sources, import_status, status_message, error, extraction_confidence, model, created_at'

export const importAvailable = () => supabase !== null

function need() {
  if (!supabase) throw new Error('Importing needs a signed-in KABINET account.')
  return supabase
}

async function invoke<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const sb = need()
  const { data, error } = await sb.functions.invoke<T>(path, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = (await ctx.json().catch(() => null)) as (T & { message?: string }) | null
      // 422 = the pipeline ran and failed honestly; the payload says why. Hand it back as a result.
      if (j && ctx.status === 422) return j
      if (j?.message) throw new Error(j.message)
    }
    throw new Error(error.message)
  }
  return data as T
}

/** Runs the whole pipeline for a link. Long (10–40 s): pair it with subscribeImportStatus for honest progress. */
export const importRoutine = (url: string, transcript?: string | null) => invoke<ImportResult>('import-routine', { url, transcript: transcript ?? null })
export const rerunImport = (importId: string, transcript?: string | null) => invoke<ImportResult>('import-routine/rerun', { import_id: importId, transcript: transcript ?? null })
export const confirmProduct = (routineProductId: string, catalogProductId: string | null) => invoke<{ ok: boolean; product: RoutineProduct }>('import-routine/confirm', { routine_product_id: routineProductId, catalog_product_id: catalogProductId })

/** Polls the import row for a link while the pipeline runs (status copy comes from the server). */
export function subscribeImportStatus(url: string, cb: (s: { status: ImportStatus; message: string | null; error: string | null } | null) => void): () => void {
  const sb = supabase
  const link = detectPlatform(url)
  if (!sb || !link) return () => {}
  let live = true
  const tick = async () => {
    if (!live) return
    let q = sb.from('content_imports').select('import_status, status_message, error')
    q = link.sourceId ? q.eq('platform', link.platform).eq('source_content_id', link.sourceId) : q.eq('canonical_url', link.canonicalUrl)
    const { data } = await q.maybeSingle()
    if (!live) return
    cb(data ? { status: data.import_status as ImportStatus, message: data.status_message, error: data.error } : null)
    if (live) setTimeout(tick, 700)
  }
  void tick()
  return () => {
    live = false
  }
}

export async function getRoutine(routineId: string): Promise<ImportedRoutine | null> {
  const sb = need()
  const [{ data: routine }, { data: products }, { data: steps }, { data: me }] = await Promise.all([
    sb.from('routines').select('*').eq('id', routineId).maybeSingle(),
    sb.from('routine_products').select('*').eq('routine_id', routineId).order('usage_order'),
    sb.from('routine_steps').select('*').eq('routine_id', routineId).order('step_number'),
    sb.auth.getUser(),
  ])
  if (!routine) return null
  const imp = routine.content_import_id ? (await sb.from('content_imports').select(IMPORT_SELECT).eq('id', routine.content_import_id).maybeSingle()).data : null
  const ids = [...new Set([...(products ?? []).map((p) => p.catalog_product_id), ...(products ?? []).flatMap((p) => p.candidate_ids ?? [])].filter((x): x is string => !!x))]
  const catalog = new Map<string, CatalogProduct>()
  if (ids.length) {
    const { data } = await sb.from('catalog_products').select(CATALOG_SELECT).in('id', ids)
    for (const row of (data ?? []) as CatalogProduct[]) catalog.set(row.id, row)
  }
  let saved = false
  if (me.user) {
    const { data } = await sb.from('user_routines').select('id').eq('routine_id', routineId).eq('user_id', me.user.id).maybeSingle()
    saved = !!data
  }
  return { ok: true, import: imp as ContentImport | null, routine: routine as RoutineRecord, products: (products ?? []) as RoutineProduct[], steps: (steps ?? []) as RoutineStep[], catalog, saved }
}

export async function saveRoutine(routineId: string): Promise<void> {
  const sb = need()
  const { data: me } = await sb.auth.getUser()
  if (!me.user) throw new Error('Sign in to save routines.')
  const { error } = await sb.from('user_routines').upsert({ user_id: me.user.id, routine_id: routineId, status: 'saved' }, { onConflict: 'user_id,routine_id' })
  if (error) throw new Error(error.message)
}

export async function unsaveRoutine(routineId: string): Promise<void> {
  const sb = need()
  const { error } = await sb.from('user_routines').delete().eq('routine_id', routineId)
  if (error) throw new Error(error.message)
}

export interface SavedRoutineSummary {
  routine: RoutineRecord
  import: Pick<ContentImport, 'id' | 'platform' | 'creator_name' | 'creator_handle' | 'thumbnail_url' | 'thumbnail_w' | 'thumbnail_h'> | null
  productCount: number
  stepCount: number
  savedAt: string
}

/** The person's saved imported routines, newest first. Empty when there is no account. */
export async function listSavedRoutines(): Promise<SavedRoutineSummary[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_routines')
    .select('saved_at, routine:routines(*, content_import:content_imports(id, platform, creator_name, creator_handle, thumbnail_url, thumbnail_w, thumbnail_h), routine_products(id), routine_steps(id))')
    .order('saved_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((row) => {
    const r = row.routine as unknown as (RoutineRecord & { content_import: SavedRoutineSummary['import']; routine_products: { id: string }[]; routine_steps: { id: string }[] }) | null
    if (!r) return []
    return [{ routine: r, import: r.content_import ?? null, productCount: r.routine_products?.length ?? 0, stepCount: r.routine_steps?.length ?? 0, savedAt: row.saved_at as string }]
  })
}

export const PLATFORM_NAME = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' } as const
export const ROUTINE_TYPE_LABEL: Record<NonNullable<RoutineRecord['routine_type']>, string> = { skincare: 'Skincare', makeup: 'Makeup', haircare: 'Haircare', scalp: 'Scalp', body: 'Body', nails: 'Nails', mixed: 'Mixed', unknown: 'Routine' }
