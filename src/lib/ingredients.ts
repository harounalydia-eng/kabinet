/**
 * Ingredient education — what an ingredient is commonly used for in a formulation.
 * Descriptive, not prescriptive: no good/bad, safe/unsafe, and no claims about outcomes.
 */
export interface IngredientInfo {
  name: string
  function: string
  /** Formulation family, e.g. Humectant, Emollient, Silicone, Active, Preservative. */
  family: string
}

const DICTIONARY: Record<string, IngredientInfo> = {
  aqua: { name: 'Aqua', function: 'Water. The base of most formulas and the carrier for water-soluble ingredients.', family: 'Solvent' },
  glycerin: { name: 'Glycerin', function: 'Humectant used to support hydration by drawing water into the upper layers of skin.', family: 'Humectant' },
  niacinamide: { name: 'Niacinamide', function: 'Vitamin B3. Commonly used for barrier support and the appearance of oiliness and uneven tone.', family: 'Active' },
  dimethicone: { name: 'Dimethicone', function: 'Silicone commonly used for smoothing, slip and reducing moisture loss.', family: 'Silicone' },
  'zinc pca': { name: 'Zinc PCA', function: 'Zinc salt commonly used in formulas aimed at the appearance of oiliness.', family: 'Active' },
  'azelaic acid': { name: 'Azelaic acid', function: 'Dicarboxylic acid used in formulas addressing the appearance of uneven tone and texture.', family: 'Active' },
  ceramides: { name: 'Ceramides', function: 'Lipids naturally present in skin; used in formulas to support the moisture barrier.', family: 'Emollient' },
  'hyaluronic acid': { name: 'Hyaluronic acid', function: 'Humectant that binds water at the surface for a hydrated feel.', family: 'Humectant' },
  squalane: { name: 'Squalane', function: 'Lightweight emollient that softens and helps limit moisture loss.', family: 'Emollient' },
  'titanium dioxide': { name: 'Titanium dioxide', function: 'Mineral UV filter used in sunscreens and tinted bases.', family: 'UV filter' },
  'zinc oxide': { name: 'Zinc oxide', function: 'Mineral UV filter, often paired with titanium dioxide.', family: 'UV filter' },
  'shea butter': { name: 'Shea butter', function: 'Rich plant emollient used for softening and conditioning.', family: 'Emollient' },
  'argan oil': { name: 'Argan oil', function: 'Plant oil used for shine and softness on hair and skin.', family: 'Oil' },
  panthenol: { name: 'Panthenol', function: 'Provitamin B5, used for conditioning and a soft feel on skin and hair.', family: 'Conditioning' },
  'castor oil': { name: 'Castor oil', function: 'Viscous plant oil used for gloss and cushion in lip products.', family: 'Oil' },
  'jojoba oil': { name: 'Jojoba oil', function: 'Plant wax ester with a texture close to skin sebum, used for conditioning.', family: 'Oil' },
  'vitamin e': { name: 'Vitamin E (tocopherol)', function: 'Antioxidant used to protect oils in the formula and condition skin.', family: 'Antioxidant' },
  'salicylic acid': { name: 'Salicylic acid', function: 'Oil-soluble exfoliating acid used in formulas for congested-looking skin.', family: 'Active' },
  'glycolic acid': { name: 'Glycolic acid', function: 'Water-soluble exfoliating acid used for surface texture and radiance.', family: 'Active' },
  fragrance: { name: 'Fragrance (parfum)', function: 'Scent. A blend of aroma materials; some people prefer to avoid it.', family: 'Fragrance' },
  phenoxyethanol: { name: 'Phenoxyethanol', function: 'Preservative that keeps a water-based formula stable and safe from microbial growth.', family: 'Preservative' },
  'bis-aminopropyl diglycol dimaleate': { name: 'Bis-aminopropyl diglycol dimaleate', function: 'Bond-building ingredient used in treatments for chemically or heat-stressed hair.', family: 'Hair treatment' },
  'flaxseed extract': { name: 'Flaxseed extract', function: 'Plant mucilage used for soft hold and definition in curl products.', family: 'Styling' },
  'olive oil': { name: 'Olive oil', function: 'Plant oil used for slip and shine in styling and body products.', family: 'Oil' },
  'sweet almond oil': { name: 'Sweet almond oil', function: 'Light plant oil used for softness and a satin finish on skin.', family: 'Oil' },
  'macadamia oil': { name: 'Macadamia oil', function: 'Plant oil used for conditioning and shine.', family: 'Oil' },
  'nitrocellulose': { name: 'Nitrocellulose', function: 'Film former that gives nail polish its glossy, durable coat.', family: 'Film former' },
  'ethyl acetate': { name: 'Ethyl acetate', function: 'Solvent that evaporates as polish dries.', family: 'Solvent' },
  'acrylates copolymer': { name: 'Acrylates copolymer', function: 'Film former used for flexible hold in brow and hair gels.', family: 'Film former' },
  'pigments': { name: 'Pigments (CI)', function: 'Colourants. Listed by CI number on packaging.', family: 'Colour' },
}

export function ingredientInfo(name: string): IngredientInfo {
  const key = name.trim().toLowerCase()
  return DICTIONARY[key] ?? { name: name.trim(), function: 'No note on file for this ingredient yet.', family: '—' }
}

/** Ingredients the dictionary can say something about, in list order. */
export function knownIngredients(list: string[] | undefined): IngredientInfo[] {
  return (list ?? []).filter((n) => n.trim().toLowerCase() in DICTIONARY).map(ingredientInfo)
}
