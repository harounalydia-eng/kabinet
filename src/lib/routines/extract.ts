import type { ImageRef, Look, Product, Routine, RoutineCategory, RoutineStep, Save, SocialMeta } from '../types'
import { extractRoutineFromContent } from './textExtract'
import { PLATFORM_LABEL } from '../social/platform'

/**
 * Routine extraction — the boundary between the UI and whatever turns content into
 * a routine. Analysis is ONLY ever started by an explicit user action, never on load,
 * scroll, save or in the background.
 *
 * Providers implement `RoutineExtractor`. This build ships two:
 *   - StructuredExtractor: a look that already lists its steps and products becomes a
 *     draft deterministically. No inference, no cost.
 *   - NoProviderExtractor: for video and free imagery. No analysis backend exists in this
 *     build, so it reports `unavailable` — the user is offered the manual builder.
 * A real media provider (server-side, metered) slots in behind the same interface.
 */
export interface ExtractionSource {
  id: string
  type: 'save' | 'look'
  category: RoutineCategory
  title?: string
  description?: string
  image: ImageRef
  url?: string
  steps?: string[]
  products?: Product[]
  isVideo: boolean
  social?: SocialMeta
}

export type ExtractionStatus = 'idle' | 'queued' | 'analyzing' | 'review' | 'completed' | 'failed' | 'unavailable'

export interface ExtractionSummary {
  steps: number
  identified: number
  possible: number
  unclear: number
}

export type ExtractionResult =
  | { status: 'ready'; draft: Routine; summary: ExtractionSummary }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; error: string }

export interface RoutineExtractor {
  readonly name: string
  canHandle(source: ExtractionSource): boolean
  analyze(source: ExtractionSource, signal?: AbortSignal): Promise<ExtractionResult>
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export function sourceFromSave(save: Save): ExtractionSource {
  return {
    id: save.id,
    type: 'save',
    category: save.category,
    title: save.title,
    description: save.description,
    image: save.image,
    url: save.source?.url,
    steps: save.steps,
    products: save.products,
    isVideo: save.image.kind === 'video' || Boolean(save.social),
    social: save.social,
  }
}

export function sourceFromLook(look: Look): ExtractionSource {
  return { id: look.id, type: 'look', category: look.category, title: look.title, description: look.description, image: look.image, steps: look.steps, products: look.products, isVideo: false }
}

/** A step's leading verb hints at the product role it uses — enough to attach a listed product with honest confidence. */
const ROLE_HINTS: Array<[RegExp, string[]]> = [
  [/cleans|wash|shampoo/i, ['cleanse', 'shampoo']],
  [/tint|foundation|base/i, ['base']],
  [/blush|cheek/i, ['cheek']],
  [/spf|sunscreen/i, ['spf']],
  [/lip/i, ['lip']],
  [/brow/i, ['brow']],
  [/cream|leave-in|conditioner/i, ['curl-cream', 'conditioner']],
  [/gel|scrunch/i, ['gel']],
  [/oil|ends/i, ['hair-oil', 'body-oil']],
  [/serum|treat|acid|niacinamide/i, ['treat']],
  [/polish|nail/i, ['polish']],
  [/diffus/i, ['curl-cream', 'gel']],
]

/** Deterministic: steps and products the source already lists. Nothing is inferred beyond matching a listed product to a step by role. */
export const StructuredExtractor: RoutineExtractor = {
  name: 'structured',
  canHandle: (s) => Boolean(s.steps && s.steps.length > 0),
  async analyze(source) {
    const products = source.products ?? []
    const used = new Set<string>()
    let identified = 0, possible = 0, unclear = 0
    const steps: RoutineStep[] = (source.steps ?? []).map((text, i) => {
      const hint = ROLE_HINTS.find(([re]) => re.test(text))
      const match = hint ? products.find((p) => p.role && hint[1].includes(p.role) && !used.has(p.id)) : undefined
      const title = text.split(/[.,]/)[0].trim()
      const step: RoutineStep = { id: uid(), order: i + 1, title, description: text.trim() === title ? undefined : text }
      if (match) {
        used.add(match.id)
        // The look lists this product but the step text only implies it — "possible", the user confirms.
        Object.assign(step, { productId: match.id, productName: match.productName, productBrand: match.brand, productConfidence: 'possible' as const })
        possible++
      }
      return step
    })
    // Listed products not attached to any step are still known: attach as identified to a final "Also used" step? No — keep them visible without inventing a step.
    for (const p of products) if (!used.has(p.id)) identified++
    const draft: Routine = {
      id: uid(),
      title: source.title ?? 'Untitled routine',
      category: source.category,
      description: source.description,
      sourceType: source.type,
      sourceUrl: source.url,
      sourceMediaId: source.id,
      sourceThumbnail: source.image,
      analysisStatus: 'draft',
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    return { status: 'ready', draft, summary: { steps: steps.length, identified: identified + possible, possible, unclear } }
  },
}

/** No media-analysis backend exists in this build. Says so, plainly. */
export const NoProviderExtractor: RoutineExtractor = {
  name: 'none',
  canHandle: () => true,
  async analyze(source) {
    return {
      status: 'unavailable',
      reason: source.isVideo
        ? 'Video analysis is not connected in this build, so KABINET cannot read this video yet. You can build the routine yourself in a minute.'
        : 'This save does not list its steps, and image analysis is not connected in this build. You can build the routine yourself.',
    }
  },
}

/** Social imports: Level 1 text (caption / title / description / transcript) through the provider chain. */
export const SocialTextExtractor: RoutineExtractor = {
  name: 'social-text',
  canHandle: (s) => Boolean(s.social),
  async analyze(source, signal) {
    const social = source.social!
    if (!social.availableText.trim()) {
      return { status: 'unavailable', reason: social.accessNote ?? `${PLATFORM_LABEL[social.platform]} did not give KABINET any text for this video.` }
    }
    const r = await extractRoutineFromContent({ contentId: source.id, platform: social.platform, sourceUrl: source.url, title: source.title, text: social.availableText, transcript: social.transcript }, signal)
    if (!r.ok) {
      if (r.reason === 'error') return { status: 'failed', error: r.message }
      return { status: 'unavailable', reason: r.message }
    }
    let possible = 0, unclear = 0
    const steps: RoutineStep[] = r.draft.steps.map((d) => {
      const known = Boolean(d.productName || d.brand)
      if (known && d.confidence !== 'high') possible++
      if (!known) unclear++
      return {
        id: uid(),
        order: d.order,
        title: d.title,
        description: d.description ?? undefined,
        duration: d.duration ?? undefined,
        technique: d.technique ?? undefined,
        productBrand: d.brand ?? undefined,
        productName: d.productName ?? undefined,
        productConfidence: known ? (d.confidence === 'high' ? 'identified' : 'possible') : 'unclear',
      }
    })
    const catMap: Record<string, RoutineCategory> = { skin: 'Skin', hair: 'Hair', makeup: 'Makeup', nails: 'Nails', body: 'Body', wellness: 'Wellness' }
    const draft: Routine = {
      id: uid(),
      title: r.draft.title,
      category: catMap[r.draft.category] ?? source.category,
      description: undefined,
      sourceType: social.platform,
      sourceUrl: source.url,
      sourceMediaId: source.id,
      sourceThumbnail: source.image,
      sourceTitle: social.caption ?? source.title,
      sourceCreator: social.creatorName ?? undefined,
      analysisStatus: 'draft',
      steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    return { status: 'ready', draft, summary: { steps: steps.length, identified: steps.length - unclear, possible, unclear } }
  },
}

const EXTRACTORS: RoutineExtractor[] = [SocialTextExtractor, StructuredExtractor, NoProviderExtractor]

/** Entry point the UI calls — and only on an explicit tap. */
export async function extractRoutine(source: ExtractionSource, signal?: AbortSignal): Promise<ExtractionResult> {
  const provider = EXTRACTORS.find((e) => e.canHandle(source)) ?? NoProviderExtractor
  try {
    return await provider.analyze(source, signal)
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'Analysis failed.' }
  }
}

/** Convenience for the manual builder. */
export function emptyRoutine(partial: Partial<Routine> = {}): Routine {
  const now = Date.now()
  return { id: uid(), title: '', category: 'Skin', sourceType: 'manual', analysisStatus: 'manual', steps: [], createdAt: now, updatedAt: now, ...partial }
}

export function newStep(order: number, partial: Partial<RoutineStep> = {}): RoutineStep {
  return { id: uid(), order, title: '', ...partial }
}
