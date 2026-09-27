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

const admittedLocalCards = new WeakSet<object>();

function freezeCardGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeCardGraph(child, seen);
  return Object.freeze(value);
}

export function isAdmittedWildsV11LocalCard(value: unknown): value is WildsV11LocalCard {
  return Boolean(value && typeof value === "object" && admittedLocalCards.has(value));
}

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
  const preserved = structuredClone(birth);
  if (ownerId !== preserved.encounter.input.actorId || !canonicalCaptureTime(capturedAt)
    || !await verifyWildsV11Birth(preserved, pinnedKeys)) throw new Error("wilds_v11_local_card_invalid");
  const basis = cardBasis(preserved, ownerId, capturedAt);
  const card = freezeCardGraph({ ...basis, proofDigest: sha256PortableBasis(canonicalPortableCardJson(basis)) });
  admittedLocalCards.add(card);
  return card;
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

/** Restore untrusted saved bytes only after full offline verification; return a separate immutable object. */
export async function admitVerifiedWildsV11LocalCard(value: WildsV11LocalCard,
  pinnedKeys: Readonly<Record<string, string>>): Promise<WildsV11LocalCard> {
  const card = structuredClone(value);
  if (!await verifyLocalWildsV11Card(card, pinnedKeys)) throw new Error("wilds_v11_local_card_unverified");
  freezeCardGraph(card);
  admittedLocalCards.add(card);
  return card;
}
