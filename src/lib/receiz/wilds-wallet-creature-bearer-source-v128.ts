import {
  createReceizClient, readReceizIdentityArtifact, receizBase64UrlDecode, receizBase64UrlEncode, serializeReceizPortableAssetDocument, sha256ReceizBytes,
  transportReceizSealedArtifactV124, type ReceizClient, type ReceizPortableSealedArtifactV124,
} from "@receiz/sdk";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import type { WildsWalletAssetSendAsset } from "../../features/play/wallet/wilds-wallet-asset-send";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { defaultContinuityDatabase } from "./wildz-active-identity";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { WildzPreparedIdentityOwnedCard } from "./wildz-identity-adapter";
import { matchesWildzOwnedCardExport } from "./wildz-owned-card-export";
import { openWildzSealedCard } from "./wildz-sealed-card";
import { unpackWildzCardSealPayload, packWildzCardSealPayload } from "./wildz-card-seal-payload";
import { prepareWildsPortableDocumentV128 } from "./wilds-portable-document-v128";
import { verifyWildsResourceCardOriginProofV128, type createWildsResourcePackageExchangeV128, type WildsResourceSourceProofV128 } from "./wilds-resource-exchange-v128";
import { admitWildsWalletBearerOriginal, openWildsWalletBearerOriginal, readWildsWalletCreatureProjectionV128, type WildsWalletBearerGiftLeg, type WildsWalletBearerSelectionVerifier } from "../../features/play/wallet/wilds-wallet-bearer-gift-proof";
import { isVerifiedWildzCardDescendant } from "./wildz-card-descendant";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { createWildsWalletBearerGiftRecoveryStore, type WildsWalletBearerGiftSource } from "../../features/play/wallet/wilds-wallet-bearer-gift-recovery";
import { createSafeWildsWalletCardExportV128 } from "../../features/play/wallet/wilds-wallet-safe-card-export-v128";

export type WildsWalletCreatureBearerV128 = Readonly<{ schema: "wildz.creature-bearer.v128"; card: PortableCardAsset; sourceOriginal: ReceizPortableSealedArtifactV124 }>;
const same = (a: unknown, b: unknown) => canonicalPortableCardJson(a) === canonicalPortableCardJson(b);
const readOnlySdk = () => createReceizClient({ fetchImpl: async () => { throw Error("Source proof verification cannot invent network authority."); } });
const sourceKey = (owner: string, keyId: string, assetId: string) => JSON.stringify(["wildz.wallet.creature-bearer.current.v128", owner, keyId, assetId]);

type HeldSourcePreparation = Readonly<{
  schema: "wildz.wallet.safe-held-source.v128"; ownerHandle: string; keyId: string;
  assetId: string; fingerprint: string; packedB64u: string;
  original: ReceizPortableSealedArtifactV124 | null;
}>;
type CreatureBirthPreparation = Readonly<{ schema: "wildz.wallet.creature-birth.v128"; card: PortableCardAsset }>;
const heldSourceKey = (owner: string, keyId: string, card: PortableCardAsset) => JSON.stringify([
  "wildz.wallet.safe-held-source.v128", owner, keyId, card.id, cardArtifactFingerprint(card),
]);
const birthKey = (owner: string, keyId: string, assetId: string) => JSON.stringify(["wildz.wallet.creature-birth.v128", owner, keyId, assetId]);

/** Freeze the safe, signed exact payload before its first native write. A cold
 * retry opens that payload instead of re-exporting a creature that has grown. */
export async function prepareSafeWildsWalletHeldCardSourceV128(
  sdk: ReceizClient, card: PortableCardAsset, prepared: WildzPreparedIdentityOwnedCard | undefined,
  expected: Readonly<{ keyId: string; ownerHandle: string; database?: WildzContinuityDatabase; retainBirth?: boolean; assertCurrent?: () => void }>,
) {
  const database = expected.database ?? defaultContinuityDatabase;
  const key = heldSourceKey(expected.ownerHandle, expected.keyId, card), fingerprint = cardArtifactFingerprint(card);
  const assertCurrent = expected.assertCurrent ?? (() => {});
  assertCurrent();
  let retained = await database.read<HeldSourcePreparation>("meta", key);
  if (!retained) {
    if (!prepared || prepared.keyId !== expected.keyId || prepared.assetId !== card.id || prepared.cardFingerprint !== fingerprint) throw Error("The held identity does not bind this exact current creature export.");
    const held = await openWildzSealedCard({ bytes: prepared.bytes, mimeType: prepared.mimeType, name: prepared.filename });
    if (!await matchesWildzOwnedCardExport(held.payloadBytes, { asset: card, keyId: expected.keyId, ownerReceizId: expected.ownerHandle })) throw Error("The SDK-verified creature Original is not signed by this held owner.");
    const identity = await readReceizIdentityArtifact(held.payloadBytes);
    if (card.manifest.ownerReceizId !== identity.owner.uid && !sameWildzPlayerCoordinate(card.manifest.ownerReceizId, expected.ownerHandle)) throw Error("Received creatures must reuse their retained native successor; an owned export cannot create another genesis.");
    const packed = await packWildzCardSealPayload(await createSafeWildsWalletCardExportV128(held.payloadBytes));
    assertCurrent();
    const value: HeldSourcePreparation = { schema: "wildz.wallet.safe-held-source.v128", ownerHandle: expected.ownerHandle, keyId: expected.keyId, assetId: card.id, fingerprint, packedB64u: receizBase64UrlEncode(packed), original: null };
    retained = await database.transaction(["meta"], "readwrite", async tx => {
      const previous = await tx.get<HeldSourcePreparation>("meta", key);
      if (expected.retainBirth) {
        const coordinate = birthKey(expected.ownerHandle, expected.keyId, card.id);
        const birth = await tx.get<CreatureBirthPreparation>("meta", coordinate);
        if (birth && (birth.schema !== "wildz.wallet.creature-birth.v128" || !same(birth.card, card))) throw Error("The frozen creature birth changed. Recover its exact Original.");
        await tx.put("meta", { schema: "wildz.wallet.creature-birth.v128", card } satisfies CreatureBirthPreparation, coordinate);
      }
      if (previous) return previous;
      await tx.put("meta", value, key);
      return value;
    });
  }
  assertCurrent();
  if (!same(retained, await database.read("meta", key)) || retained.schema !== "wildz.wallet.safe-held-source.v128" || retained.ownerHandle !== expected.ownerHandle || retained.keyId !== expected.keyId || retained.assetId !== card.id || retained.fingerprint !== fingerprint) throw Error("The exact safe source preparation could not be saved.");
  const packed = receizBase64UrlDecode(retained.packedB64u), payload = await unpackWildzCardSealPayload(packed), safeIdentity = await readReceizIdentityArtifact(payload);
  if (safeIdentity.crypto.privateKeyPkcs8B64u || safeIdentity.portableState
    || card.manifest.ownerReceizId !== safeIdentity.owner.uid && !sameWildzPlayerCoordinate(card.manifest.ownerReceizId, expected.ownerHandle)
    || !await matchesWildzOwnedCardExport(payload, { asset: card, keyId: expected.keyId, ownerReceizId: expected.ownerHandle })) throw Error("The retained safe source preparation is invalid.");
  if (expected.retainBirth) {
    const coordinate = birthKey(expected.ownerHandle, expected.keyId, card.id);
    const birth: CreatureBirthPreparation = { schema: "wildz.wallet.creature-birth.v128", card };
    await database.transaction(["meta"], "readwrite", async tx => {
      const previous = await tx.get<CreatureBirthPreparation>("meta", coordinate);
      if (previous && !same(previous, birth)) throw Error("The frozen creature birth changed.");
      await tx.put("meta", birth, coordinate);
    });
    if (!same(await database.read("meta", coordinate), birth)) throw Error("The exact creature birth could not be saved.");
  }
  assertCurrent();
  if (retained.original) {
    const restored = await sdk.artifacts.verifyAndOpen(new File([receizBase64UrlDecode(retained.original.exactBytesB64u).slice().buffer], retained.original.filename, { type: retained.original.mimeType }));
    if (restored.legacyCompatibility !== "current-native" || restored.sealedArtifact.continuity.ownerReceizId !== expected.ownerHandle || restored.sealedArtifact.artifactSha256 !== retained.original.artifactSha256 || restored.verifiedPayload.sha256 !== await sha256ReceizBytes(packed)) throw Error("The retained native held source changed.");
    assertCurrent();
    return retained.original;
  }
  const admitted = await sdk.assets.createProofObject({ assetType: "proof_object", payload: { bytes: packed, mimeType: "image/png" } }, { idempotencyKey: `wildz:creature-held:${await sha256ReceizBytes(packed)}`, filename: `wildz-creature-held-${card.id}.receizbundle` });
  assertCurrent();
  const opened = await sdk.artifacts.verifyAndOpen(admitted.artifact);
  if (opened.legacyCompatibility !== "current-native" || opened.sealedArtifact.continuity.ownerReceizId !== expected.ownerHandle
    || !await matchesWildzOwnedCardExport(await unpackWildzCardSealPayload(opened.verifiedPayload.bytes), { asset: card, keyId: expected.keyId, ownerReceizId: expected.ownerHandle })) throw Error("The actual native source did not preserve the held creature Original.");
  assertCurrent();
  const original = await transportReceizSealedArtifactV124(admitted), next = { ...retained, original };
  await database.transaction(["meta"], "readwrite", async tx => {
    const previous = await tx.get<HeldSourcePreparation>("meta", key);
    if (!previous || previous.packedB64u !== retained!.packedB64u || previous.original && !same(previous.original, original)) throw Error("The exact native held source changed.");
    await tx.put("meta", next, key);
  });
  if (!same(next, await database.read("meta", key))) throw Error("The exact native held source could not be saved.");
  return original;
}

export function prepareWildsWalletSafeHeldCardSourceV128(input: Readonly<{sdk:ReceizClient;card:PortableCardAsset;prepared:WildzPreparedIdentityOwnedCard;keyId:string;ownerHandle:string}>) {
  return prepareSafeWildsWalletHeldCardSourceV128(input.sdk,input.card,input.prepared,input);
}

/** Deterministic immutable body. Native artifactId is its SDK payload SHA;
 * semantic card identity remains card.id under the source journal's global CAS. */
export async function buildWildsWalletCreatureBearerPayloadV128(input: Readonly<{ card: PortableCardAsset; sourceOriginal: ReceizPortableSealedArtifactV124 }>) {
  if (!verifyAnyWildsCard(input.card).ok) throw Error("The exact creature card is invalid.");
  const body: WildsWalletCreatureBearerV128 = { schema: "wildz.creature-bearer.v128", card: structuredClone(input.card), sourceOriginal: admitWildsWalletBearerOriginal(input.sourceOriginal) };
  const bytes = new TextEncoder().encode(canonicalPortableCardJson(body));
  return { body, bytes, payloadSha256: await sha256ReceizBytes(bytes), provenanceRoot: `wildz:creature:${input.card.id}` };
}

export async function readWildsWalletCreaturePayloadV128(original: ReceizPortableSealedArtifactV124, sdk: ReceizClient = readOnlySdk()) {
  const opened = await openWildsWalletBearerOriginal(original, sdk.artifacts);
  const bytes = receizBase64UrlDecode(opened.document.payload.bytesBase64Url);
  const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as WildsWalletCreatureBearerV128;
  if (!body || Object.keys(body).sort().join(",") !== "card,schema,sourceOriginal" || body.schema !== "wildz.creature-bearer.v128" || !verifyAnyWildsCard(body.card).ok) throw Error("The native creature bearer payload is invalid.");
  const payload = await buildWildsWalletCreatureBearerPayloadV128(body);
  if (!same(payload.body, body) || payload.payloadSha256 !== opened.document.payload.sha256 || payload.provenanceRoot !== opened.document.provenance.root) throw Error("The exact immutable creature payload changed.");
  return { ...opened, card: body.card, sourceOriginal: body.sourceOriginal, payload };
}

export async function readWildsWalletCreatureBearerV128(original: ReceizPortableSealedArtifactV124, originProof: WildsResourceSourceProofV128, sdk: ReceizClient, applicationId: string) {
  const opened = await readWildsWalletCreaturePayloadV128(original, sdk);
  const { payload, card, sourceOriginal } = opened;
  const origin = await verifyWildsResourceCardOriginProofV128(sdk, originProof, { applicationId, assetId: card.id, payloadSha256: payload.payloadSha256, provenanceRoot: payload.provenanceRoot });
  if (!same(origin.card, card) || !same(origin.sourceOriginal, sourceOriginal) || origin.ownerReceizId !== opened.derived.genesisOwnerReceizId) throw Error("The native creature genesis reservation does not bind this exact Original.");
  return { ...opened, origin };
}

export const assertWildsWalletCreatureGiftSelectionV128: WildsWalletBearerSelectionVerifier = async (leg, document) => {
  const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(receizBase64UrlDecode(document.payload.bytesBase64Url))) as WildsWalletCreatureBearerV128;
  if (leg.request.asset.kind !== "creature" || body.schema !== "wildz.creature-bearer.v128" || !verifyAnyWildsCard(body.card).ok || body.card.id !== leg.request.asset.assetId) throw Error("The exact approved creature selection changed.");
};

/** Source projection/card JSON is only selection. The enclosing SDK Original
 * plus complete source-journal custody/replay establish lawful finite birth. */
export async function verifyWildsWalletBearerGiftOriginV128(leg: WildsWalletBearerGiftLeg, source: WildsWalletBearerGiftSource, sdk: ReceizClient, applicationId: string) {
  if (leg.request.asset.kind !== "creature") throw Error("Resource packages require their signed source-custody acceptance path.");
  const opened = await readWildsWalletCreatureBearerV128(source.original, source.originProof as WildsResourceSourceProofV128, sdk, applicationId);
  await readWildsWalletCreatureProjectionV128({ source: opened, projectionOriginal: source.projectionOriginal, artifacts: sdk.artifacts });
  if (opened.card.id !== leg.request.asset.assetId || opened.derived.ownerReceizId !== leg.senderHandle) throw Error("The native creature belongs to another selection or keeper.");
}

/** The journal is the one semantic-birth CAS. Sealing alone never admits a
 * creature, and a later keeper may only reuse the retained native successor. */
export function createWildsWalletCreatureBearerProducerV128(input: Readonly<{
  sdk: ReceizClient; applicationId: string; keyId: string; ownerHandle: string;
  currentIdentity(): Readonly<{ keyId: string; ownerHandle: string }>;
  card(assetId: string): PortableCardAsset;
  prepareCard(card: PortableCardAsset): Promise<WildzPreparedIdentityOwnedCard>;
  exchange: Pick<ReturnType<typeof createWildsResourcePackageExchangeV128>, "reserveCardOrigin">;
  database?: WildzContinuityDatabase;
}>) {
  const database = input.database ?? defaultContinuityDatabase, store = createWildsWalletBearerGiftRecoveryStore(database);
  const assertCurrent = () => { const active = input.currentIdentity(); if (active.keyId !== input.keyId || active.ownerHandle !== input.ownerHandle) throw Error("The Explorer changed during native source preparation."); };
  async function retainSuccessor(source: WildsWalletBearerGiftSource) {
    assertCurrent(); const opened = await readWildsWalletCreatureBearerV128(source.original, source.originProof as WildsResourceSourceProofV128, input.sdk, input.applicationId); assertCurrent();
    await readWildsWalletCreatureProjectionV128({ source: opened, projectionOriginal: source.projectionOriginal, accepted: true, artifacts: input.sdk.artifacts }); assertCurrent();
    return retainIndex(source, opened.card.id);
  }
  async function retainIndex(source: WildsWalletBearerGiftSource, assetId: string) {
    await store.retainSource(input.ownerHandle, input.keyId, source);
    const key = sourceKey(input.ownerHandle, input.keyId, assetId), index = { artifactSha256: source.original.artifactSha256, projectionArtifactSha256: source.projectionOriginal.artifactSha256 };
    await database.transaction(["meta"], "readwrite", tx => tx.put("meta", index, key));
    if (!same(await database.read("meta", key), index)) throw Error("The exact current native creature source could not be saved.");
    return source;
  }
  async function retainCurrent(source: WildsWalletBearerGiftSource) {
    const opened = await readWildsWalletCreatureBearerV128(source.original, source.originProof as WildsResourceSourceProofV128, input.sdk, input.applicationId); assertCurrent();
    if (opened.derived.ownerReceizId !== input.ownerHandle) throw Error("Only this native keeper can retain this creature source.");
    return retainSuccessor(source);
  }
  async function projectCurrent(original: ReceizPortableSealedArtifactV124, originProof: unknown, card: PortableCardAsset): Promise<WildsWalletBearerGiftSource> {
    const opened = await readWildsWalletCreatureBearerV128(original, originProof as WildsResourceSourceProofV128, input.sdk, input.applicationId); assertCurrent();
    if (opened.derived.ownerReceizId !== input.ownerHandle || !(same(opened.card, card) || isVerifiedWildzCardDescendant(opened.card, card))) throw Error("The exact creature history is not a descendant of this owned native source.");
    const bytes = new TextEncoder().encode(canonicalPortableCardJson({ schema: "wildz.creature-projection.v128", sourceArtifactSha256: original.artifactSha256, sourceHeadReference: opened.headReference, card }));
    const sealed = await input.sdk.assets.createProofObject({ assetType: "proof_object", payload: { bytes, mimeType: "application/vnd.wildz.creature-projection.v128+json" } }, { idempotencyKey: `wildz:creature-projection:${await sha256ReceizBytes(bytes)}`, filename: `wildz-creature-projection-${card.id}.receizbundle` }); assertCurrent();
    const source = { original, originProof, projectionOriginal: await transportReceizSealedArtifactV124(sealed) };
    await readWildsWalletCreatureProjectionV128({ source: opened, projectionOriginal: source.projectionOriginal, artifacts: input.sdk.artifacts }); assertCurrent();
    return retainIndex(source, card.id);
  }
  async function prepareAsset(asset: WildsWalletAssetSendAsset): Promise<WildsWalletBearerGiftSource> {
      assertCurrent(); if (asset.kind !== "creature") throw Error("Choose an owned creature for this native source.");
      const assetId = asset.assetId, key = sourceKey(input.ownerHandle, input.keyId, assetId);
      const retained = await database.read<{artifactSha256:string;projectionArtifactSha256:string}>("meta", key); assertCurrent();
      if (retained) {
        const source = await store.readSource(input.ownerHandle, input.keyId, retained.artifactSha256, retained.projectionArtifactSha256);
        if (!source) throw Error("The exact native successor is missing. Restore it before sending again.");
        const opened = await readWildsWalletCreatureBearerV128(source.original, source.originProof as WildsResourceSourceProofV128, input.sdk, input.applicationId); assertCurrent();
        if (opened.card.id !== assetId || opened.derived.ownerReceizId !== input.ownerHandle) throw Error("This retained creature has already moved to another keeper.");
        const current = structuredClone(input.card(assetId));
        const previous = await readWildsWalletCreatureProjectionV128({ source: opened, projectionOriginal: source.projectionOriginal, accepted: opened.derived.appendCount > 0, artifacts: input.sdk.artifacts });
        if (!(same(previous.card, current) || isVerifiedWildzCardDescendant(previous.card, current))) throw Error("The latest approved creature history cannot be replaced by an earlier card.");
        return projectCurrent(source.original, source.originProof, current);
      }
      const current = structuredClone(input.card(assetId));
      if (current.id !== assetId || !verifyAnyWildsCard(current).ok) throw Error("The exact creature collection selection is invalid.");
      const frozen = await database.read<CreatureBirthPreparation>("meta", birthKey(input.ownerHandle, input.keyId, assetId)); assertCurrent();
      const card = frozen?.card ?? current;
      if (frozen && (frozen.schema !== "wildz.wallet.creature-birth.v128" || card.id !== assetId || !verifyAnyWildsCard(card).ok
        || !(same(card, current) || isVerifiedWildzCardDescendant(card, current)))) throw Error("The current creature is not a descendant of its frozen native birth.");
      // Birth and safe payload are saved in one transaction before any native
      // seal. An existing birth therefore resumes without re-signing an ancestor.
      const prepared = frozen ? undefined : await input.prepareCard(card); assertCurrent();
      const sourceOriginal = await prepareSafeWildsWalletHeldCardSourceV128(input.sdk, card, prepared, { ...input, database, retainBirth: true, assertCurrent }); assertCurrent();
      const payload = await buildWildsWalletCreatureBearerPayloadV128({ card, sourceOriginal });
      const reservation = await input.exchange.reserveCardOrigin({ attemptId: `card-origin:${assetId}`, assetId, card, sourceOriginal, payloadSha256: payload.payloadSha256, provenanceRoot: payload.provenanceRoot }); assertCurrent();
      await verifyWildsResourceCardOriginProofV128(input.sdk, reservation.originProof, { applicationId: input.applicationId, assetId, payloadSha256: payload.payloadSha256, provenanceRoot: payload.provenanceRoot }); assertCurrent();
      const portable = await prepareWildsPortableDocumentV128({ assetType: "proof_object", payload: { bytes: payload.bytes, mimeType: "application/vnd.wildz.creature-bearer.v128+json" }, ownership: { ownerReceizId: input.ownerHandle, custody: "bearer", proofRef: "genesis" }, provenance: { root: payload.provenanceRoot, appends: [] }, settlement: { state: "none" } });
      const sealed = await input.sdk.assets.createProofObject({ assetType: "proof_object", payload: { bytes: serializeReceizPortableAssetDocument(portable), mimeType: "application/vnd.receiz.portable-asset.v1+json" } }, { idempotencyKey: `wildz:creature-bearer:${payload.payloadSha256}`, filename: `wildz-creature-${payload.payloadSha256}.receizbundle` }); assertCurrent();
      return projectCurrent(await transportReceizSealedArtifactV124(sealed), reservation.originProof, current);
  }
  return {
    retainCurrent, retainSuccessor, prepareAsset,
    async prepare(leg: WildsWalletBearerGiftLeg): Promise<WildsWalletBearerGiftSource> {
      assertCurrent(); if (leg.senderHandle !== input.ownerHandle) throw Error("Choose an owned creature for this native source.");
      return prepareAsset(leg.request.asset);
    },
  };
}
