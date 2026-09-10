import type { RoutineCategory } from '../types'

/**
 * Phase 7–8 — turning available text into a strictly-shaped routine draft.
 *
 * Providers implement `RoutineExtractionProvider`. The chain tries the cheapest first:
 *   1. RemoteProvider  — a server-side model behind a Supabase Edge Function (keys never in
 *      the browser). Only used when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
 *   2. RuleBasedProvider — free, deterministic heuristics over numbered lists and
 *      imperative sentences. Never invents brands, products, timings or techniques.
 * Level 2 (audio transcription) sits behind `TranscriptionProvider`; none is connected.
 */
export type Confidence = 'high' | 'medium' | 'low'

export interface DraftStep {
  order: number
  title: string
  description: string | null
  brand: string | null
  productName: string | null
  duration: string | null
  technique: string | null
  confidence: Confidence
}

export interface RoutineDraft {
  title: string
  category: RoutineCategory | 'other'
  steps: DraftStep[]
}

export interface ExtractionInput {
  contentId: string
  platform: string
  sourceUrl?: string
  title?: string | null
  text: string
  transcript?: string | null
}

export type ProviderResult = { ok: true; draft: RoutineDraft; provider: string } | { ok: false; reason: 'insufficient' | 'unavailable' | 'error'; message: string; provider: string }

export interface RoutineExtractionProvider {
  name: string
  available(): boolean
  extract(input: ExtractionInput, signal?: AbortSignal): Promise<ProviderResult>
}

export interface TranscriptionProvider {
  name: string
  available(): boolean
  transcribe(sourceUrl: string, signal?: AbortSignal): Promise<string | null>
}

/* ── Strict validation — nothing unvalidated reaches storage ───────────────── */
const CATS = new Set(['skin', 'hair', 'makeup', 'nails', 'body', 'wellness', 'other'])
const CONF = new Set(['high', 'medium', 'low'])
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function validateDraft(v: unknown): RoutineDraft | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const title = str(o.title, 80)
  const category = typeof o.category === 'string' && CATS.has(o.category.toLowerCase()) ? (o.category.toLowerCase() as RoutineDraft['category']) : 'other'
  if (!title || !Array.isArray(o.steps)) return null
  const steps: DraftStep[] = []
  for (const raw of o.steps.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const t = str(r.title, 80)
    if (!t) continue
    steps.push({
      order: steps.length + 1,
      title: t,
      description: str(r.description, 300),
      brand: str(r.brand, 60),
      productName: str(r.productName, 100),
      duration: str(r.duration, 40),
      technique: str(r.technique, 60),
      confidence: typeof r.confidence === 'string' && CONF.has(r.confidence) ? (r.confidence as Confidence) : 'low',
    })
  }
  if (steps.length === 0) return null
  return { title, category, steps }
}

/* ── Rule-based provider ─────────────────────────────────────────────────── */
const VERBS = /\b(shampoo|co-?wash|cleanse|wash|rinse|condition|detangle|apply|use|add|rake|scrunch|diffuse|air[- ]dry|massage|blend|tap|pat|layer|set|mist|spray|moisturi[sz]e|seal|prime|curl|brush|comb|dab|buff|exfoliate|mask|tone|treat|press|sweep|line|fill|contour|highlight|blot|section|clip|plop|twist|braid|gloss|file|shape|soak|steam|dry|leave)\b/i
const TECHNIQUES = ['scrunch', 'rake', 'finger coil', 'praying hands', 'plop', 'diffuse', 'pat', 'blend', 'layer', 'massage', 'tap', 'press', 'buff', 'sweep', 'twist', 'braid', 'slather', 'sandwich', 'squish', 'clip']
const DURATION = /\b(\d{1,3})\s*(?:-|to)?\s*(\d{1,3})?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)\b/i
const KNOWN_BRANDS = ['olaplex', 'ouai', 'curlsmith', 'bouclème', 'boucleme', 'dior', 'glossier', 'the ordinary', 'cerave', 'la roche-posay', 'supergoop', 'mac', 'nuxe', 'essie', 'anastasia', 'kérastase', 'kerastase', 'k18', 'shea moisture', 'cantu', 'eco style', 'eco styler', 'aussie', 'garnier', 'l\'oréal', 'loreal', 'paula\'s choice', 'drunk elephant', 'tatcha', 'nars', 'charlotte tilbury', 'rare beauty', 'fenty', 'merit', 'ilia', 'summer fridays', 'laneige', 'cosrx', 'beauty of joseon', 'skinceuticals', 'avène', 'avene', 'bioderma', 'embryolisse', 'weleda', 'aesop', 'byoma', 'innisfree', 'tower 28', 'saie', 'kosas', 'milk makeup', 'benefit', 'maybelline', 'nyx', 'e.l.f.', 'elf', 'revlon', 'opi', 'sally hansen', 'rimmel', 'hourglass', 'lancôme', 'lancome', 'estée lauder', 'estee lauder', 'clinique', 'kiehl\'s', 'kiehls', 'sol de janeiro', 'bumble and bumble', 'moroccanoil', 'amika', 'living proof', 'redken', 'pattern', 'mielle', 'as i am', 'not your mother\'s', 'devacurl', 'kinky-curly', 'camille rose']
const CATEGORY_HINTS: Array<[RoutineCategory, RegExp]> = [
  ['Hair', /\b(hair|curl|curly|coil|wash day|shampoo|conditioner|scalp|frizz|diffus|leave-?in|gel|braid|blow[- ]?dry|straight)\b/i],
  ['Makeup', /\b(makeup|foundation|concealer|blush|bronzer|contour|mascara|liner|brow|lip|lipstick|gloss|eyeshadow|glam|base|primer|setting)\b/i],
  ['Nails', /\b(nail|manicure|polish|cuticle|gel nails|top coat)\b/i],
  ['Body', /\b(body|shower|lotion|body oil|exfoliat|scrub|shave|deodorant)\b/i],
  ['Wellness', /\b(sleep|meditat|breath|journal|hydrat|supplement|gua sha|lymph)\b/i],
  ['Skin', /\b(skin|skincare|serum|moisturi|spf|sunscreen|cleanser|toner|retinol|niacinamide|barrier|acne|hyaluronic|routine)\b/i],
]

export function guessCategory(text: string): RoutineCategory | null {
  let best: [RoutineCategory, number] | null = null
  for (const [cat, re] of CATEGORY_HINTS) {
    const n = (text.match(new RegExp(re.source, 'gi')) ?? []).length
    if (n > 0 && (!best || n > best[1])) best = [cat, n]
  }
  return best?.[0] ?? null
}

const MARKER = /^(?:step\s*)?\d{1,2}\s*[.):-]\s*|^[-•·*]\s*/i

/** Returns the step candidates and whether they came from an explicit numbered/bulleted list. */
function splitCandidates(text: string): { items: string[]; explicit: boolean } {
  const clean = text.replace(/#[\wÀ-ɏ]+/g, ' ').replace(/[☀-➿\u{1F300}-\u{1FAFF}]/gu, ' ')
  // numbered / bulleted items — on their own lines or inline ("… 1. shampoo 2. mask …")
  const lines = clean.split(/\r?\n|(?=\s(?:\d{1,2}[.)]|step\s*\d+[:.)]))/i).map((l) => l.trim()).filter(Boolean)
  const marked = lines.filter((l) => MARKER.test(l))
  if (marked.length >= 2) return { items: marked.map((l) => l.replace(MARKER, '').trim()).filter(Boolean), explicit: true }
  // otherwise sentences carrying an action verb, also split on "then / next / after that"
  const items = clean
    .split(/(?<=[.!?])\s+|\s+(?:then|next|after that|finally|lastly)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && VERBS.test(s))
  return { items, explicit: false }
}

function stepTitle(sentence: string): string {
  const m = sentence.match(VERBS)
  const head = m ? sentence.slice(m.index!).split(/[,;:(]/)[0] : sentence.split(/[,;:(]/)[0]
  const t = head.replace(/\b(i|i'm|im|i am|then|just|gonna|going to|we|you)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  const short = t.split(' ').slice(0, 6).join(' ')
  return short.charAt(0).toUpperCase() + short.slice(1)
}

export const RuleBasedProvider: RoutineExtractionProvider = {
  name: 'rules',
  available: () => true,
  async extract(input) {
    // The title is only context for naming; steps come from the body text.
    const body = [input.text, input.transcript].filter(Boolean).join('\n')
    const text = body || input.title || ''
    const { items: candidates, explicit } = splitCandidates(text)
    if (candidates.length < 2) {
      return { ok: false, reason: 'insufficient', message: 'There wasn’t enough routine information available from this video.', provider: 'rules' }
    }
    const steps: DraftStep[] = candidates.slice(0, 20).map((c, i) => {
      const lower = c.toLowerCase()
      const brand = KNOWN_BRANDS.find((b) => lower.includes(b)) ?? null
      const dur = c.match(DURATION)
      const technique = TECHNIQUES.find((t) => lower.includes(t)) ?? null
      return {
        order: i + 1,
        title: stepTitle(c),
        description: c.length > 6 ? c : null,
        brand: brand ? brand.replace(/\b\w/g, (ch) => ch.toUpperCase()) : null,
        productName: null, // never guessed from text alone
        duration: dur ? dur[0] : null,
        technique,
        confidence: explicit ? 'high' : 'medium',
      }
    })
    const cat = guessCategory(text)
    const title = (input.title?.split(/[\n#|]/)[0].trim() || (cat ? `${cat} routine` : 'Routine')).slice(0, 80)
    return { ok: true, draft: { title, category: (cat?.toLowerCase() as RoutineDraft['category']) ?? 'other', steps }, provider: 'rules' }
  },
}

/* ── Remote provider (server-side model) ─────────────────────────────────── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const RemoteProvider: RoutineExtractionProvider = {
  name: 'remote',
  available: () => Boolean(SUPABASE_URL && SUPABASE_ANON),
  async extract(input, signal) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/extract-routine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON!, Authorization: `Bearer ${SUPABASE_ANON!}` },
        body: JSON.stringify(input),
        signal,
      })
      if (res.status === 503) return { ok: false, reason: 'unavailable', message: 'The extraction service is not configured yet.', provider: 'remote' }
      if (!res.ok) return { ok: false, reason: 'error', message: `Extraction failed (${res.status}).`, provider: 'remote' }
      const data = (await res.json()) as unknown
      const draft = validateDraft((data as { draft?: unknown }).draft ?? data)
      if (!draft) return { ok: false, reason: 'insufficient', message: 'There wasn’t enough routine information available from this video.', provider: 'remote' }
      return { ok: true, draft, provider: 'remote' }
    } catch (e) {
      return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Extraction failed.', provider: 'remote' }
    }
  },
}

export const NoTranscription: TranscriptionProvider = { name: 'none', available: () => false, async transcribe() { return null } }

/** Cheapest first: server model if configured, else rules. Level 2 transcription only if a provider is connected and Level 1 was insufficient. */
export async function extractRoutineFromContent(input: ExtractionInput, signal?: AbortSignal, transcription: TranscriptionProvider = NoTranscription): Promise<ProviderResult> {
  const providers = [RemoteProvider, RuleBasedProvider].filter((p) => p.available())
  let last: ProviderResult = { ok: false, reason: 'unavailable', message: 'No extraction provider is available.', provider: 'none' }
  for (const p of providers) {
    last = await p.extract(input, signal)
    if (last.ok || last.reason === 'error') break
  }
  if (!last.ok && last.reason === 'insufficient' && transcription.available() && input.sourceUrl) {
    const t = await transcription.transcribe(input.sourceUrl, signal)
    if (t) return extractRoutineFromContent({ ...input, transcript: t }, signal, NoTranscription)
  }
  return last
}

export async function textHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
}
