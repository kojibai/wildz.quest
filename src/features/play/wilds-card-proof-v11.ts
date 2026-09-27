import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyEncounterResultV11, verifyEncounterResultV11Sync, type WildsV11EncounterResult } from "./wilds-encounter-proof-v11";
import { generateCreatureBirthV11, type WildsV11CreatureBirth } from "./wilds-creature-generator-v11";

export const WILDS_CREATURE_CARD_V11 = "wildz.creature-card.v11" as const;

export type WildsV11CreatureCard = Readonly<{
  schema: typeof WILDS_CREATURE_CARD_V11;
  encounter: WildsV11EncounterResult;
  birth: WildsV11CreatureBirth;
  proofDigest: string;
}>;

/** The immutable birth record is separate from later capture and living revisions. */
export async function sealWildsV11Birth(encounter: WildsV11EncounterResult, pinnedKeys: Readonly<Record<string, string>>): Promise<WildsV11CreatureCard> {
  if (!await verifyEncounterResultV11(encounter, pinnedKeys)) throw new Error("wilds_v11_encounter_unverified");
  const birth = generateCreatureBirthV11(encounter);
  const basis = { schema: WILDS_CREATURE_CARD_V11, encounter, birth };
  return { ...basis, proofDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
}

/** Fully browser-local; global duplicate admission still requires the authority ledger. */
export async function verifyWildsV11Birth(card: WildsV11CreatureCard, pinnedKeys: Readonly<Record<string, string>>): Promise<boolean> {
  try {
    if (card.schema !== WILDS_CREATURE_CARD_V11 || !await verifyEncounterResultV11(card.encounter, pinnedKeys)) return false;
    const birth = generateCreatureBirthV11(card.encounter);
    if (canonicalPortableCardJson(card.birth) !== canonicalPortableCardJson(birth)) return false;
    const basis = { schema: WILDS_CREATURE_CARD_V11, encounter: card.encounter, birth };
    return card.proofDigest === sha256PortableBasis(canonicalPortableCardJson(basis))
      && canonicalPortableCardJson(card) === canonicalPortableCardJson({ ...basis, proofDigest: card.proofDigest });
  } catch {
    return false;
  }
}

export function verifyWildsV11BirthSync(card: WildsV11CreatureCard, pinnedKeys: Readonly<Record<string, string>>): boolean {
  try {
    if (card.schema !== WILDS_CREATURE_CARD_V11 || !verifyEncounterResultV11Sync(card.encounter, pinnedKeys)) return false;
    const birth = generateCreatureBirthV11(card.encounter);
    if (canonicalPortableCardJson(card.birth) !== canonicalPortableCardJson(birth)) return false;
    const basis = { schema: WILDS_CREATURE_CARD_V11, encounter: card.encounter, birth };
    return card.proofDigest === sha256PortableBasis(canonicalPortableCardJson(basis))
      && canonicalPortableCardJson(card) === canonicalPortableCardJson({ ...basis, proofDigest: card.proofDigest });
  } catch {
    return false;
  }
}
