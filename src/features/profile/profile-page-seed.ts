import type { PortableCardAsset } from "../play/portable-card";
import type { WildzMarketValueRead } from "../market/wildz-market-value";
import type { PublicWildzProfile } from "./public-profile";
import type { WildzProfileVaultPacket } from "./profile-vault-packet";
import type { WildzMarketLocalSummaryV129 } from "../market/wildz-market-value-local-v129";

/** Public display data, never ownership or transaction authority. */
export type WildzProfilePageSeed = Readonly<{
  profile: PublicWildzProfile;
  cards: readonly PortableCardAsset[];
  values: Readonly<Record<string, WildzMarketValueRead>>;
  summaries?: Readonly<Record<string, WildzMarketLocalSummaryV129>>;
  artwork: Readonly<Record<string, string>>;
  vaultPacket?: WildzProfileVaultPacket;
}>;

const profiles = new Map<string, WildzProfilePageSeed>();
export function retainWildzProfilePage(seed: WildzProfilePageSeed) {
  profiles.delete(seed.profile.username);
  profiles.set(seed.profile.username, seed);
  while (profiles.size > 12) profiles.delete(profiles.keys().next().value!);
  return seed;
}
export function retainedWildzProfilePage(username: string) { return profiles.get(username) ?? null; }
