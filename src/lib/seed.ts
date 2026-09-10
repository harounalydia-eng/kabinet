import { tone, type Tone } from './catalog'
import type { Collection, Save, Category } from './types'

type Row = [title: string, tone: Tone, w: number, h: number, category: Category, sub: string, collection: 'c1' | 'c2' | 'c3' | null, note?: string, tags?: string[]]

const ROWS: Row[] = [
  ['Daylight', 'ivory', 4, 5, 'Skin', 'Texture', 'c1', 'Texture visible, nothing hidden.', ['bare', 'daylight']],
  ['Wash day', 'charcoal', 3, 4, 'Hair', 'Wash day', 'c2', '', ['curly', 'diffuser']],
  ['Barrier', 'sand', 1, 1, 'Skin', 'Barrier', 'c1', 'Post-cleanse, no serum yet.', ['barrier']],
  ['Gloss', 'clay', 2, 3, 'Makeup', 'Base', 'c3', '', ['glossy', 'dewy']],
  ['SPF', 'charcoal', 4, 5, 'Skin', 'SPF', null, 'Mineral, no cast.', ['spf']],
  ['Hydration', 'ivory', 5, 4, 'Skin', 'Hydration', 'c1', '', ['hydration']],
  ['Curl', 'mocha', 9, 14, 'Hair', 'Definition', 'c2', 'Diffused. Humidity 70%.', ['curly', 'humidity']],
  ['Brow', 'bone', 1, 1, 'Makeup', 'Brow', 'c3', '', ['brow']],
  ['Hands', 'stone', 3, 4, 'Nails', 'Manicure', null, 'Short, bare, buffed.', ['short nails']],
  ['Scalp', 'clay', 4, 5, 'Hair', 'Scalp', 'c2', '', ['scalp']],
  ['Lip', 'wine', 4, 5, 'Makeup', 'Lip', 'c3', 'Sheer, blotted.', ['red lip']],
  ['Balm', 'bone', 3, 2, 'Body', 'Hands', null, '', ['balm']],
  ['Flash', 'ivory', 3, 4, 'Skin', 'Texture', 'c1', 'On-camera flash, real texture.', ['flash', 'texture']],
  ['Oil', 'sand', 2, 3, 'Body', 'After shower', null, '', ['body oil']],
  ['Treat', 'mocha', 4, 5, 'Skin', 'Treatment', 'c1', '', ['azelaic']],
  ['Body', 'stone', 3, 4, 'Body', 'After shower', null, 'After shower, before lotion.', []],
  ['Braid', 'charcoal', 2, 3, 'Hair', 'Protective', 'c2', '', ['braid']],
  ['Tone', 'clay', 1, 1, 'Skin', 'Tone', null, '', ['tone']],
  ['Sleep', 'bone', 5, 4, 'Wellness', 'Sleep', null, '8h. Skin noticeably calmer.', ['sleep']],
  ['Serum', 'sand', 9, 16, 'Skin', 'Treatment', null, '', ['serum']],
  ['Cheek', 'ivory', 4, 5, 'Makeup', 'Cheek', 'c3', '', ['cream blush']],
  ['Length', 'mocha', 3, 4, 'Hair', 'Growth', 'c2', 'Month 4.', ['growth']],
  ['Nails', 'bone', 1, 1, 'Nails', 'Manicure', null, '', ['sheer']],
  ['Steam', 'stone', 3, 4, 'Wellness', 'Ritual', null, '', ['steam']],
  ['Mask', 'charcoal', 5, 4, 'Skin', 'Mask', null, '', ['mask']],
  ['Heat', 'clay', 2, 3, 'Hair', 'Styling', 'c2', 'Air-dried vs blow-dried.', ['heat']],
]

export function seedCollections(now: number): Collection[] {
  return [
    { id: 'c1', createdAt: now - 40 * 864e5, title: 'Skin in daylight', description: 'Bare skin, natural light, no retouching.', seed: true },
    { id: 'c2', createdAt: now - 32 * 864e5, title: 'Wash day', description: 'Curl definition, wash-day results, humid days.', seed: true },
    { id: 'c3', createdAt: now - 21 * 864e5, title: 'Quiet makeup', description: 'Skin first. One feature at a time.', seed: true },
  ]
}

export function seedSaves(now: number): Save[] {
  return ROWS.map(([title, t, w, h, category, subcategory, collectionId, note, tags], i) => ({
    id: `seed-${String(i + 1).padStart(2, '0')}`,
    createdAt: now - i * 7 * 36e5,
    category,
    subcategory,
    title,
    tags,
    collectionId,
    note: note ?? '',
    image: tone(t, w, h),
    seed: true,
  }))
}
