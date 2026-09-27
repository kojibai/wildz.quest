import type { CreatureRarity } from "./creature-catalog";
import { rarityBandCounts, rarityOdds, WILDS_RARITY_DRAW_DENOMINATOR_V11, WILDS_RARITY_LAW_V11, type WildsRarityBandV11 } from "./wilds-rarity-law-v11";

export const WILDS_RARITY_BANDS_V11 = ["origin", "wilds", "deep-wilds", "frontier"] as const satisfies readonly WildsRarityBandV11[];
export const WILDS_RARITY_CLASSES_V11 = ["trail", "uncommon", "rare", "mythic", "eternal"] as const satisfies readonly CreatureRarity[];

export type PublicRarityRowV11 = Readonly<{
  law: typeof WILDS_RARITY_LAW_V11;
  band: WildsRarityBandV11;
  className: CreatureRarity;
  count: number;
  outcomes: number;
  numerator: string;
  denominator: string;
  exactProbability: string;
  scarcityBits: number;
}>;

/** Public copy and conformance fixtures consume the same integer law as encounters. */
export function publicRarityTableV11(): readonly PublicRarityRowV11[] {
  return WILDS_RARITY_BANDS_V11.flatMap(band => WILDS_RARITY_CLASSES_V11.map(className => {
    const { numerator, denominator } = rarityOdds(band, className);
    const count = rarityBandCounts(band)[className];
    return {
      law: WILDS_RARITY_LAW_V11,
      band,
      className,
      count,
      outcomes: WILDS_RARITY_DRAW_DENOMINATOR_V11,
      numerator: numerator.toString(),
      denominator: denominator.toString(),
      exactProbability: `${numerator}/${denominator}`,
      scarcityBits: Number(Math.log2(Number(denominator) / Number(numerator)).toFixed(2))
    };
  }));
}
