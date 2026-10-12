import {
  canonicalizeReceizV122, receizBase64UrlDecode, receizBase64UrlEncode,
  sha256ReceizBytes, transportReceizSealedArtifactV124,
  type JsonObject, type ReceizClient, type ReceizPortableSealedArtifactV124, type ReceizPublicStoreSignedPublish
} from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { WildsResourceSourceAuthorV128 } from "./wilds-resource-source-v128";
import {
  assertWildzMarketPublicValueCardV129, assertWildzMarketPublicValuePrivacyV129,
  assertWildzMarketPublicValueTransportV129, assertWildzMarketValueDescendantV129,
  parseSignedWildzMarketValuePublicationV129, verifyWildzMarketPublicValueRootV129,
  verifyWildzMarketPublicValueProjectionV129, wildzMarketValueSameProofCardV129,
  wildzMarketValuePublicationInputV129, WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129, type WildzMarketPublicValueRecordV129
} from "./wildz-market-public-value-source-v129";

export type WildzMarketPublicValuePreparationV129 = Readonly<{
  schema: "wildz.market-value-root-preparation.v129";
  assetId: string; applicationId: string; publisherHandle: string;
  payloadB64u: string; payloadSha256: string;
  projectionOriginal: ReceizPortableSealedArtifactV124;
  root: ReceizPortableSealedArtifactV124 | null;
  signed: ReceizPublicStoreSignedPublish<JsonObject> | null;
}>;
type Frozen = WildzMarketPublicValuePreparationV129;
const same = (a: unknown, b: unknown) => canonicalizeReceizV122(a) === canonicalizeReceizV122(b);
const preparationKey = (assetId: string) => JSON.stringify(["wildz.market-value-root.v129", assetId]);
function fail(reason: string): never { throw Error(`wildz_market_value_${reason}`); }

async function openPreparation(input: Readonly<{
  card: PortableCardAsset; applicationId: string; publisherHandle: string; assertCurrent(): void;
}>, value: unknown) {
  assertWildzMarketPublicValuePrivacyV129(value);
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).sort().join() !== "applicationId,assetId,payloadB64u,payloadSha256,projectionOriginal,publisherHandle,root,schema,signed")
    fail("preparation_binding_invalid");
  const frozen = value as Frozen;
  if (frozen.schema !== "wildz.market-value-root-preparation.v129" || frozen.assetId !== input.card.id
    || frozen.applicationId !== input.applicationId || frozen.publisherHandle !== input.publisherHandle
    || typeof frozen.payloadB64u !== "string" || !/^[A-Za-z0-9_-]+$/.test(frozen.payloadB64u)
    || frozen.payloadB64u.length > Math.ceil(WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129 / 3)
    || typeof frozen.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(frozen.payloadSha256))
    fail("preparation_binding_invalid");
  assertWildzMarketPublicValueTransportV129(frozen.projectionOriginal);
  if (frozen.root !== null) assertWildzMarketPublicValueTransportV129(frozen.root);
  const payload = receizBase64UrlDecode(frozen.payloadB64u);
  if (receizBase64UrlEncode(payload) !== frozen.payloadB64u || await sha256ReceizBytes(payload) !== frozen.payloadSha256)
    fail("preparation_binding_invalid");
  input.assertCurrent();
  let first: unknown;
  try { first = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)); }
  catch { fail("preparation_binding_invalid"); }
  assertWildzMarketPublicValueCardV129(first);
  assertWildzMarketValueDescendantV129(first, input.card);
  if (frozen.signed !== null) {
    if (!frozen.root || !same(parseSignedWildzMarketValuePublicationV129(frozen.signed).record, {
      schema: "wildz.market-public-value-source.v129", assetId: frozen.assetId,
      applicationId: frozen.applicationId, publisherHandle: frozen.publisherHandle,
      root: frozen.root, projectionOriginal: frozen.projectionOriginal
    })) fail("preparation_binding_invalid");
  }
  return { frozen, first, payload };
}

/** Domain binding only. A caller must independently SDK-admit the complete
 * certificate before this guard can authorize resuming a held preparation. */
export function assertWildzMarketValuePreparationResumeBindingV129(
  first: PortableCardAsset, selected: PortableCardAsset,
  certificate: Readonly<{ card: PortableCardAsset; sourceDigest: string }>, expectedNativeSourceDigest: string
) {
  assertWildzMarketPublicValueCardV129(first);
  assertWildzMarketPublicValueCardV129(certificate.card);
  if (!wildzMarketValueSameProofCardV129(first, certificate.card)) fail("projection_card_binding_invalid");
  assertWildzMarketValueDescendantV129(first, selected);
  if (!/^[a-f0-9]{64}$/.test(expectedNativeSourceDigest) || certificate.sourceDigest !== expectedNativeSourceDigest)
    fail("preparation_source_changed");
}

/** Durable public transport preparation only. This issues no verification,
 * proof, seal or publication authority. The publisher must independently admit
 * the complete projection certificate before this preparation can be sealed. */
export async function freezeWildzMarketPublicValuePreparationV129(input: Readonly<{
  database: WildzContinuityDatabase; card: PortableCardAsset;
  applicationId: string; publisherHandle: string;
  projectionOriginal: ReceizPortableSealedArtifactV124; assertCurrent(): void;
}>): Promise<Frozen> {
  input.assertCurrent();
  assertWildzMarketPublicValueCardV129(input.card);
  assertWildzMarketPublicValueTransportV129(input.projectionOriginal);
  const key = preparationKey(input.card.id);
  let frozen = await input.database.read<Frozen>("meta", key); input.assertCurrent();
  if (!frozen) {
    const payload = new TextEncoder().encode(canonicalizeReceizV122(input.card));
    if (payload.length > WILDZ_MARKET_VALUE_RECORD_MAX_BYTES_V129 / 4) fail("card_too_large");
    const preparation: Frozen = { schema: "wildz.market-value-root-preparation.v129", assetId: input.card.id,
      applicationId: input.applicationId, publisherHandle: input.publisherHandle,
      payloadB64u: receizBase64UrlEncode(payload), payloadSha256: await sha256ReceizBytes(payload),
      projectionOriginal: JSON.parse(canonicalizeReceizV122(input.projectionOriginal)), root: null, signed: null };
    frozen = await input.database.transaction(["meta"], "readwrite", async tx => {
      input.assertCurrent(); const retained = await tx.get<Frozen>("meta", key);
      if (retained) return retained;
      await tx.put("meta", preparation, key); return preparation;
    });
  }
  await openPreparation(input, frozen);
  if (!same(frozen, await input.database.read("meta", key))) fail("preparation_storage_failed");
  return frozen;
}

/** Only invoke after an explicitly requested native seller listing activates.
 * Creates one public display proof; it never creates playable bearer custody,
 * changes the creature, funds a wallet, pays a seller or approves a purchase. */
export function createWildzMarketPublicValuePublisherV129(input: Readonly<{
  sdk: ReceizClient;
  database: WildzContinuityDatabase;
  sourceAuthor: Pick<WildsResourceSourceAuthorV128, "keyFile" | "grant" | "ownerReceizId" | "passphrase">;
  assertCurrent(): void;
  fetcher?: typeof fetch;
}>) {
  const fetcher = input.fetcher ?? fetch;
  const running = new Map<string, { basis: string; operation: Promise<WildzMarketPublicValueRecordV129> }>();
  function assertPublisher() {
    input.assertCurrent();
    const author = input.sourceAuthor;
    if (!author.grant.applicationId || author.grant.keyId !== author.keyFile.keyId
      || author.ownerReceizId !== `${author.keyFile.owner.username?.toLowerCase()}.receiz.id`)
      fail("publisher_binding_invalid");
    return author;
  }
  async function publicRecord(assetId: string) {
    const response = await fetcher(`/api/wilds/market/value/${encodeURIComponent(assetId)}`, { method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
    if (response.status === 404) return null;
    if (!response.ok) fail("public_read_unavailable");
    const value = await response.json() as { ok?: boolean; record?: unknown };
    if (value.ok !== true) fail("public_read_unavailable");
    return verifyWildzMarketPublicValueRootV129(value.record);
  }
  async function publish(selected: PortableCardAsset, projectionOriginal: ReceizPortableSealedArtifactV124) {
    input.assertCurrent();
    assertWildzMarketPublicValueCardV129(selected);
    const author = assertPublisher();
    // An outage cannot masquerade as absence and create a replacement origin.
    const prior = await publicRecord(selected.id); input.assertCurrent();
    if (prior) {
      if (prior.record.assetId !== selected.id) fail("card_binding_invalid");
      assertWildzMarketValueDescendantV129(prior.card, selected);
      return prior.record;
    }
    const certificate = await verifyWildzMarketPublicValueProjectionV129(projectionOriginal, author.ownerReceizId, selected.id); input.assertCurrent();
    const storageKey = preparationKey(selected.id);
    // A fresh issuance freezes the exact admitted selection. A retry may use a
    // descendant, but only the already-held first card and certificate seal.
    const held = await input.database.read<Frozen>("meta", storageKey); input.assertCurrent();
    if (!held && !wildzMarketValueSameProofCardV129(certificate.card, selected)) fail("projection_card_binding_invalid");
    let frozen = await freezeWildzMarketPublicValuePreparationV129({ database: input.database, card: selected,
      applicationId: author.grant.applicationId, publisherHandle: author.ownerReceizId, projectionOriginal, assertCurrent: input.assertCurrent });
    // Never replace a pending first origin when another listing/projection has
    // overtaken its exact native snapshot. Reuse only this same certificate.
    if (!same(frozen.projectionOriginal, projectionOriginal)) fail("preparation_source_changed");
    const { payload, first } = await openPreparation({ card: selected, applicationId: author.grant.applicationId,
      publisherHandle: author.ownerReceizId, assertCurrent: input.assertCurrent }, frozen);
    if (!wildzMarketValueSameProofCardV129(first, certificate.card)) fail("projection_card_binding_invalid");
    async function retain(next: Frozen) {
      await input.database.transaction(["meta"], "readwrite", async tx => {
        input.assertCurrent();
        if (!same(await tx.get("meta", storageKey), frozen)) fail("preparation_conflict");
        await tx.put("meta", next, storageKey);
      });
      if (!same(next, await input.database.read("meta", storageKey))) fail("preparation_storage_failed");
      frozen = next;
    }
    if (!frozen.root) {
      input.assertCurrent();
      const sealed = await input.sdk.assets.createProofObject({ assetType: "proof_object", payload: { bytes: payload, mimeType: "application/json" } }, {
        filename: `wildz-public-value-${selected.id.slice(6)}.receizbundle`,
        idempotencyKey: `wildz:public-value-root:${selected.id}:${frozen.payloadSha256}`
      }); input.assertCurrent();
      const root = await transportReceizSealedArtifactV124(sealed);
      await retain({ ...frozen, root });
    }
    const record: WildzMarketPublicValueRecordV129 = { schema: "wildz.market-public-value-source.v129", assetId: selected.id,
      applicationId: frozen.applicationId, publisherHandle: frozen.publisherHandle, root: frozen.root!, projectionOriginal: frozen.projectionOriginal };
    const opened = await verifyWildzMarketPublicValueRootV129(record); input.assertCurrent();
    if (!same(opened.card, first)) fail("card_binding_invalid");
    if (!frozen.signed) {
      const signed = await input.sdk.publicStore.signPublish({ ...wildzMarketValuePublicationInputV129(record), keyFile: author.keyFile,
        ...(author.passphrase === undefined ? {} : { passphrase: author.passphrase }) });
      input.assertCurrent();
      if (!same(parseSignedWildzMarketValuePublicationV129(signed).record, record)) fail("signed_publication_invalid");
      await retain({ ...frozen, signed });
    }
    if (!same(parseSignedWildzMarketValuePublicationV129(frozen.signed).record, record)) fail("preparation_binding_invalid");
    input.assertCurrent();
    const response = await fetcher(`/api/wilds/market/value/${encodeURIComponent(selected.id)}`, { method: "POST", credentials: "omit",
      cache: "no-store", redirect: "error", headers: { "content-type": "application/json" }, body: canonicalizeReceizV122(frozen.signed) });
    if (!response.ok) fail("publication_unconfirmed");
    const confirmed = await publicRecord(selected.id); input.assertCurrent();
    if (!confirmed || !same(confirmed.record.root, record.root)) fail("publication_unconfirmed");
    return confirmed.record;
  }
  function enqueuePublish(card: PortableCardAsset, projectionOriginal: ReceizPortableSealedArtifactV124): Promise<WildzMarketPublicValueRecordV129> {
    // Snapshot the admitted current card before asynchronous preparation.
    const held = JSON.parse(canonicalizeReceizV122(card)) as PortableCardAsset;
    const projection = JSON.parse(canonicalizeReceizV122(projectionOriginal)) as ReceizPortableSealedArtifactV124;
    const basis = canonicalizeReceizV122({ card: held, projection });
    const pending = running.get(card.id);
    if (pending) return pending.basis === basis ? pending.operation : Promise.reject(Error("wildz_market_value_preparation_source_changed"));
    const operation = publish(held, projection).finally(() => running.delete(card.id));
    running.set(card.id, { basis, operation }); return operation;
  }
  return {
    publish: enqueuePublish,
    async resume(card: PortableCardAsset, expectedNativeSourceDigest: string): Promise<WildzMarketPublicValueRecordV129 | null> {
      const selected = JSON.parse(canonicalizeReceizV122(card)) as PortableCardAsset;
      assertWildzMarketPublicValueCardV129(selected);
      const author = assertPublisher();
      // This lookup and held-preparation qualification are read-only. Missing
      // preparation asks the caller to qualify a fresh native projection.
      const prior = await publicRecord(selected.id); input.assertCurrent();
      if (prior) {
        if (prior.record.assetId !== selected.id) fail("card_binding_invalid");
        assertWildzMarketValueDescendantV129(prior.card, selected);
        return prior.record;
      }
      const retained = await input.database.read<Frozen>("meta", preparationKey(selected.id)); input.assertCurrent();
      if (!retained) return null;
      const { frozen, first } = await openPreparation({ card: selected, applicationId: author.grant.applicationId,
        publisherHandle: author.ownerReceizId, assertCurrent: input.assertCurrent }, retained);
      const certificate = await verifyWildzMarketPublicValueProjectionV129(frozen.projectionOriginal, author.ownerReceizId, selected.id);
      input.assertCurrent();
      assertWildzMarketValuePreparationResumeBindingV129(first, selected, certificate, expectedNativeSourceDigest);
      return enqueuePublish(selected, frozen.projectionOriginal);
    }
  };
}
