import type { PortableCardAsset } from "../play/portable-card";
import type { WildzMarketValueRead } from "../market/wildz-market-value";
import type { PublicWildzProfile } from "./public-profile";

/** Public display data, never ownership or transaction authority. */
export type WildzProfilePageSeed = Readonly<{
  profile: PublicWildzProfile;
  cards: readonly PortableCardAsset[];
  values: Readonly<Record<string, WildzMarketValueRead>>;
  artwork: Readonly<Record<string, string>>;
}>;

const profiles = new Map<string, WildzProfilePageSeed>();
export function retainWildzProfilePage(seed: WildzProfilePageSeed) {
  profiles.delete(seed.profile.username);
  profiles.set(seed.profile.username, seed);
  while (profiles.size > 12) profiles.delete(profiles.keys().next().value!);
  return seed;
}
export function retainedWildzProfilePage(username: string) { return profiles.get(username) ?? null; }
