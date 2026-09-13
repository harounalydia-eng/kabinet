// Gemini JSON call shared by KABINET's server routes. Server only; the key never leaves process.env.
export type Part = { text: string } | { inlineData: { mimeType: string; data: string } }

const DROP = new Set(['$schema', 'additionalProperties', 'default', 'title', 'examples', '$id', 'id', 'definitions', '$defs', 'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'pattern', 'format'])

/** Standard JSON Schema (zod / hand-written) → Gemini `Schema`: uppercase types, `nullable`, no keywords Gemini rejects. */
export function toGeminiSchema(node: Record<string, unknown>): Record<string, unknown> {
  // anyOf [X, {type:'null'}] → X + nullable
  if (Array.isArray(node.anyOf) || Array.isArray(node.oneOf)) {
    const opts = (node.anyOf ?? node.oneOf) as Record<string, unknown>[]
    const nonNull = opts.filter((o) => o.type !== 'null')
    if (nonNull.length === 1) return { ...toGeminiSchema({ ...nonNull[0], description: node.description ?? nonNull[0].description }), nullable: nonNull.length !== opts.length || undefined }
  }
  const out: Record<string, unknown> = {}
  let type = node.type as string | string[] | undefined
  if (Array.isArray(type)) {
    if (type.includes('null')) out.nullable = true
    type = type.find((t) => t !== 'null') ?? 'string'
  }
  if (node.nullable === true) out.nullable = true
  if (node.enum && !type) type = 'string'
  out.type = String(type ?? 'string').toUpperCase()
  if (node.description) out.description = node.description
  if (node.enum) out.enum = (node.enum as unknown[]).filter((v) => v !== null)
  if (node.properties) {
    const props: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node.properties as Record<string, Record<string, unknown>>)) props[k] = toGeminiSchema(v)
    out.properties = props
    out.propertyOrdering = Object.keys(props)
    out.required = Array.isArray(node.required) ? node.required : Object.keys(props)
  }
  if (node.items) out.items = toGeminiSchema(node.items as Record<string, unknown>)
  return out
}

/** Standard JSON Schema with the keywords Gemini's `responseJsonSchema` does not accept removed. */
export function sanitizeStandard(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitizeStandard)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) if (!DROP.has(k)) out[k] = sanitizeStandard(v)
  return out
}

export class GeminiFailure extends Error { constructor(public status: number, message: string) { super(message) } }

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

/** One structured call. Gemini's own Schema shape first (most reliable), standard JSON Schema second. */
export async function geminiJson(apiKey: string, model: string, system: string, parts: Part[], schema: Record<string, unknown>, opts: { maxOutputTokens?: number; temperature?: number } = {}): Promise<{ data: unknown; usage: Record<string, unknown> | null }> {
  const attempts: Array<Record<string, unknown>> = [{ responseSchema: toGeminiSchema(schema) }, { responseJsonSchema: sanitizeStandard(schema) }]
  let last: GeminiFailure | null = null
  for (const cfg of attempts) {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: opts.temperature ?? 0.2, responseMimeType: 'application/json', maxOutputTokens: opts.maxOutputTokens ?? 6000, ...cfg },
      }),
      signal: AbortSignal.timeout(55_000),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      const message = ((body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`).slice(0, 300)
      last = new GeminiFailure(res.status, message)
      if (res.status === 400 && /schema/i.test(message)) continue
      throw last
    }
    const cands = (body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> | undefined) ?? []
    const text = cands[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new GeminiFailure(502, `The model returned no content (${cands[0]?.finishReason ?? 'no candidate'}).`)
    try { return { data: JSON.parse(text), usage: (body.usageMetadata as Record<string, unknown>) ?? null } }
    catch { throw new GeminiFailure(502, 'The model returned something that is not JSON.') }
  }
  throw last ?? new GeminiFailure(502, 'The model did not answer.')
}
