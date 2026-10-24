/**
 * The categories a medicine is tagged with (docs/model.md, "Medicine" → tags):
 * the pharmacy-style list from docs/screens.md, "Categories". A medicine can
 * have several. Own categories the person adds are rows in the database; a tag
 * then holds that row's id instead of one of these keys.
 */

export const CATEGORIES = [
  'pain',
  'cold',
  'allergy',
  'vitamins',
  'heart',
  'stomach',
  'antibiotics',
  'skin',
  'eye_ear_nose',
  'nerves_sleep',
  'first_aid',
] as const;
export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/**
 * Our own ATC → category table. A code matches every prefix listed here, so
 * one code can give several categories (nasal antiallergics are both allergy
 * and eye, ear and nose). Codes not covered give none: the person picks.
 */
const ATC_CATEGORIES: readonly [prefix: string, category: Category][] = [
  ['N02', 'pain'], // analgesics, migraine
  ['M01A', 'pain'], // anti-inflammatory: ibuprofen, diclofenac
  ['M02A', 'pain'], // the same, on the skin over joints and muscles
  ['R05', 'cold'], // cough and cold
  ['R02', 'cold'], // throat
  ['R01A', 'cold'], // nasal decongestants
  ['J05AH', 'cold'], // flu antivirals
  ['R06', 'allergy'], // antihistamines
  ['R01AC', 'allergy'],
  ['R01AD', 'allergy'], // nasal corticosteroids
  ['S01G', 'allergy'], // allergy eye drops
  ['A11', 'vitamins'],
  ['A12', 'vitamins'], // minerals: calcium, magnesium
  ['B03', 'vitamins'], // iron, folic acid
  ['C', 'heart'],
  ['B01', 'heart'], // blood thinners
  ['A02', 'stomach'], // acidity, heartburn
  ['A03', 'stomach'], // spasms, bloating
  ['A04', 'stomach'], // nausea
  ['A05', 'stomach'], // liver and bile
  ['A06', 'stomach'], // constipation
  ['A07', 'stomach'], // diarrhoea, adsorbents, probiotics
  ['A09', 'stomach'], // digestive enzymes
  ['J01', 'antibiotics'],
  ['D', 'skin'],
  ['S', 'eye_ear_nose'],
  ['R01', 'eye_ear_nose'],
  ['N05', 'nerves_sleep'], // sedatives, sleep
  ['N06A', 'nerves_sleep'], // antidepressants
  ['D08', 'first_aid'], // antiseptics
  ['D03', 'first_aid'], // wounds and burns
  ['A07B', 'first_aid'], // activated charcoal and other adsorbents
];

/** The categories for a medicine's ATC codes, in the order of CATEGORIES. */
export function categoriesForAtc(codes: readonly string[]): Category[] {
  const found = new Set<Category>();
  for (const raw of codes) {
    const code = raw.trim().toUpperCase();
    if (!code) continue;
    for (const [prefix, category] of ATC_CATEGORIES) {
      if (code.startsWith(prefix)) found.add(category);
    }
  }
  return CATEGORIES.filter((c) => found.has(c));
}
