import {parsePublicCardParam,parsePublicWildsCardRecord} from "../src/features/play/public-card-registry";
import {WILDZ_PRODUCT} from "../src/lib/wildz/product";
import {openCreatureTrailExperience} from "./creature-experience";

/** Run on the experience server; no owner cookie is needed to read a published card. */
export async function openPublicCreatureTrail(
  cardId: string,
  fetcher: typeof fetch = globalThis.fetch,
  signal?: AbortSignal
) {
  const {assetId}=parsePublicCardParam(cardId);
  const response=await fetcher(`${WILDZ_PRODUCT.origin}/api/cards/${encodeURIComponent(assetId)}`,{
    credentials:"omit",cache:"no-store",signal
  });
  if(response.status===404)return {ok:false as const,reason:"public_card_unavailable"};
  if(!response.ok)throw new Error("public_card_recovery_failed");
  const result=await response.json() as {ok?:boolean;record?:unknown};
  const record=parsePublicWildsCardRecord(result.record);
  if(result.ok!==true || record?.assetId!==assetId)return {ok:false as const,reason:"public_card_unverified"};
  return openCreatureTrailExperience(record.asset);
}
