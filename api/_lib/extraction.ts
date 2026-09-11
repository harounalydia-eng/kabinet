// The extraction contract: what KABINET asks Gemini for, and the rules it must obey. Runs on the server only.
// The Supabase Edge Function `import-routine` owns everything else (metadata, validation, resolution, writes).

export type Confidence = 'high' | 'medium' | 'low'
export type EvidenceKind = 'title' | 'caption' | 'description' | 'hashtags' | 'transcript'

export interface ExtractionRequest {
  platform: 'tiktok' | 'instagram' | 'youtube'
  creator: string | null
  /** Labelled evidence blocks, e.g. "TITLE:\n…", "TRANSCRIPT (…):\n…". Nothing else is ever sent. */
  evidence: string[]
}

const CONF = { type: 'string', enum: ['high', 'medium', 'low'] } as const

/** Standard JSON Schema — sent as `responseJsonSchema`; `toGeminiSchema` converts it for the older `responseSchema` field. */
export const SCHEMA = {
  type: 'object',
  required: ['title', 'routine_type', 'description', 'skin_hair_context', 'confidence', 'notes', 'products', 'steps'],
  properties: {
    title: { type: 'string', description: "What this routine is, in the creator's framing. Not marketing copy." },
    routine_type: { type: 'string', enum: ['skincare', 'makeup', 'haircare', 'scalp', 'body', 'nails', 'mixed', 'unknown'] },
    description: { type: ['string', 'null'] },
    skin_hair_context: { type: ['string', 'null'], description: 'What the creator says about their own skin/hair, close to verbatim. Null if not stated.' },
    confidence: CONF,
    notes: { type: ['string', 'null'], description: 'What evidence was thin or missing.' },
    products: {
      type: 'array',
      items: {
        type: 'object',
        required: ['raw_brand', 'raw_product_name', 'raw_variant', 'raw_text', 'usage_order', 'usage_notes', 'amount_text', 'evidence', 'confidence'],
        properties: {
          raw_brand: { type: ['string', 'null'], description: 'Only when the evidence names it.' },
          raw_product_name: { type: 'string', description: 'Exactly as named in the evidence. A generic category ("sunscreen") is allowed when no name is given — never guess a brand or a specific product for it.' },
          raw_variant: { type: ['string', 'null'], description: 'Shade, size, strength, formula if stated.' },
          raw_text: { type: 'string', description: 'The exact words in the evidence this product comes from, copied verbatim.' },
          usage_order: { type: 'integer' },
          usage_notes: { type: ['string', 'null'] },
          amount_text: { type: ['string', 'null'] },
          evidence: { type: 'array', items: { type: 'string', enum: ['title', 'caption', 'description', 'hashtags', 'transcript'] } },
          confidence: CONF,
        },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step_number', 'title', 'instruction', 'product_index', 'timing_text', 'area_text', 'confidence'],
        properties: {
          step_number: { type: 'integer' },
          title: { type: ['string', 'null'], description: 'A short label such as Cleanse, Prep, Protect.' },
          instruction: { type: 'string', description: "What the creator does, in the creator's terms." },
          product_index: { type: ['integer', 'null'], description: 'Index into products (0-based) when this step uses one.' },
          timing_text: { type: ['string', 'null'], description: 'Only if explicitly mentioned.' },
          area_text: { type: ['string', 'null'], description: 'Only if explicitly mentioned.' },
          confidence: CONF,
        },
      },
    },
  },
}

export const SYSTEM = `You turn the text around a beauty video into a structured routine, the way a recipe importer turns a cooking video into ingredients and steps. You are a careful transcriber of what the creator shared, not an expert filling gaps.

Rules that must never be broken:
- Use ONLY the evidence given. Never add a brand, product, shade, amount, timing or step that the evidence does not state. Your general knowledge of beauty products must not add anything.
- A product needs a name in the evidence. If only a category is stated ("a sunscreen", "my toner", "this one is from CeraVe"), record what IS stated (category and, if named, the brand) as raw_product_name / raw_brand with confidence low — do not guess which specific product it is.
- raw_text must be an exact quote copied from the evidence.
- Steps only when the evidence states actions; keep the creator's order. If products are merely listed with no actions, return steps as an empty array.
- timing_text and area_text only when explicitly mentioned.
- Say nothing about whether anything is good for anyone. No claims, no advice.
- If the evidence is not about a beauty routine at all, return routine_type "unknown", empty products and steps, and explain in notes.
Return JSON only.`

/** JSON Schema → Gemini `Schema` (uppercase types, `nullable` instead of type arrays, no keywords Gemini rejects). */
export function toGeminiSchema(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let type = node.type as string | string[]
  if (Array.isArray(type)) {
    if (type.includes('null')) out.nullable = true
    type = type.find((t) => t !== 'null') ?? 'string'
  }
  out.type = String(type).toUpperCase()
  if (node.description) out.description = node.description
  if (node.enum) out.enum = node.enum
  if (node.required) out.required = node.required
  if (node.properties) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node.properties as Record<string, Record<string, unknown>>)) props[k] = toGeminiSchema(v)
    out.properties = props
    out.propertyOrdering = Object.keys(props)
  }
  if (node.items) out.items = toGeminiSchema(node.items as Record<string, unknown>)
  return out
}

export class GeminiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
  }
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** One generateContent call with a JSON schema. Tries the standard-JSON-Schema field first, then Gemini's own Schema shape. */
export async function geminiJson(apiKey: string, model: string, system: string, user: string, schema: Record<string, unknown>, maxOutputTokens = 6000): Promise<{ data: unknown; usage: Record<string, unknown> | null; schemaField: string }> {
  const attempts: Array<[string, Record<string, unknown>]> = [
    ['responseJsonSchema', { responseJsonSchema: schema }],
    ['responseSchema', { responseSchema: toGeminiSchema(schema) }],
  ]
  let lastErr: GeminiError | null = null
  for (const [field, cfg] of attempts) {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens, ...cfg },
      }),
      signal: AbortSignal.timeout(50_000),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const msg = ((body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`).slice(0, 300)
      lastErr = new GeminiError(res.status, msg)
      if (res.status === 400 && /schema|responseJsonSchema|response_json_schema/i.test(msg)) continue
      throw lastErr
    }
    const cands = (body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> | undefined) ?? []
    const text = cands[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new GeminiError(502, `Gemini returned no content (${cands[0]?.finishReason ?? 'no candidate'}).`)
    try {
      return { data: JSON.parse(text), usage: (body.usageMetadata as Record<string, unknown>) ?? null, schemaField: field }
    } catch {
      throw new GeminiError(502, 'Gemini returned something that is not JSON.')
    }
  }
  throw lastErr ?? new GeminiError(502, 'Gemini did not answer.')
}
