/**
 * Medicines with no proven effect (docs/model.md, "No proven effect"): a short
 * list kept by hand, one reviewed source per row. Homeopathy has no INN, so it
 * is told by the Register's own words. Only shown to a person who turned the
 * marking on.
 */

export interface EvidenceNote {
  /** The INN, or `homeopathy` for every homeopathic product. */
  key: string;
  /**
   * Trade names, for a product the Register files under «Mono» with no INN of its
   * own (Церебролізин, Актовегін). Matched as the start of the name.
   */
  names?: readonly string[];
  /** The review that found no proven effect. */
  source: string;
  sourceName: string;
  /** A person has checked the row against the source; unreviewed rows are not used. */
  reviewed: boolean;
}

export const HOMEOPATHY = 'homeopathy';

export const EVIDENCE_NOTES: readonly EvidenceNote[] = [
  {
    key: HOMEOPATHY,
    source: 'https://www.nhmrc.gov.au/about-us/publications/homeopathy',
    sourceName: 'NHMRC',
    reviewed: true,
  },
  {
    key: 'Piracetam',
    source: 'https://www.cochrane.org/CD001011/DEMENTIA_piracetam-for-dementia-or-cognitive-impairment',
    sourceName: 'Cochrane',
    reviewed: false,
  },
  {
    key: 'Vinpocetine',
    source: 'https://www.cochrane.org/evidence/CD003119_insufficient-evidence-benefits-vinpocetine-people-dementia',
    sourceName: 'Cochrane',
    reviewed: false,
  },
  {
    key: 'Cerebrolysin',
    names: ['ЦЕРЕБРОЛІЗИН'],
    source: 'https://www.cochrane.org/evidence/CD007026_cerebrolysin-acute-ischaemic-stroke',
    sourceName: 'Cochrane',
    reviewed: false,
  },
  {
    key: 'Actovegin',
    names: ['АКТОВЕГІН'],
    source: 'https://doi.org/10.1371/journal.pone.0270497',
    sourceName: 'PLoS One',
    reviewed: false,
  },
];

/** What the Register says of a product, as far as the marking needs it. */
export interface RegisterFacts {
  name: string;
  inn: string | null;
  composition: string | null;
  formText: string;
  atc: readonly string[];
}

// A potency: «D6», «С30», «200К», «1000CH», «LM6». Both Latin and Cyrillic letters.
const POTENCY =
  /гомеопат|(?:^|[^\p{L}\p{N}])(?:[DСCДK]|LM)\s?\d{1,4}(?![\p{L}\p{N}])|\d{1,4}\s?(?:CH|СН|К|K|C|С)(?![\p{L}\p{N}])/iu;

/**
 * Homeopathic products have no ATC code in the Register and name their
 * dilutions in the composition («Aconitum D6», «C12, C30 та C200»). The ATC
 * check keeps out «вітамін D3» and the like.
 */
export function isHomeopathic(r: Pick<RegisterFacts, 'composition' | 'formText' | 'atc'>): boolean {
  return r.atc.length === 0 && POTENCY.test(`${r.composition ?? ''} ${r.formText}`);
}

/** The note for a product, or null when it has none (or none reviewed). */
export function evidenceNote(
  r: RegisterFacts,
  notes: readonly EvidenceNote[] = EVIDENCE_NOTES,
): EvidenceNote | null {
  const shipped = notes.filter((n) => n.reviewed);
  const inn = r.inn?.trim().toLowerCase();
  const byInn = inn ? shipped.find((n) => n.key.toLowerCase() === inn) : undefined;
  if (byInn) return byInn;
  const name = r.name.trim().toUpperCase();
  const byName = shipped.find((n) => n.names?.some((x) => name.startsWith(x)));
  if (byName) return byName;
  return isHomeopathic(r) ? (shipped.find((n) => n.key === HOMEOPATHY) ?? null) : null;
}
