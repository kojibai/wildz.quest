import { createReceizClient, type JsonObject, type ReceizKeyFile } from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { canonicalWildzProfilePath, type PublicWildzProfile } from "../../features/profile/public-profile";
import { createPublicWildzProfileRecord, verifiedWildzProfileCards } from "./wildz-profile-adapter";
import { WILDZ_PRODUCT } from "../wildz/product";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzIdentitySession } from "./wildz-identity-repository";

export type WildzProfileSigningInput = {
  profile: PublicWildzProfile;
  assets?: readonly PortableCardAsset[];
  session: WildzIdentitySession;
  keyFile: ReceizKeyFile;
  occurredAt?: string;
};

/** Pure SDK signing work; the browser runs verification, hashing and JSON in a worker. */
export async function signWildzProfilePublication(input: WildzProfileSigningInput, admittedCards = false) {
  const { session, keyFile } = input;
  const owner = parseWildzPlayerCoordinate(input.profile.username);
  if (session.localAuthority !== "verified") throw new Error("wildz_profile_identity_seal_required");
  if (!owner || !sameWildzPlayerCoordinate(owner.actorId, session.actorId)
    || keyFile.keyId !== session.keyId
    || (session.remoteStatus !== "connected" && !sameWildzPlayerCoordinate(keyFile.owner.username ?? "", owner.actorId))) {
    throw new Error("wildz_public_profile_owner_mismatch");
  }
  if (!keyFile.crypto.privateKeyPkcs8B64u && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length) throw new Error("wildz_profile_identity_unlock_required");
  const record = createPublicWildzProfileRecord(input.profile as unknown as Record<string, unknown>, `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(input.profile.username)}`, input.occurredAt);
  if (input.assets !== undefined) {
    const assetsById = new Map(input.assets.map(asset => [asset.id, asset]));
    const gallery = record.profile.vault.map(entry => {
      const asset = assetsById.get(entry.id);
      if (!asset || asset.proof.digest !== entry.proofDigest) throw new Error("wildz_public_profile_card_unverified");
      return asset;
    });
    // Admission is local and content-bound. Publish only the gallery references;
    // embedding full proofs repeats their histories throughout the SDK envelope.
    // Full card publication remains independent of this signed display projection.
    if (!admittedCards) verifiedWildzProfileCards(record.profile, gallery);
  }
  const signedPublication = await createReceizClient().publicStore.signPublish({
    tenantHost: WILDZ_PRODUCT.domain, merchantReceizId: owner.profileHandle,
    title: `${record.profile.displayName} on Wildz`, sourceUrl: record.sourceUrl,
    namespace: `wildz-profile:${record.handle.slice(1)}`, projectionState: "published",
    platform: WILDZ_PRODUCT.name, storeStateRecord: record as unknown as JsonObject, keyFile
  });
  return { profile: record.profile, body: JSON.stringify({ profile: record.profile, signedPublication }) };
}
