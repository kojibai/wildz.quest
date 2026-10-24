import {parseWildzSignedUploadOwnershipClaim} from "./wildz-upload-ownership";
import { createReceizClient, type JsonObject, type ReceizKeyFile } from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { canonicalWildzProfilePath, type PublicWildzProfile } from "../../features/profile/public-profile";
import { createPublicWildzProfileRecord, verifiedWildzProfileCards } from "./wildz-profile-record";
import { WILDZ_PRODUCT } from "../wildz/product";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzIdentitySession } from "./wildz-identity-repository";
import {wildzMarketCollectionInput} from './wildz-market-collection';
import {createWildzProfileVaultPacket} from '../../features/profile/profile-vault-packet';

export type WildzProfileSigningInput = {
  profile: PublicWildzProfile;
  assets?: readonly PortableCardAsset[];
  session: WildzIdentitySession;
  keyFile: ReceizKeyFile;
  occurredAt?: string;
  publishMarketCollection?: boolean;
  ownershipClaims?: readonly unknown[];
  ownershipHistory?: readonly unknown[];
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
    // Keep the same complete public collection in one compact delivery. Full
    // standalone publications remain independent; rendering never waits on them.
    if (!admittedCards) verifiedWildzProfileCards(record.profile, gallery);
    const packet = createWildzProfileVaultPacket(gallery);
    if (packet) record.vaultPacket = packet;
    record.vaultDeliveryVersion = 1;
  }
  record.publisherKeyId = session.keyId;
  if (input.ownershipClaims?.length) {
    record.ownershipClaims = input.ownershipClaims;
    record.vaultCardRoots = Object.fromEntries(input.ownershipClaims.flatMap(row => {
      const signed = parseWildzSignedUploadOwnershipClaim(row);
      return signed ? [[signed.claim.assetId, signed.claim.cardRootDigest]] : [];
    }));
  }
  if (input.ownershipHistory?.length) record.ownershipHistory = input.ownershipHistory;
  const signedPublication = await createReceizClient().publicStore.signPublish({
    tenantHost: WILDZ_PRODUCT.domain, merchantReceizId: owner.profileHandle,
    title: `${record.profile.displayName} on Wildz`, sourceUrl: record.sourceUrl,
    namespace: `wildz-profile:${record.handle.slice(1)}`, projectionState: "published",
    platform: WILDZ_PRODUCT.name, storeStateRecord: record as unknown as JsonObject, keyFile
  });
  const marketCollectionPublication = input.publishMarketCollection
    ? await createReceizClient().publicStore.signPublish({...wildzMarketCollectionInput(record),keyFile})
    : undefined;
  return { profile: record.profile, body: JSON.stringify({ profile: record.profile, signedPublication, ...(marketCollectionPublication?{marketCollectionPublication}:{}) }) };
}
