import { digestReceizCanonicalV122, receizBase64UrlDecode, receizBase64UrlEncode, sha256ReceizBytes,
  type ReceizClient, type ReceizPortableSealedArtifactV124 } from "@receiz/sdk";
import type { WildsResourceJournalEventV128 } from "./wilds-resource-journal-v128";
import { decodeWildsResourceEventV128 } from "./wilds-resource-event-codec-v128";
import { readWildsResourceSourceArchivePageV128 } from "./wilds-resource-source-archive-v128";
import { assertWildzMarketSourceOriginalReferenceV128, restoreWildzMarketSourceOriginalV128,
  type WildzMarketSourceOriginalReferenceV128 } from "./wildz-market-source-original-locator-v128";
import { createWildzProofSourceRepository } from "./wildz-proof-source-repository";
import { defaultContinuityDatabase } from "./wildz-active-identity";

type CardOrigin = Extract<WildsResourceJournalEventV128, {kind:"card-origin"}>;
type ReferencedOrigin = Readonly<{
  schema: "wildz.resource-card-origin-reference.v128";
  exactEventDigest: string;
  event: Omit<CardOrigin,"sourceOriginal"> & { sourceOriginal: WildzMarketSourceOriginalReferenceV128 };
}>;
type Custody = Pick<ReturnType<typeof createWildzProofSourceRepository>,"read"|"retain">;
const schema = "wildz.resource-card-origin-reference.v128";
const exactSources = createWildzProofSourceRepository(defaultContinuityDatabase);
const fail = (why:string):never => { throw Error(`wilds_resource_origin_${why}`); };

function assertCoordinate(source:ReceizPortableSealedArtifactV124, reference:WildzMarketSourceOriginalReferenceV128) {
  if (source.schema !== "receiz.sealed-artifact-bytes.v124" || source.artifactSha256 !== reference.artifactSha256
    || source.payloadSha256 !== reference.payloadSha256 || source.filename !== reference.filename
    || source.mimeType !== reference.mimeType || source.exactBytesB64u.length !== reference.exactBytesB64uLength) fail("original_coordinate");
}

/** Bind one existing sealed child Original to the complete logical event. The
 * archive stores and moves its exact bytes and cannot issue its ownership. */
export async function prepareWildsCardOriginReference(event:CardOrigin, reference:WildzMarketSourceOriginalReferenceV128):Promise<ReferencedOrigin> {
  assertWildzMarketSourceOriginalReferenceV128(reference);
  assertCoordinate(event.sourceOriginal,reference);
  return {schema,exactEventDigest:await digestReceizCanonicalV122(event),event:{...event,sourceOriginal:reference}};
}

/** Admit the enclosing replay Source before calling this reader. It restores
 * bytes for the existing card-origin verifier, including pre-reference events. */
export async function readWildsResourceReplayEvent(sdk:ReceizClient,wire:unknown,
 options:Readonly<{original?:ReceizPortableSealedArtifactV124;custody?:Custody|null}> = {}):Promise<WildsResourceJournalEventV128>{
  if (!wire || typeof wire !== "object" || !("schema" in wire) || wire.schema !== schema)
    return await decodeWildsResourceEventV128(wire) as WildsResourceJournalEventV128;
  const value=wire as ReferencedOrigin;
  if(Object.keys(value).sort().join()!=="event,exactEventDigest,schema" || !/^[a-f0-9]{64}$/.test(value.exactEventDigest)
    || value.event?.schema!=="wildz.resource-command.v128" || value.event.kind!=="card-origin")fail("reference_invalid");
  const reference=value.event.sourceOriginal;
  assertWildzMarketSourceOriginalReferenceV128(reference);
  const custody=options.custody===undefined?(typeof indexedDB==="undefined"?null:exactSources):options.custody;
  const carried=options.original?.artifactSha256===reference.artifactSha256?options.original:undefined;
  if(carried){
    const bytes=receizBase64UrlDecode(carried.exactBytesB64u);
    if(receizBase64UrlEncode(bytes)!==carried.exactBytesB64u||await sha256ReceizBytes(bytes)!==reference.artifactSha256)fail("original_digest");
  }
  const held=carried??(await custody?.read(reference.artifactSha256))?.artifact;
  const original=held??await restoreWildzMarketSourceOriginalV128(reference,part=>readWildsResourceSourceArchivePageV128(sdk,part));
  assertCoordinate(original,reference);
  const event:CardOrigin={...value.event,sourceOriginal:original};
  if(await digestReceizCanonicalV122(event)!==value.exactEventDigest)fail("event_digest");
  if(!held)await custody?.retain({bytes:receizBase64UrlDecode(original.exactBytesB64u),filename:original.filename,mimeType:original.mimeType});
  return event;
}

export async function retainWildsCardOriginOriginal(original:ReceizPortableSealedArtifactV124,database:typeof defaultContinuityDatabase) {
  await createWildzProofSourceRepository(database).retain({bytes:receizBase64UrlDecode(original.exactBytesB64u),filename:original.filename,mimeType:original.mimeType});
}
