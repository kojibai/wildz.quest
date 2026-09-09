import {createReceizAppStateFeed, createReceizPublicStoreStateRecord, RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA, type JsonObject, type ReceizPublicStoreSignedPublish} from "@receiz/sdk";
import {canonicalPortableCardJson} from "../../features/play/portable-card";
import {canonicalWildzProfilePath, type PublicWildzProfile} from "../../features/profile/public-profile";
import {parsePublicWildzProfileRecord} from "./wildz-profile-adapter";
import {parseWildzPlayerCoordinate} from "./wildz-player-coordinate";
import {WILDZ_PRODUCT} from "../wildz/product";

/** Constrain signed publication to this one sanitized profile; Receiz verifies its signature. */
export function parseSignedWildzProfilePublication(value: unknown, profile: PublicWildzProfile) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wildz_public_profile_signed_publication_invalid");
  const signed = value as ReceizPublicStoreSignedPublish<JsonObject>;
  const record = parsePublicWildzProfileRecord(signed.storeStateRecord);
  const owner = parseWildzPlayerCoordinate(profile.username);
  if (!owner || !record || signed.schema !== "receiz.public_store.signed_publish.v1"
    || signed.tenantHost !== WILDZ_PRODUCT.domain || signed.merchantReceizId !== owner.profileHandle
    || record.handle !== profile.username || record.sourceUrl !== `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(profile.username)}`
    || canonicalPortableCardJson(record.profile) !== canonicalPortableCardJson(profile)) throw new Error("wildz_public_profile_signed_publication_invalid");
  const namespace = `wildz-profile:${owner.actorId}`;
  const expected = createReceizAppStateFeed([createReceizPublicStoreStateRecord({
    sourceUrl: record.sourceUrl, externalCreatorId: owner.profileHandle, title: `${profile.displayName} on Wildz`,
    namespace, state: "published", platform: WILDZ_PRODUCT.name, record: record as unknown as JsonObject,
    data: {storeStateRecord: record, tenantHost: WILDZ_PRODUCT.domain, merchantReceizId: owner.profileHandle}
  })], {schema: RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA, namespace, externalCreatorId: owner.profileHandle});
  if (canonicalPortableCardJson(signed.feed) !== canonicalPortableCardJson(expected)
    || canonicalPortableCardJson(signed.storeStateRecord) !== canonicalPortableCardJson(record)) throw new Error("wildz_public_profile_signed_publication_invalid");
  return {record, signed};
}
