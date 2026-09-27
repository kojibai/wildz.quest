import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { isLivingCardAsset } from "./living-card-types";
import { parseWildsWorldAddress, v10PositionToWildsAddress, WILDS_REGION_MICRO_UNITS, type WildsWorldAddress } from "./wilds-world-address";
import type { WildsV10CardContinuityV11 } from "./wilds-card-continuity-v11";

export type WildsHomecomingChoice = "rest" | "follow" | "investigate";
export type WildsHomecomingOffer = Readonly<{
  eventId: string;
  assetId: string;
  meeting: Readonly<{ x: number; z: number }>;
  title: string;
  response: string;
  choices: readonly Readonly<{ id: WildsHomecomingChoice; label: string; response: string }>[];
}>;

const NEAR_MICRO = 4_000_000n;
const REGION_MICRO = BigInt(WILDS_REGION_MICRO_UNITS);

export function wildsHomecomingEventId(assetId: string, meeting: Readonly<{ x: number; z: number }>) {
  return `homecoming:${sha256PortableBasis(canonicalPortableCardJson({ assetId, meeting })).slice(7, 39)}`;
}

function nearMeeting(playerValue: WildsWorldAddress, meeting: Readonly<{ x: number; z: number }>) {
  const player = parseWildsWorldAddress(playerValue);
  const site = v10PositionToWildsAddress(meeting.x, meeting.z);
  const dx = (BigInt(player.regionX) - BigInt(site.regionX)) * REGION_MICRO + BigInt(player.localX - site.localX);
  if (dx < -NEAR_MICRO || dx > NEAR_MICRO) return false;
  const dz = (BigInt(player.regionZ) - BigInt(site.regionZ)) * REGION_MICRO + BigInt(player.localZ - site.localZ);
  return dz >= -NEAR_MICRO && dz <= NEAR_MICRO && dx * dx + dz * dz <= NEAR_MICRO * NEAR_MICRO;
}

/** Pure, cheap per-selected-companion projection. The continuity envelope was verified at restore. */
export function projectWildsHomecomingOffer(input: {
  card: PortableCardAsset;
  continuity: WildsV10CardContinuityV11 | undefined;
  playerAddress: WildsWorldAddress | undefined;
  present: boolean;
  completed: boolean;
}): WildsHomecomingOffer | null {
  const { card, continuity, playerAddress } = input;
  if (!input.present || input.completed || !playerAddress || !continuity?.firstMeeting
    || continuity.assetId !== card.id || continuity.sourceProofDigest !== card.proof.digest
    || card.manifest.variant.generatorVersion !== 3) return null;
  if (isLivingCardAsset(card) && (card.manifest.revisions.at(-1)?.growth.life?.retired || (card.manifest.revisions.at(-1)?.growth.life?.vitality ?? 1) <= 0)) return null;
  try {
    if (!nearMeeting(playerAddress, continuity.firstMeeting)) return null;
  } catch {
    return null;
  }
  const identity = card.manifest.variant.traits.identity;
  const eventId = wildsHomecomingEventId(card.id, continuity.firstMeeting);
  return {
    eventId,
    assetId: card.id,
    meeting: continuity.firstMeeting,
    title: `${card.manifest.name} remembers this place`,
    response: `${card.manifest.name} slows at the place you first met. ${identity.motion.reunion}. Their ${identity.personality.temperament} attention settles on an old trace in the ground.`,
    choices: [
      { id: "rest", label: "Rest together", response: `${card.manifest.name} settles into ${identity.personality.comfortBehavior}. You remember this place together.` },
      { id: "follow", label: "Follow an old trail", response: `${card.manifest.name} leads a short path, eager for ${identity.personality.favoriteActivity}. The return becomes part of your shared history.` },
      { id: "investigate", label: "See what changed", response: `${card.manifest.name} investigates ${identity.personality.curiosity}. The familiar place has a new detail to remember.` }
    ]
  };
}
