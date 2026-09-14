import { createReceizClient, type JsonObject, type ReceizKeyFile } from "@receiz/sdk";
import { createPublicWildsCardTransportRecord, type PublicWildsCardRecord } from "../../features/play/public-card-registry";
import { WILDZ_PRODUCT } from "../wildz/product";

export type WildzCardSigningInput = { record: PublicWildsCardRecord; merchantReceizId: string; keyFile: ReceizKeyFile };

/** Full new-card proof hashing and serialization belong off the gameplay thread. */
export async function signWildzCardPublication({ record, merchantReceizId, keyFile }: WildzCardSigningInput) {
  const signedPublication = await createReceizClient().publicStore.signPublish({
    tenantHost: WILDZ_PRODUCT.domain, merchantReceizId,
    title: `${record.asset.manifest.name} living card`, sourceUrl: record.sourceUrl,
    namespace: `wildz-card:${record.assetId}`, projectionState: "published",
    platform: WILDZ_PRODUCT.name,
    storeStateRecord: createPublicWildsCardTransportRecord(record) as unknown as JsonObject, keyFile
  });
  return JSON.stringify({ asset: record.asset, signedPublication });
}
