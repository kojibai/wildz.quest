import "server-only";
import { cache } from "react";
import { resolvePublicWildzProfileRecord } from "./wildz-profile-adapter";
import { prepareWildzProfilePageSeed } from "./wildz-profile-page-seed";
import { resolvePublicWildsCardRecord } from "./wildz-public-card-resolver";
import { WILDZ_PRODUCT } from "../wildz/product";
import { createReceizCommerceAdapter } from "./adapter";
import { createReceizWildzPublicRepository } from "./wildz-public-repository";
import { createPublicWildzProfileRecord } from "./wildz-profile-record";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "../../features/profile/public-profile";

// Keep one fresh public-source read per document. Retention belongs to the
// open browser view, so a new document cannot inherit another Vault revision.
const publicRecord = cache(async (username: string) => {
  const source = await resolvePublicWildzProfileRecord(username);
  if (source) return source;
  // Match the public API's older repository recovery as well as signed profiles.
  const { state } = await createReceizWildzPublicRepository({ adapter: createReceizCommerceAdapter() }).load();
  const profile = state.profiles[canonicalWildzHandle(username)];
  if (!profile) return null;
  const record = createPublicWildzProfileRecord(profile, `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(username)}`, state.updatedAt);
  record.vaultCards = profile.vault.flatMap(card => state.cards[card.id]?.proof.digest === card.proofDigest ? [state.cards[card.id]!] : []);
  return record;
});
export const loadWildzProfilePageSeed = cache(async (username: string) => {
  const record = await publicRecord(username);
  if (!record) return null;
  return prepareWildzProfilePageSeed(record, async card =>
    (await resolvePublicWildsCardRecord(card.id, WILDZ_PRODUCT.origin, username).catch(() => null))?.asset ?? null);
});
