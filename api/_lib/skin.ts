// The AI skin check contract: what KABINET asks the vision model for, and the boundaries it must keep.
// Server only. Observable, cosmetic characteristics — never a diagnosis, never a score.

export type Severity = 'none' | 'mild' | 'moderate' | 'noticeable'
export type Confidence = 'high' | 'moderate' | 'low'

export const OBSERVATION_TYPES = [
  'visible_blemishes', 'visible_redness', 'texture_appearance', 'visible_dryness', 'visible_oiliness',
  'post_blemish_marks', 'tone_unevenness', 'visible_pores', 'under_eye_appearance',
] as const
export const AREAS = ['forehead', 'temples', 'nose', 'cheeks', 'left cheek', 'right cheek', 'chin', 'jawline', 'under eyes', 'around mouth', 'overall'] as const
export const FOCUS_AREAS = ['blemishes', 'redness', 'texture', 'dryness', 'oiliness', 'post-blemish marks', 'tone', 'pores', 'under-eye'] as const

const CONF = { type: 'string', enum: ['high', 'moderate', 'low'] } as const

export const SCHEMA = {
  type: 'object',
  required: ['scan_quality', 'observations', 'summary', 'suggested_focus_areas', 'limitations', 'comparison'],
  properties: {
    scan_quality: {
      type: 'object',
      required: ['usable', 'confidence', 'note'],
      properties: {
        usable: { type: 'boolean', description: 'false when the photographs cannot support an honest read (no face, too dark, blurred, heavy makeup, filters).' },
        confidence: CONF,
        note: { type: 'string', description: 'One calm sentence about the photographs themselves (light, sharpness, framing). Never about the person.' },
      },
    },
    observations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'areas', 'confidence', 'description'],
        properties: {
          type: { type: 'string', enum: [...OBSERVATION_TYPES] },
          severity: { type: 'string', enum: ['none', 'mild', 'moderate', 'noticeable'], description: 'How visible it is in THESE photographs. "none" when checked and not seen.' },
          areas: { type: 'array', items: { type: 'string', enum: [...AREAS] } },
          confidence: CONF,
          description: { type: 'string', description: 'One or two sentences, observational: what appears where. No causes, no conditions, no advice.' },
        },
      },
    },
    summary: { type: 'string', description: 'Two or three sentences in KABINET\'s voice summarising what is visible today. No score, no judgement.' },
    suggested_focus_areas: { type: 'array', items: { type: 'string', enum: [...FOCUS_AREAS] }, description: 'Up to 3, only where something is visible.' },
    limitations: { type: 'array', items: { type: 'string' }, description: 'What these photographs cannot show (e.g. one side is darker, makeup present).' },
    comparison: {
      type: ['array', 'null'],
      description: 'Only when a previous check is given: per observation type, how today compares with it. Null otherwise.',
      items: {
        type: 'object',
        required: ['type', 'change', 'note'],
        properties: {
          type: { type: 'string', enum: [...OBSERVATION_TYPES] },
          change: { type: 'string', enum: ['appears_improved', 'similar', 'more_visible', 'not_comparable'] },
          note: { type: 'string' },
        },
      },
    },
  },
} as const

export const SYSTEM = `You are KABINET, a personal beauty intelligence. You look at standardized photographs of one person's face (front, left, right) and describe what is VISIBLE about their skin today. You are not a dermatologist and you never diagnose.

Hard rules:
- Describe observable cosmetic characteristics only: visible blemishes, visible redness, texture appearance, visible dryness or flaking, visible oiliness or shine, post-blemish marks, tone unevenness, visible pores, under-eye appearance.
- Never name or imply a medical condition (no acne as a condition, rosacea, eczema, melasma, dermatitis, infection, hormonal anything, cancer). Never suggest causes. Never prescribe or recommend products or ingredients.
- Never rate attractiveness, age, beauty, or compare with other people. No scores, no percentages, no "good/bad skin".
- Language: calm, precise, unhurried. "Visible blemishes are concentrated around the chin and lower cheeks." Not "You have hormonal acne."
- Use the person's own previous check as the only reference when one is given; otherwise there is no comparison.
- If the photographs are unusable (no face, very dark, blurred, filtered, heavy makeup hiding the skin), set scan_quality.usable=false, keep observations empty, and say what to change in the note.
- Be honest about limitations: uneven light, hair covering areas, glasses, one angle missing.
Return JSON only, matching the schema.`

/** Gemini `generateContent` with images + JSON schema. Standard JSON Schema first, then Gemini's own Schema shape. */
export async function geminiVisionJson(
  apiKey: string, model: string, system: string, parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  schema: Record<string, unknown>, toGeminiSchema: (s: Record<string, unknown>) => Record<string, unknown>, maxOutputTokens = 4000,
): Promise<{ data: unknown; usage: Record<string, unknown> | null }> {
  const attempts: Array<Record<string, unknown>> = [{ responseJsonSchema: schema }, { responseSchema: toGeminiSchema(schema) }]
  let last: { status: number; message: string } | null = null
  for (const cfg of attempts) {
    let res: Response | null = null
    let body: Record<string, unknown> = {}
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt))
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts }],
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens, ...cfg },
          }),
          signal: AbortSignal.timeout(45_000),
        })
      } catch (e) {
        last = { status: 503, message: e instanceof Error && e.name === 'TimeoutError' ? 'The model took too long.' : 'The model did not answer.' }
        res = null
        continue
      }
      body = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (res.ok || !(res.status === 429 || res.status >= 500)) break
      last = { status: res.status, message: ((body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`).slice(0, 300) }
    }
    if (!res) throw Object.assign(new Error(last?.message ?? 'The model did not answer.'), { status: last?.status ?? 503 })
    if (!res.ok) {
      const message = ((body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`).slice(0, 300)
      last = { status: res.status, message }
      if (res.status === 400 && /schema|responseJsonSchema|response_json_schema/i.test(message)) continue
      throw Object.assign(new Error(message), { status: res.status })
    }
    const cands = (body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> | undefined) ?? []
    const text = cands[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw Object.assign(new Error(`The model returned no content (${cands[0]?.finishReason ?? 'no candidate'}).`), { status: 502 })
    try { return { data: JSON.parse(text), usage: (body.usageMetadata as Record<string, unknown>) ?? null } }
    catch { throw Object.assign(new Error('The model returned something that is not JSON.'), { status: 502 }) }
  }
  throw Object.assign(new Error(last?.message ?? 'The model did not answer.'), { status: last?.status ?? 502 })
}
