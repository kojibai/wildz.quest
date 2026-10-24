import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { resolvePublicWildzProfileRecord } from "./wildz-profile-adapter";
import { resolvePublicWildsCardRecord } from "./wildz-public-card-resolver";
import { WILDZ_PRODUCT } from "../wildz/product";
import { createReceizCommerceAdapter } from "./adapter";
import { createReceizWildzPublicRepository } from "./wildz-public-repository";
import { createPublicWildzProfileRecord } from "./wildz-profile-record";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "../../features/profile/public-profile";

// Public page display only. The confirmation API and transaction authority
// still read fresh sources; publication invalidates this prepared page.
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
export const loadWildzProfilePageSeed = cache(async (handle: string) => {
  const username = canonicalWildzHandle(handle);
  return unstable_cache(async () => {
    // Prepare the renderer and deterministic display math beside the current
    // source read, matching the complete public-profile delivery path.
    const preparation = Promise.all([import("./wildz-profile-page-seed"), import("./wildz-prepared-card-artwork")]);
    const [record, [{ prepareWildzProfilePageSeed }, { prepareVerifiedWildzCardArtwork }]] = await Promise.all([publicRecord(username), preparation]);
    if (!record) return null;
    return prepareWildzProfilePageSeed(record, async card =>
      (await resolvePublicWildsCardRecord(card.id, WILDZ_PRODUCT.origin, username).catch(() => null))?.asset ?? null,
    asset => prepareVerifiedWildzCardArtwork(asset, WILDZ_PRODUCT.origin));
  }, ["wildz-profile-page-v3", username], { revalidate: 60, tags: [`wildz-profile-page:${username}`] })();
});
