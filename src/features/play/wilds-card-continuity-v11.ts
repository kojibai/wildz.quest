import { currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import { canonicalPortableCardJson, sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

export type WildsV10CardContinuityV11 = Readonly<{
  schema: "wildz.v10-card-continuity.v11";
  assetId: string;
  sourceProofDigest: string;
  legacyBirthDigest: string;
  revisionHead: string | null;
  birthLaw: "v10-catalog";
  originalRarity: PortableCardAsset["manifest"]["rarity"];
  firstMeeting: Readonly<{ x: number; z: number }> | null;
  digest: string;
}>;

const continuityByInventory = new WeakMap<readonly PortableCardAsset[], Record<string, WildsV10CardContinuityV11>>();

/** A verified presentation binding beside the old card, never a rewritten birth. */
export function upgradeVerifiedV10Card(card: PortableCardAsset): WildsV10CardContinuityV11 {
  if (!verifyAnyWildsCard(card).ok) throw new Error("wilds_v10_card_unverified");
  const meeting = card.manifest.variant.generatorVersion === 3
    ? card.manifest.variant.traits.identity.discovery.location : null;
  const basis = {
    schema: "wildz.v10-card-continuity.v11" as const,
    assetId: card.id,
    sourceProofDigest: card.proof.digest,
    legacyBirthDigest: isLivingCardAsset(card) ? card.manifest.birth.legacyDigest ?? card.proof.digest : card.proof.digest,
    revisionHead: isLivingCardAsset(card) ? currentRevision(card).digest : null,
    birthLaw: "v10-catalog" as const,
    originalRarity: card.manifest.rarity,
    firstMeeting: meeting ? { x: meeting.x, z: meeting.z } : null
  };
  return { ...basis, digest: sha256PortableBasis(canonicalPortableCardJson(basis)) };
}

export function verifyV10CardContinuityV11(card: PortableCardAsset, continuity: WildsV10CardContinuityV11): boolean {
  try {
    return canonicalPortableCardJson(upgradeVerifiedV10Card(card)) === canonicalPortableCardJson(continuity);
  } catch {
    return false;
  }
}

export function projectV10CardContinuityV11(cards: readonly PortableCardAsset[]): Record<string, WildsV10CardContinuityV11> {
  const cached = continuityByInventory.get(cards);
  if (cached) return cached;
  const projected = Object.fromEntries(cards.map(card => [card.id, upgradeVerifiedV10Card(card)]));
  continuityByInventory.set(cards, projected);
  return projected;
}
