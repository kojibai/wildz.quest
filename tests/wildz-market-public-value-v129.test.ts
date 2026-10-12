import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { GET, POST } from "../app/api/wilds/market/value/[assetId]/route";
import {
  createReceizClient, createReceizIdentityKeyFile, receizBase64UrlDecode, receizBase64UrlEncode, sha256ReceizBytes,
  type ReceizClient, type ReceizPortableSealedArtifactV124, type ReceizProofAuthorityV123
} from "@receiz/sdk";
import { canonicalPortableCardJson, sealCollectedCard } from "../src/features/play/portable-card";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import {
  assertWildzMarketValuePreparationResumeBindingV129, createWildzMarketPublicValuePublisherV129,
  freezeWildzMarketPublicValuePreparationV129
} from "../src/lib/receiz/wildz-market-public-value-publisher-v129";
import {
  assertWildzMarketPublicValueCardV129, assertWildzMarketPublicValuePrivacyV129, assertWildzMarketValueDescendantV129,
  parseSignedWildzMarketValuePublicationV129, readWildzMarketPublicValueSourceV129,
  verifyWildzMarketPublicValueRootV129, verifyWildzMarketPublicValueProjectionV129,
  parseWildzMarketPublicValueProjectionPayloadV129, wildzMarketValuePublicationInputV129,
  type WildzMarketPublicValueRecordV129
} from "../src/lib/receiz/wildz-market-public-value-source-v129";

const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "value.seller", encounterId: "value-publication", capturedAt: "2026-07-15T12:00:00.000Z" });
async function invalidProjectionTransport(): Promise<ReceizPortableSealedArtifactV124> {
  // Payload-only public transport, never a positive proof fixture.
  const bytes = new TextEncoder().encode(canonicalPortableCardJson({ schema: "wildz.creature-projection.v128",
    sourceArtifactSha256: "a".repeat(64), sourceHeadReference: "native:head", card }));
  return { schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: receizBase64UrlEncode(bytes),
    artifactSha256: await sha256ReceizBytes(bytes), payloadSha256: await sha256ReceizBytes(bytes), filename: "projection.json", mimeType: "application/json" };
}
async function invalidPublicRecord(): Promise<WildzMarketPublicValueRecordV129> {
  // An intentionally invalid payload-only transport fixture. No test accepts it
  // as a proof, and it is never used as a public signed-source success fixture.
  const bytes = new TextEncoder().encode(canonicalPortableCardJson(card));
  return { schema: "wildz.market-public-value-source.v129", assetId: card.id, applicationId: "rc_abcdefghijklmnopqrstuvwx",
    publisherHandle: "value.seller.receiz.id", root: { schema: "receiz.sealed-artifact-bytes.v124", exactBytesB64u: receizBase64UrlEncode(bytes),
      artifactSha256: await sha256ReceizBytes(bytes), payloadSha256: await sha256ReceizBytes(bytes), filename: "card.json", mimeType: "application/json" }, projectionOriginal: await invalidProjectionTransport() };
}

test("public value issuance forbids plaintext, encrypted key custody and private player state", () => {
  assert.doesNotThrow(() => assertWildzMarketPublicValueCardV129(card));
  for (const privateField of ["privateKeyPkcs8B64u", "privateKeyPkcs8CiphertextB64u", "playState", "accessToken", "sourceOriginal"]) {
    assert.throws(() => assertWildzMarketPublicValueCardV129({ ...card, privateNamespace: { [privateField]: "private fixture" } }), /private_source_forbidden/);
  }
});

test("complete public artifact envelope forbids private metadata and unknown namespace data", async () => {
  const publicPayload = receizBase64UrlEncode(new TextEncoder().encode(canonicalPortableCardJson(card)));
  for (const metadata of [
    { privateKeyPkcs8CiphertextB64u: "private encrypted fixture" },
    { player: { playState: { privateVault: true } } },
    JSON.stringify({ schema: "receiz.identity-key-state.v113", privateKeyPkcs8B64u: "private fixture" })
  ]) {
    const envelope = { kind: "receiz.bundle.v1", originalBase64: publicPayload,
      proofbundle: { namespaceData: { "unknown.vendor.v1": metadata } } };
    assert.throws(() => assertWildzMarketPublicValuePrivacyV129(envelope), /private_source_forbidden/);
    const bytes = new TextEncoder().encode(JSON.stringify(envelope));
    const record = await invalidPublicRecord();
    const root = { ...record.root, exactBytesB64u: receizBase64UrlEncode(bytes), artifactSha256: await sha256ReceizBytes(bytes) };
    await assert.rejects(verifyWildzMarketPublicValueRootV129({ ...record, root }), /private_source_forbidden/);
  }
});

test("public value root admits exact current card and real verified descendants without replacing issuance", () => {
  const living = admitLegacyCard(card, "2026-07-15T13:00:00.000Z");
  assert.doesNotThrow(() => assertWildzMarketValueDescendantV129(card, card));
  assert.doesNotThrow(() => assertWildzMarketValueDescendantV129(card, { ...card, status: "listed" }));
  assert.doesNotThrow(() => assertWildzMarketValueDescendantV129(card, living));
  const foreign = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "value.seller", encounterId: "another-card", capturedAt: "2026-07-15T12:00:00.000Z" });
  assert.throws(() => assertWildzMarketValueDescendantV129(card, foreign), /card_binding_invalid/);
});

test("real SDK signed public-store transport binds exact root without publishing identity custody", async () => {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "public-value-test", username: "value.seller" } });
  const record = await invalidPublicRecord();
  const signed = await createReceizClient().publicStore.signPublish({ ...wildzMarketValuePublicationInputV129(record), keyFile });
  assert.deepEqual(parseSignedWildzMarketValuePublicationV129(signed).record, record);
  assert.doesNotMatch(JSON.stringify(signed), /privateKeyPkcs8|accessToken|playState/);
  assert.throws(() => parseSignedWildzMarketValuePublicationV129({ ...signed, merchantReceizId: "stranger.receiz.id" }), /signed_publication_invalid/);
  await assert.rejects(verifyWildzMarketPublicValueRootV129(record), /artifact_not_verified/);
});

test("projection certificate requires enclosing SDK verification and forbids private Original payloads", async () => {
  const projection = { schema: "wildz.creature-projection.v128", sourceArtifactSha256: "a".repeat(64), sourceHeadReference: "native:head", card };
  assert.deepEqual(parseWildzMarketPublicValueProjectionPayloadV129(projection), projection);
  assert.throws(() => parseWildzMarketPublicValueProjectionPayloadV129({ ...projection, sourceOriginal: { privateKeyPkcs8B64u: "private" } }), /projection_invalid/);
  assert.throws(() => parseWildzMarketPublicValueProjectionPayloadV129({ ...projection, card: { ...card, privateKeyPkcs8CiphertextB64u: "private" } }), /private_source_forbidden/);
  await assert.rejects(verifyWildzMarketPublicValueProjectionV129(await invalidProjectionTransport(), "value.seller.receiz.id", card.id), /artifact_not_verified/);
});

async function publisherFixture(options: { storageFailure?: boolean; publicFailure?: boolean } = {}) {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "public-value-test", username: "value.seller" } });
  const sourceAuthor = { keyFile, ownerReceizId: "value.seller.receiz.id", grant: {
    applicationId: "rc_abcdefghijklmnopqrstuvwx", keyId: keyFile.keyId
  } as ReceizProofAuthorityV123 };
  const database = createMemoryWildzContinuityDatabase();
  const sealed: Array<{ bytes: Uint8Array; key: string }> = [];
  const sdk = { assets: { async createProofObject(value: { payload: { bytes: Uint8Array } }, args: { idempotencyKey: string }) {
    sealed.push({ bytes: value.payload.bytes.slice(), key: args.idempotencyKey });
    throw Error("lost_public_seal_response");
  } } } as unknown as ReceizClient;
  const fetcher: typeof fetch = async (_url, init) => {
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "omit");
    return new Response(JSON.stringify({ ok: false }), { status: options.publicFailure ? 503 : 404 });
  };
  const storage = options.storageFailure ? { ...database, transaction: async () => { throw Error("storage unavailable"); } } : database;
  const create = () => createWildzMarketPublicValuePublisherV129({ sdk, database: storage, sourceAuthor, assertCurrent() {}, fetcher });
  return { create, sealed, database, storage, sourceAuthor };
}

test("public preparation retains the exact first card and separate certificate across restart and later growth", async () => {
  const f = await publisherFixture();
  const projectionOriginal = await invalidProjectionTransport();
  const input = { database: f.database, card, projectionOriginal, applicationId: f.sourceAuthor.grant.applicationId,
    publisherHandle: f.sourceAuthor.ownerReceizId, assertCurrent() {} };
  const first = await freezeWildzMarketPublicValuePreparationV129(input);
  const changed = { ...projectionOriginal, filename: "different-projection.json" };
  const repeated = await freezeWildzMarketPublicValuePreparationV129({ ...input, card: admitLegacyCard(card, "2026-07-15T13:00:00.000Z"), projectionOriginal: changed });
  assert.deepEqual(repeated, first);
  assert.deepEqual(repeated.projectionOriginal, projectionOriginal);
  assert.deepEqual(JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(first.payloadB64u))), card);
  assert.equal(first.root, null); assert.equal(first.signed, null);
  assert.equal(f.sealed.length, 0, "preparation is transport storage, never proof authority");
  assert.doesNotMatch(new TextDecoder().decode(receizBase64UrlDecode(first.payloadB64u)), /sigilMetadata|kaiUPulse|privateKeyPkcs8|playState/);
});

test("pending value resume binds the frozen native certificate and accepts only verified card growth", () => {
  // A pure domain guard supplies no SDK verification or producer authority.
  const expected = "a".repeat(64);
  const certificate = { card, sourceDigest: expected };
  const living = admitLegacyCard(card, "2026-07-15T13:00:00.000Z");
  assert.doesNotThrow(() => assertWildzMarketValuePreparationResumeBindingV129(card, living, certificate, expected));
  assert.throws(() => assertWildzMarketValuePreparationResumeBindingV129(card, living, certificate, "b".repeat(64)), /preparation_source_changed/);
  assert.throws(() => assertWildzMarketValuePreparationResumeBindingV129(card, living, { card: living, sourceDigest: expected }, expected), /projection_card_binding_invalid/);
  const foreign = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "value.seller", encounterId: "foreign-resume", capturedAt: "2026-07-15T12:00:00.000Z" });
  assert.throws(() => assertWildzMarketValuePreparationResumeBindingV129(card, foreign, certificate, expected), /card_binding_invalid/);
});

test("resume returns absence without fresh qualification or any proof write", async () => {
  const f = await publisherFixture();
  assert.equal(await f.create().resume(card, "a".repeat(64)), null);
  assert.equal(f.sealed.length, 0);
  assert.equal(await f.database.read("meta", JSON.stringify(["wildz.market-value-root.v129", card.id])), null);
});

test("resume of a frozen descendant requires real SDK admission before any root seal", async () => {
  const f = await publisherFixture();
  const preparation = await freezeWildzMarketPublicValuePreparationV129({ database: f.database, card,
    projectionOriginal: await invalidProjectionTransport(), applicationId: f.sourceAuthor.grant.applicationId,
    publisherHandle: f.sourceAuthor.ownerReceizId, assertCurrent() {} });
  const current = admitLegacyCard(card, "2026-07-15T13:00:00.000Z");
  await assert.rejects(f.create().resume(current, "a".repeat(64)), /artifact_not_verified/);
  assert.equal(f.sealed.length, 0);
  assert.deepEqual(await f.database.read("meta", JSON.stringify(["wildz.market-value-root.v129", card.id])), preparation);
});

test("resume refuses private or altered frozen payload before any root seal", async () => {
  for (const mutation of ["private", "hash", "publisher", "application"] as const) {
    const f = await publisherFixture();
    const preparation = await freezeWildzMarketPublicValuePreparationV129({ database: f.database, card,
      projectionOriginal: await invalidProjectionTransport(), applicationId: f.sourceAuthor.grant.applicationId,
      publisherHandle: f.sourceAuthor.ownerReceizId, assertCurrent() {} });
    const changed = mutation === "private" ? { ...preparation, player: { privateVault: true } }
      : mutation === "hash" ? { ...preparation, payloadSha256: "b".repeat(64) }
      : mutation === "publisher" ? { ...preparation, publisherHandle: "other.seller.receiz.id" }
      : { ...preparation, applicationId: "another-application" };
    await f.database.transaction(["meta"], "readwrite", tx => tx.put("meta", changed, JSON.stringify(["wildz.market-value-root.v129", card.id])));
    await assert.rejects(f.create().resume(card, "a".repeat(64)), /private_source_forbidden|preparation_binding_invalid/);
    assert.equal(f.sealed.length, 0);
  }
});

test("storage failure and public-source outage cause zero Record -> Seal writes", async () => {
  const storage = await publisherFixture({ storageFailure: true });
  await assert.rejects(freezeWildzMarketPublicValuePreparationV129({ database: storage.storage, card, projectionOriginal: await invalidProjectionTransport(),
    applicationId: storage.sourceAuthor.grant.applicationId, publisherHandle: storage.sourceAuthor.ownerReceizId, assertCurrent() {} }), /storage unavailable/);
  assert.equal(storage.sealed.length, 0);
  const network = await publisherFixture({ publicFailure: true });
  await assert.rejects(network.create().publish(card, await invalidProjectionTransport()), /public_read_unavailable/);
  assert.equal(network.sealed.length, 0);
});

test("unsealed projection certificate causes zero public-root seal and preparation writes", async () => {
  const f = await publisherFixture();
  await assert.rejects(f.create().publish(card, await invalidProjectionTransport()), /artifact_not_verified/);
  assert.equal(f.sealed.length, 0);
  assert.equal(await f.database.read("meta", JSON.stringify(["wildz.market-value-root.v129", card.id])), null);
});

test("anonymous value source reader distinguishes absence and refuses payload-only proof bytes", async () => {
  const record = await invalidPublicRecord();
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), `/api/wilds/market/value/${encodeURIComponent(card.id)}`);
    assert.equal(init?.method, "GET"); assert.equal(init?.credentials, "omit");
    assert.equal(init?.body, undefined);
    return new Response(JSON.stringify({ ok: true, record }), { status: 200 });
  };
  await assert.rejects(readWildzMarketPublicValueSourceV129(card.id, card, fetcher), /artifact_not_verified/);
  assert.equal(await readWildzMarketPublicValueSourceV129(card.id, card, async () => new Response(null, { status: 404 })), null);
});

test("public value GET forwards no cookie authority and reports unpublished proof", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(new URL(String(url)).pathname, "/api/public-proof/by-url");
      assert.equal(new Headers(init?.headers).has("authorization"), false);
      assert.equal(new Headers(init?.headers).has("cookie"), false);
      return new Response(JSON.stringify({ ok: true, record: null }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const response = await GET(new NextRequest(`https://wildz.quest/api/wilds/market/value/${encodeURIComponent(card.id)}`, { headers: { cookie: "private=value" } }), { params: Promise.resolve({ assetId: card.id }) });
    assert.equal(response.status, 404); assert.equal(calls, 1);
    assert.equal((await response.json()).error, "wildz_market_value_not_published");
  } finally { globalThis.fetch = previous; }
});

test("public value POST refuses malformed signed input before any registry or seal write", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw Error("write forbidden"); };
    const request = new NextRequest(`https://wildz.quest/api/wilds/market/value/${encodeURIComponent(card.id)}`, { method: "POST", body: JSON.stringify({ card, askingPriceUsdCents: "1000" }) });
    const response = await POST(request, { params: Promise.resolve({ assetId: card.id }) });
    assert.equal(response.status, 400); assert.equal(calls, 0);
    assert.equal((await response.json()).ok, false);
  } finally { globalThis.fetch = previous; }
});
