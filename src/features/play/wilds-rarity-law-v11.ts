import type { CreatureRarity } from "./creature-catalog";
import { sha256PortableBasis } from "./portable-card";
import { wildsAddressDistanceSquared, type WildsWorldAddress } from "./wilds-world-address";

export const WILDS_RARITY_LAW_V11 = "wildz.rarity.v11" as const;
export const WILDS_RARITY_DRAW_DENOMINATOR_V11 = 10_000_000;
export type WildsRarityBandV11 = "origin" | "wilds" | "deep-wilds" | "frontier";
export type WildsRarityCountsV11 = Readonly<Record<CreatureRarity, number>>;

const COUNTS: Readonly<Record<WildsRarityBandV11, WildsRarityCountsV11>> = Object.freeze({
  origin: Object.freeze({ eternal: 1, mythic: 10, rare: 1_000, uncommon: 2_000_000, trail: 7_998_989 }),
  wilds: Object.freeze({ eternal: 2, mythic: 20, rare: 2_000, uncommon: 2_000_000, trail: 7_997_978 }),
  "deep-wilds": Object.freeze({ eternal: 5, mythic: 50, rare: 5_000, uncommon: 2_000_000, trail: 7_994_945 }),
  frontier: Object.freeze({ eternal: 10, mythic: 100, rare: 10_000, uncommon: 2_000_000, trail: 7_989_890 })
});
const CLASS_ORDER: readonly CreatureRarity[] = ["eternal", "mythic", "rare", "uncommon", "trail"];
const TWO_TO_64 = 1n << 64n;
const DENOMINATOR = BigInt(WILDS_RARITY_DRAW_DENOMINATOR_V11);
const UNBIASED_LIMIT = TWO_TO_64 / DENOMINATOR * DENOMINATOR;

export function rarityBand(address: WildsWorldAddress): WildsRarityBandV11 {
  const squared = wildsAddressDistanceSquared(address);
  if (squared < 25n * 25n) return "origin";
  if (squared < 125n * 125n) return "wilds";
  if (squared < 500n * 500n) return "deep-wilds";
  return "frontier";
}

export function rarityBandCounts(band: WildsRarityBandV11): WildsRarityCountsV11 {
  const counts = COUNTS[band];
  if (!counts) throw new Error("wilds_rarity_band_unsupported");
  return counts;
}

export function rarityClass(band: WildsRarityBandV11, draw: number): CreatureRarity {
  if (!Number.isInteger(draw) || draw < 0 || draw >= WILDS_RARITY_DRAW_DENOMINATOR_V11) {
    throw new RangeError("wilds_rarity_draw_out_of_range");
  }
  const counts = rarityBandCounts(band);
  let upper = 0;
  for (const className of CLASS_ORDER) {
    upper += counts[className];
    if (draw < upper) return className;
  }
  throw new Error("wilds_rarity_law_invalid");
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

export function rarityOdds(band: WildsRarityBandV11, className: CreatureRarity) {
  const count = rarityBandCounts(band)[className];
  if (!Number.isInteger(count) || count <= 0) throw new Error("wilds_rarity_class_unsupported");
  const divisor = greatestCommonDivisor(BigInt(count), DENOMINATOR);
  return { numerator: BigInt(count) / divisor, denominator: DENOMINATOR / divisor };
}

/** Null signals that modulo would bias this 64-bit block. */
export function reduceUnbiasedRarity64(candidate: bigint): number | null {
  if (candidate < 0n || candidate >= TWO_TO_64) throw new RangeError("wilds_rarity_block_out_of_range");
  return candidate >= UNBIASED_LIMIT ? null : Number(candidate % DENOMINATOR);
}

/** A signed encounter input has one deterministic, domain-separated rarity draw. */
export function deriveUniformRarityDraw(signature: Uint8Array): number {
  if (!(signature instanceof Uint8Array) || signature.length !== 64) throw new Error("wilds_rarity_signature_invalid");
  const signatureHex = Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("");
  for (let block = 0; block < 1024; block += 1) {
    const digest = sha256PortableBasis(`${WILDS_RARITY_LAW_V11}\0draw\0${signatureHex}\0${block}`);
    for (let offset = 7; offset + 16 <= digest.length; offset += 16) {
      const draw = reduceUnbiasedRarity64(BigInt(`0x${digest.slice(offset, offset + 16)}`));
      if (draw !== null) return draw;
    }
  }
  throw new Error("wilds_rarity_rejection_limit");
}
