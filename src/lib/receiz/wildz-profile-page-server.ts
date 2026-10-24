import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { resolvePublicWildzProfileRecord } from "./wildz-profile-reader";
import { WILDZ_PRODUCT } from "../wildz/product";
import { createPublicWildzProfileRecord } from "./wildz-profile-record";
import type { PublicWildzProfileRecord } from "./wildz-profile-record";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "../../features/profile/public-profile";

// Public page display only. The confirmation API and transaction authority
// still read fresh sources; publication invalidates this prepared page.
const publicRecord = cache(async (username: string) => {
  const source = await resolvePublicWildzProfileRecord(username);
  if (source) return source;
  // Match the public API's older repository recovery as well as signed profiles.
  const [{ createReceizCommerceAdapter }, { createReceizWildzPublicRepository }] = await Promise.all([import("./adapter"), import("./wildz-public-repository")]);
  const { state } = await createReceizWildzPublicRepository({ adapter: createReceizCommerceAdapter() }).load();
  const profile = state.profiles[canonicalWildzHandle(username)];
  if (!profile) return null;
  const record = createPublicWildzProfileRecord(profile, `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(username)}`, state.updatedAt);
  record.vaultCards = profile.vault.flatMap(card => state.cards[card.id]?.proof.digest === card.proofDigest ? [state.cards[card.id]!] : []);
  return record;
});
function preparedPage(handle: string, delivered?: PublicWildzProfileRecord) {
  const username = canonicalWildzHandle(handle);
  return unstable_cache(async () => {
    // Prepare the renderer and deterministic display math beside the current
    // source read, matching the complete public-profile delivery path.
    const preparation = Promise.all([import("./wildz-profile-page-seed"), import("./wildz-prepared-card-artwork")]);
    const [record, [{ prepareWildzProfilePageSeed }, { persistVerifiedWildzCardArtwork }]] = await Promise.all([delivered ?? publicRecord(username), preparation]);
    if (!record) throw new Error("wildz_public_profile_not_found");
    return prepareWildzProfilePageSeed(record, async card => {
      const { resolvePublicWildsCardRecord } = await import("./wildz-public-card-resolver");
      return (await resolvePublicWildsCardRecord(card.id, WILDZ_PRODUCT.origin, username).catch(() => null))?.asset ?? null;
    },
    asset => persistVerifiedWildzCardArtwork(asset, WILDZ_PRODUCT.origin));
  }, ["wildz-profile-page-v6", username], { revalidate: 60, tags: [`wildz-profile-page:${username}`] })();
}
export const loadWildzProfilePageSeed = cache((handle: string) => preparedPage(handle));

/** The fresh confirmation response already admitted this exact public source.
 * Reuse it after delivery instead of fetching the same record/cards on entry. */
export function prepareDeliveredWildzProfilePage(record: PublicWildzProfileRecord) {
  return preparedPage(record.handle, record);
}
