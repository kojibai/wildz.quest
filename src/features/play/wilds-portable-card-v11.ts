import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { verifyWildsV11Birth, type WildsV11CreatureCard } from "./wilds-card-proof-v11";

export const WILDS_V11_LOCAL_CARD_SCHEMA = "wildz.local-creature-card.v11" as const;

/** A local capture envelope. Ownership admission and transfer remain separate Receiz actions. */
export type WildsV11LocalCard = Readonly<{
  schema: typeof WILDS_V11_LOCAL_CARD_SCHEMA;
  id: string;
  status: "sealed_local";
  ownerId: string;
  capturedAt: string;
  birth: WildsV11CreatureCard;
  proofDigest: string;
}>;

function canonicalCaptureTime(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && milliseconds >= 0 && new Date(milliseconds).toISOString() === value;
}

function creatureId(birth: WildsV11CreatureCard) {
  return `wildz:creature:${sha256PortableBasis(canonicalPortableCardJson({
    generator: birth.birth.generator, identity: birth.birth.identity
  }))}`;
}

function cardBasis(birth: WildsV11CreatureCard, ownerId: string, capturedAt: string) {
  return { schema: WILDS_V11_LOCAL_CARD_SCHEMA, id: creatureId(birth), status: "sealed_local" as const,
    ownerId, capturedAt, birth };
}

/** Verification precedes local sealing; this never asserts that the capture or custody was globally admitted. */
export async function sealLocalWildsV11Card(birth: WildsV11CreatureCard, ownerId: string, capturedAt: string,
  pinnedKeys: Readonly<Record<string, string>>): Promise<WildsV11LocalCard> {
  if (ownerId !== birth.encounter.input.actorId || !canonicalCaptureTime(capturedAt)
    || !await verifyWildsV11Birth(birth, pinnedKeys)) throw new Error("wilds_v11_local_card_invalid");
  const basis = cardBasis(birth, ownerId, capturedAt);
  return { ...basis, proofDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
}

/** Browser-local birth and envelope replay; a local capture time is not an authority signature. */
export async function verifyLocalWildsV11Card(card: WildsV11LocalCard,
  pinnedKeys: Readonly<Record<string, string>>): Promise<boolean> {
  try {
    if (card.schema !== WILDS_V11_LOCAL_CARD_SCHEMA || card.status !== "sealed_local"
      || card.ownerId !== card.birth.encounter.input.actorId || !canonicalCaptureTime(card.capturedAt)
      || !await verifyWildsV11Birth(card.birth, pinnedKeys)) return false;
    const basis = cardBasis(card.birth, card.ownerId, card.capturedAt);
    const expected = { ...basis, proofDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
    return canonicalPortableCardJson(card) === canonicalPortableCardJson(expected);
  } catch {
    return false;
  }
}
