import {createReceizAppStateFeed, createReceizPublicStoreStateRecord, RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA, type JsonObject, type ReceizPublicStoreSignedPublish} from "@receiz/sdk";
import {canonicalPortableCardJson, type PortableCardAsset} from "../../features/play/portable-card";
import {createPublicWildsCardTransportRecord, parsePublicWildsCardRecord} from "../../features/play/public-card-registry";
import {parseWildzPlayerCoordinate} from "./wildz-player-coordinate";
import {WILDZ_PRODUCT} from "../wildz/product";

/** Restrict the relay to this exact card; Receiz verifies the signature before accepting it. */
export function parseSignedWildzCardPublication(value: unknown, asset: PortableCardAsset) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wildz_public_card_signed_publication_invalid");
  const signed=value as ReceizPublicStoreSignedPublish<JsonObject>;
  const owner=parseWildzPlayerCoordinate(asset.manifest.ownerReceizId);
  const record=parsePublicWildsCardRecord(signed.storeStateRecord);
  if (!owner || !record || signed.schema !== "receiz.public_store.signed_publish.v1"
    || signed.tenantHost !== WILDZ_PRODUCT.domain || signed.merchantReceizId !== owner.profileHandle
    || record.assetId !== asset.id || record.sourceUrl !== `${WILDZ_PRODUCT.origin}/cards/${encodeURIComponent(asset.id)}`
    || canonicalPortableCardJson(record.asset) !== canonicalPortableCardJson(asset)) {
    throw new Error("wildz_public_card_signed_publication_invalid");
  }
  const transport=createPublicWildsCardTransportRecord(record);
  const namespace=`wildz-card:${asset.id}`;
  const expected=createReceizAppStateFeed([createReceizPublicStoreStateRecord({
    sourceUrl:record.sourceUrl,externalCreatorId:owner.profileHandle,title:`${asset.manifest.name} living card`,
    namespace,state:"published",platform:WILDZ_PRODUCT.name,record:transport as unknown as JsonObject,
    data:{storeStateRecord:transport,tenantHost:WILDZ_PRODUCT.domain,merchantReceizId:owner.profileHandle}
  })],{schema:RECEIZ_PUBLIC_STORE_STATE_FEED_SCHEMA,namespace,externalCreatorId:owner.profileHandle});
  if (canonicalPortableCardJson(signed.feed) !== canonicalPortableCardJson(expected)
    || canonicalPortableCardJson(signed.storeStateRecord) !== canonicalPortableCardJson(transport)) {
    throw new Error("wildz_public_card_signed_publication_invalid");
  }
  return {record,signed};
}
