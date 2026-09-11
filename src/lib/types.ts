/** Beauty worlds. Products live inside these — "Product" is not a world of its own. */
export const CATEGORIES = ['Skin', 'Hair', 'Makeup', 'Nails', 'Body', 'Wellness'] as const
export type Category = (typeof CATEGORIES)[number]

/** Where a picture lives. `tone` is an image-less object, as the Figma file draws them. */
export type ImageRef =
  | { kind: 'blob'; id: string; w: number; h: number }
  | { kind: 'url'; url: string; w: number; h: number }
  | { kind: 'tone'; tone: string; tone2?: string; label?: string; w: number; h: number }
  /** A saved video file (blob store). Rendered muted with its first frame as the poster. */
  | { kind: 'video'; id: string; w: number; h: number; duration?: number }

/* ── Future: personal compatibility. Typed so the data model is ready; NOT rendered
   anywhere in this version, because no analysis exists to support it. ─────────── */
export type CompatibilityStatus = 'good' | 'maybe' | 'skip'
export type CompatibilityConfidence = 'predicted' | 'observed'
export type PersonalEvidence = 'low' | 'emerging' | 'strong'

/** A product that appears in a look, or that the user owns. Every field beyond id/brand/name is optional. */
export interface Product {
  id: string
  brand: string
  productName: string
  category?: Category
  /** Product type, e.g. Foundation, Serum, Curl cream. */
  productType?: string
  /** Functional role in a routine, e.g. 'base', 'spf', 'lip'. Reserved for future ownership intelligence. */
  role?: string
  image?: ImageRef
  price?: number
  currency?: string
  retailer?: string
  purchaseUrl?: string
  affiliateUrl?: string
  /** The canonical record in Supabase catalog_products; its image_url is the product's photograph. */
  catalogProductId?: string
  /** Factual, formulation-focused copy. No medical claims. */
  description?: string
  whatItIs?: string
  designedTo?: string
  ingredients?: string[]
  keyIngredients?: string[]
  considerations?: string[]
  /* Future — never shown in this version */
  compatibilityStatus?: CompatibilityStatus
  compatibilityConfidence?: CompatibilityConfidence
  compatibilityNote?: string
  ownedAlternative?: string
  personalEvidence?: PersonalEvidence
}

/** Something the user owns. Only ever created by the user. */
export interface OwnedProduct {
  id: string
  brand: string
  productName: string
  category?: Category
  productType?: string
  role?: string
  image?: ImageRef
  /** Set when added from a catalogue product. */
  productId?: string
  /** The canonical record in Supabase catalog_products (what the product IS). Ownership stays here. */
  catalogProductId?: string
  seed?: boolean
}

/** Editorial fields shared by a saved item and a catalogue look. */
export interface LookFields {
  title?: string
  description?: string
  subcategory?: string
  tags?: string[]
  products?: Product[]
  steps?: string[]
}

/** Imported social video — the normalised subset worth persisting with the save. */
/**
 * A social save IS video content. `Save.image` is only its poster for the feed;
 * playback goes through the platform's own embed (`embedUrl`). Nothing is downloaded or re-hosted.
 * Products are a separate system with their own photography — a social thumbnail never becomes a product image.
 */
export interface SocialMeta {
  platform: 'tiktok' | 'instagram' | 'youtube'
  contentType?: 'video'
  sourceId: string | null
  /** The link as shared, and the cleaned canonical form. */
  sourceUrl?: string
  canonicalUrl?: string
  creatorName: string | null
  creatorUrl?: string | null
  /** Platform embed/playback URL when the platform supports it. */
  embedUrl?: string | null
  posterUrl?: string | null
  vertical?: boolean
  caption: string | null
  description: string | null
  transcript: string | null
  availableText: string
  accessNote?: string
}

/** Cache of the last extraction for a save — the same content is never analysed twice by accident. */
export interface ExtractionCache {
  status: 'complete' | 'failed'
  routineId?: string
  textHash: string
  at: number
  reason?: string
}

export interface Save extends LookFields {
  id: string
  createdAt: number
  category: Category
  collectionId: string | null
  note: string
  source?: { url?: string; title?: string }
  image: ImageRef
  /** Set when the save was taken from an Explore look. */
  lookId?: string
  /** Set when the save is a product. */
  productId?: string
  /** Present when the save was imported from TikTok / Instagram / YouTube. */
  social?: SocialMeta
  extraction?: ExtractionCache
  seed?: boolean
}

/** A look in Explore — not yet saved into the user's world. */
export interface Look extends LookFields {
  id: string
  category: Category
  image: ImageRef
  trending?: boolean
}

export interface Collection {
  id: string
  createdAt: number
  title: string
  description?: string
  seed?: boolean
}

/* ── Routines — V1's core object. AI is an enhancement; every field a draft
   might not know is optional, so a routine never fails on a missing product. ── */
export type RoutineCategory = 'Skin' | 'Hair' | 'Makeup' | 'Nails' | 'Body' | 'Wellness'
export const ROUTINE_CATEGORIES: RoutineCategory[] = ['Skin', 'Hair', 'Makeup', 'Nails', 'Body', 'Wellness']

/** identified = confident · possible = likely, confirm · unclear = could not tell */
export type ProductConfidence = 'identified' | 'possible' | 'unclear'
export type AnalysisStatus = 'manual' | 'draft' | 'analyzing' | 'ready' | 'failed'
export type RoutineSourceType = 'manual' | 'save' | 'look' | 'video' | 'tiktok' | 'instagram' | 'youtube'

export interface RoutineStep {
  id: string
  order: number
  title: string
  description?: string
  /** Free text, only when clearly stated ("Leave for 10 minutes"). Never invented. */
  duration?: string
  technique?: string
  productId?: string
  productName?: string
  productBrand?: string
  productConfidence?: ProductConfidence
  notes?: string
}

export interface Routine {
  id: string
  title: string
  category: RoutineCategory
  description?: string
  sourceType: RoutineSourceType
  sourceUrl?: string
  /** Original title or caption, kept with the routine. */
  sourceTitle?: string
  sourceCreator?: string
  /** The save or look this came from — the user can always return to it. */
  sourceMediaId?: string
  sourceThumbnail?: ImageRef
  analysisStatus: AnalysisStatus
  steps: RoutineStep[]
  createdAt: number
  updatedAt: number
}
