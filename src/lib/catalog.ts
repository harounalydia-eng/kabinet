import type { Look, OwnedProduct, Product } from './types'

/* Tints are the ones the Figma file uses for image-less objects. */
export const T = {
  sand: ['#D1C7B5', '#C3B7A2'],
  clay: ['#BAAD9E', '#A99B8A'],
  ivory: ['#EDE5D9', '#E2D8C8'],
  bone: ['#EBE5DB', '#DCD3C4'],
  mocha: ['#D6C9B8', '#C8B9A5'],
  charcoal: ['#383833', '#2A2A26'],
  stone: ['#A89F8F', '#968C7C'],
  wine: ['#6B3A3C', '#4A0E13'],
} as const
export type Tone = keyof typeof T

export const tone = (t: Tone, w: number, h: number, label?: string) =>
  ({ kind: 'tone', tone: T[t][0], tone2: T[t][1], label, w: w * 200, h: h * 200 }) as const

/**
 * A product photograph from KABINET's catalog (catalog_products.image_url), snapshotted here so the
 * product renders before — and without — a network round trip. `catalogProductId` is the live link;
 * ProductImage re-resolves it when the row changes. Products with no catalog match keep a tone tile.
 */
export const packshot = (url: string, w: number, h: number) => ({ kind: 'url', url, w, h }) as const

/* No demo shelf: My Kabinet only ever contains what the user adds. */
export const OWNED_SEED: OwnedProduct[] = []

/* ── Products that appear in looks. No compatibility is stored here: it is only ever computed for a real profile.
   Resolved against catalog_products on 2026-09-11: 7 of 12 matched (catalogProductId + packshot); the other 5 are
   not in Open Beauty Facts yet and keep their tone tile until a provider has them. ── */
const P = {
  diorGlow: {
    id: 'p-dior-glow', brand: 'Dior', productName: 'Forever Skin Glow', category: 'Makeup', productType: 'Foundation', role: 'base',
    catalogProductId: 'c7c6ea46-2712-4e39-ab9e-a80e3470ae32', image: packshot('https://images.openbeautyfacts.org/images/products/334/890/161/4900/front_en.4.full.jpg', 1846, 2096), price: 59, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A radiant-finish liquid foundation with SPF.',
    designedTo: 'Even the look of skin tone with a luminous finish and medium, buildable coverage.',
    description: 'A hydrating, radiant foundation designed for a glow that reads as skin rather than makeup.',
    ingredients: ['Aqua', 'Dimethicone', 'Glycerin', 'Titanium dioxide', 'Niacinamide', 'Phenoxyethanol', 'Fragrance', 'Pigments'],
    keyIngredients: ['Niacinamide', 'Glycerin', 'Dimethicone'],
    considerations: ['Contains fragrance.', 'Silicone-based texture — pairs best with silicone-compatible primers and SPF.'],
  },
  ordinaryNia: {
    id: 'p-ord-nia', brand: 'The Ordinary', productName: 'Niacinamide 10% + Zinc 1%', category: 'Skin', productType: 'Serum', role: 'treat',
    image: tone('bone', 3, 4), price: 6.5, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A water-based serum with a high concentration of niacinamide.',
    designedTo: 'Address the appearance of oiliness, congestion and uneven tone.',
    ingredients: ['Aqua', 'Niacinamide', 'Zinc PCA', 'Glycerin', 'Phenoxyethanol'],
    keyIngredients: ['Niacinamide', 'Zinc PCA'],
    considerations: ['High-strength niacinamide; some people prefer to introduce it gradually.', 'Fragrance-free.'],
  },
  glossier: {
    id: 'p-gl-cloud', brand: 'Glossier', productName: 'Cloud Paint', category: 'Makeup', productType: 'Cream blush', role: 'cheek',
    image: tone('clay', 3, 4), price: 22, currency: '€', retailer: 'Glossier', purchaseUrl: 'https://www.glossier.com/',
    whatItIs: 'A gel-cream blush in a squeeze tube.',
    designedTo: 'Give a sheer, blendable wash of colour that can be layered on cheeks, lids and lips.',
    ingredients: ['Aqua', 'Glycerin', 'Dimethicone', 'Pigments', 'Phenoxyethanol'],
    keyIngredients: ['Glycerin', 'Dimethicone'],
    considerations: ['Fragrance-free.'],
  },
  rareSpf: {
    id: 'p-supergoop', brand: 'Supergoop!', productName: 'Unseen Sunscreen SPF 40', category: 'Skin', productType: 'Sunscreen', role: 'spf',
    catalogProductId: 'c8792f75-23c0-4116-9fd2-ccd75fdf045b', image: packshot('https://images.openbeautyfacts.org/images/products/081/621/802/6530/front_en.3.full.jpg', 534, 800), price: 38, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A clear, weightless gel sunscreen with a primer-like finish.',
    designedTo: 'Provide broad-spectrum SPF 40 with no visible cast under makeup.',
    ingredients: ['Dimethicone', 'Squalane', 'Vitamin E', 'Phenoxyethanol'],
    keyIngredients: ['Squalane', 'Vitamin E'],
    considerations: ['Chemical (organic) UV filters — check the label for the full filter list.', 'Fragrance-free.'],
  },
  lipstick: {
    id: 'p-mac-ruby', brand: 'MAC', productName: 'Ruby Woo', category: 'Makeup', productType: 'Lipstick', role: 'lip',
    catalogProductId: '3a8265dd-32ff-495f-b103-b9418042a150', image: packshot('https://images.openbeautyfacts.org/images/products/077/360/204/0605/front_en.8.full.jpg', 216, 904), price: 24, currency: '€', retailer: 'MAC', purchaseUrl: 'https://www.maccosmetics.fr/',
    whatItIs: 'A retro-matte lipstick in a blue-toned red.',
    designedTo: 'Deliver a highly pigmented, long-wearing matte finish.',
    ingredients: ['Castor oil', 'Pigments', 'Vitamin E'],
    keyIngredients: ['Castor oil'],
    considerations: ['Very matte texture; a balm underneath keeps lips comfortable.'],
  },
  curlGel: {
    id: 'p-eco-gel', brand: 'Eco Style', productName: 'Olive Oil Gel', category: 'Hair', productType: 'Styling gel', role: 'gel',
    catalogProductId: '97ee1566-b102-4750-ad68-8e354d4d720a', image: packshot('https://images.openbeautyfacts.org/images/products/074/837/800/1112/front_en.9.full.jpg', 562, 750), price: 7, currency: '€', retailer: 'Amazon', purchaseUrl: 'https://www.amazon.fr/',
    whatItIs: 'A firm-hold styling gel with olive oil.',
    designedTo: 'Set curls and coils with a cast that scrunches out once dry.',
    ingredients: ['Aqua', 'Olive oil', 'Glycerin', 'Fragrance'],
    keyIngredients: ['Olive oil', 'Glycerin'],
    considerations: ['Contains fragrance.', 'Glycerin-rich; behaves differently in very high or very low humidity.'],
  },
  leaveIn: {
    id: 'p-curlsmith', brand: 'Curlsmith', productName: 'Weightless Air Dry Cream', category: 'Hair', productType: 'Curl cream', role: 'curl-cream',
    catalogProductId: '294d2d60-7be5-405d-b94c-1b39329c0345', image: packshot('https://images.openbeautyfacts.org/images/products/085/000/541/7163/front_en.8.full.jpg', 822, 1884), price: 26, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A light leave-in cream for wash-and-go styling.',
    designedTo: 'Define curls with soft hold and reduce frizz when air-drying or diffusing.',
    ingredients: ['Aqua', 'Glycerin', 'Flaxseed extract', 'Panthenol', 'Jojoba oil'],
    keyIngredients: ['Flaxseed extract', 'Panthenol', 'Glycerin'],
    considerations: ['Glycerin-rich; behaves differently in very high or very low humidity.'],
  },
  bondOil: {
    id: 'p-olaplex7', brand: 'Olaplex', productName: 'No.7 Bonding Oil', category: 'Hair', productType: 'Hair oil', role: 'hair-oil',
    image: tone('charcoal', 3, 4), price: 30, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A lightweight styling oil with a bond-building ingredient.',
    designedTo: 'Add shine and softness to lengths and ends, with heat protection when styling.',
    ingredients: ['Bis-aminopropyl diglycol dimaleate', 'Argan oil', 'Vitamin E', 'Fragrance'],
    keyIngredients: ['Bis-aminopropyl diglycol dimaleate', 'Argan oil'],
    considerations: ['Contains fragrance.', 'A little goes a long way on fine hair.'],
  },
  polish: {
    id: 'p-essie-sheer', brand: 'Essie', productName: 'Mademoiselle', category: 'Nails', productType: 'Nail polish', role: 'polish',
    image: tone('bone', 3, 4), price: 10, currency: '€', retailer: 'Monoprix',
    whatItIs: 'A sheer, milky pink polish.',
    designedTo: 'Give a clean, natural-looking tint in one or two coats.',
    ingredients: ['Ethyl acetate', 'Nitrocellulose', 'Pigments'],
    keyIngredients: ['Nitrocellulose'],
  },
  bodyOil: {
    id: 'p-nuxe', brand: 'Nuxe', productName: 'Huile Prodigieuse', category: 'Body', productType: 'Body oil', role: 'body-oil',
    catalogProductId: 'f4b12cd1-c27c-459c-a92d-69205264922f', image: packshot('https://images.openbeautyfacts.org/images/products/326/468/001/1016/front_fr.10.full.jpg', 3024, 4032), price: 32, currency: '€', retailer: 'Nuxe', purchaseUrl: 'https://www.nuxe.com/',
    whatItIs: 'A dry oil for face, body and hair.',
    designedTo: 'Soften and add a satin sheen without a greasy feel.',
    ingredients: ['Sweet almond oil', 'Macadamia oil', 'Argan oil', 'Vitamin E', 'Fragrance'],
    keyIngredients: ['Sweet almond oil', 'Macadamia oil', 'Vitamin E'],
    considerations: ['Contains fragrance.'],
  },
  cleanser: {
    id: 'p-cerave', brand: 'CeraVe', productName: 'Hydrating Cleanser', category: 'Skin', productType: 'Cleanser', role: 'cleanse',
    catalogProductId: 'e8b4d940-68da-40e2-8979-62c638e2a3f6', image: packshot('https://images.openbeautyfacts.org/images/products/333/787/559/7180/front_en.35.full.jpg', 1280, 2276), price: 11, currency: '€', retailer: 'Pharmacy',
    whatItIs: 'A non-foaming cream cleanser.',
    designedTo: 'Cleanse without stripping, with ceramides and hyaluronic acid in the base.',
    ingredients: ['Aqua', 'Glycerin', 'Ceramides', 'Hyaluronic acid', 'Phenoxyethanol'],
    keyIngredients: ['Ceramides', 'Hyaluronic acid', 'Glycerin'],
    considerations: ['Fragrance-free.', 'Low-foam texture; some people prefer a second cleanse to remove SPF.'],
  },
  brow: {
    id: 'p-brow', brand: 'Anastasia', productName: 'Clear Brow Gel', category: 'Makeup', productType: 'Brow gel', role: 'brow',
    image: tone('clay', 3, 4), price: 24, currency: '€', retailer: 'Sephora', purchaseUrl: 'https://www.sephora.fr/',
    whatItIs: 'A clear setting gel for brows.',
    designedTo: 'Hold brushed-up brows in place without flaking.',
    ingredients: ['Aqua', 'Acrylates copolymer', 'Glycerin', 'Phenoxyethanol'],
    keyIngredients: ['Acrylates copolymer'],
  },
} satisfies Record<string, Product>

/* ── Explore looks. Tone images stand in for photography until real imagery is connected. ── */
export const CATALOG: Look[] = [
  { id: 'lk-glass', category: 'Makeup', subcategory: 'Base', title: 'Glass skin, no powder', description: 'Sheer tint pressed in with fingers, cream blush high on the cheek, nothing set.', tags: ['glossy', 'dewy', 'acne-prone', 'minimal'], image: tone('ivory', 4, 5), trending: true, products: [P.diorGlow, P.glossier], steps: ['Hydrate, then a pea of tint pressed in with fingers.', 'Cream blush on the high cheek, blended upward.', 'Skip powder. Blot the T-zone with tissue instead.'] },
  { id: 'lk-wash', category: 'Hair', subcategory: 'Wash day', title: 'Wash-day definition in 70% humidity', description: 'Cream then gel on soaking-wet hair, diffused on low until 80% dry.', tags: ['curly', 'humidity', 'frizz', 'diffuser'], image: tone('charcoal', 3, 4), trending: true, products: [P.leaveIn, P.curlGel], steps: ['Apply cream to soaking-wet hair in sections.', 'Rake gel through, then scrunch.', 'Diffuse on low heat, low speed, hands off until the cast forms.'] },
  { id: 'lk-barrier', category: 'Skin', subcategory: 'Barrier', title: 'Barrier-first winter routine', description: 'Three products, no actives on the same night as retinoid.', tags: ['barrier', 'winter', 'sensitive', 'routine'], image: tone('sand', 1, 1), products: [P.cleanser, P.ordinaryNia], steps: ['Cleanse once, lukewarm.', 'Treatment on dry skin, two nights on, one off.', 'Seal with a bland moisturiser.'] },
  { id: 'lk-red', category: 'Makeup', subcategory: 'Lip', title: 'Blue-red lip for olive skin', description: 'Matte lip, bare skin, groomed brow. The lip does all the work.', tags: ['red lip', 'olive skin', 'matte', 'evening'], image: tone('wine', 4, 5), trending: true, products: [P.lipstick, P.brow] },
  { id: 'lk-spf', category: 'Skin', subcategory: 'SPF', title: 'Invisible SPF under makeup', description: 'Gel-cream SPF, one minute to set, then tint.', tags: ['spf', 'no white cast', 'daily'], image: tone('bone', 4, 5), products: [P.rareSpf, P.diorGlow] },
  { id: 'lk-hands', category: 'Nails', subcategory: 'Manicure', title: 'Short, sheer, buffed', description: 'A single coat of a milky sheer over a buffed nail.', tags: ['sheer', 'short nails', 'clean'], image: tone('stone', 3, 4), products: [P.polish] },
  { id: 'lk-braid', category: 'Hair', subcategory: 'Protective', title: 'Low braid for a week of humidity', description: 'Oil on the ends, cream on the lengths, one loose braid.', tags: ['protective', 'braid', 'humidity'], image: tone('mocha', 2, 3), products: [P.bondOil, P.leaveIn] },
  { id: 'lk-body', category: 'Body', subcategory: 'After shower', title: 'Oil on damp skin', description: 'Two pumps on still-wet skin, then a towel pat.', tags: ['body oil', 'damp skin', 'glow'], image: tone('sand', 3, 4), products: [P.bodyOil] },
  { id: 'lk-sleep', category: 'Wellness', subcategory: 'Sleep', title: 'The 8-hour difference', description: 'Not a product. Log sleep for two weeks and compare morning photos.', tags: ['sleep', 'evidence', 'baseline'], image: tone('bone', 5, 4), steps: ['Log sleep hours in the morning check-in.', 'Take the standard photo in the same light.', 'Compare calm days against short nights after 14 days.'] },
  { id: 'lk-brow', category: 'Makeup', subcategory: 'Brow', title: 'Brushed up, nothing else', description: 'Clear gel brushed up and out. Skin bare.', tags: ['brow', 'minimal', 'daytime'], image: tone('clay', 1, 1), products: [P.brow] },
  { id: 'lk-flash', category: 'Skin', subcategory: 'Texture', title: 'Real texture on flash', description: 'Flash photography with nothing hidden. A baseline, not a look.', tags: ['texture', 'baseline', 'flash'], image: tone('ivory', 3, 4), trending: true },
  { id: 'lk-cheek', category: 'Makeup', subcategory: 'Cheek', title: 'One cream, three places', description: 'Cream blush on cheeks, lids and lips.', tags: ['monochrome', 'cream', 'quick'], image: tone('clay', 4, 5), products: [P.glossier] },
  { id: 'lk-oil', category: 'Hair', subcategory: 'Ends', title: 'Bond oil on dry ends only', description: 'One drop, warmed in palms, ends only.', tags: ['oil', 'ends', 'shine'], image: tone('charcoal', 4, 5), products: [P.bondOil] },
  { id: 'lk-steam', category: 'Wellness', subcategory: 'Ritual', title: 'Ten minutes of steam', description: 'Before cleansing, not after. Then cool water.', tags: ['steam', 'ritual', 'evening'], image: tone('stone', 3, 4) },
]

export const PRODUCTS: Product[] = Object.values(P)

export function findLook(id: string): Look | undefined {
  return CATALOG.find((l) => l.id === id)
}

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}

/** Looks that include a product. */
export function looksWith(productId: string): Look[] {
  return CATALOG.filter((l) => l.products?.some((p) => p.id === productId))
}
