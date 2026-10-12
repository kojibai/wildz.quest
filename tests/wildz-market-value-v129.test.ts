import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { verifyReceizArtifact, createReceizArtifactAdmissionEngine, digestReceizCanonicalV122 } from "@receiz/sdk";
import { projectReceizProofValueV129, verifyReceizProofValueReplayV129 } from "@receiz/sdk/valuation";
import { sealCollectedCard, canonicalPortableCardJson } from "../src/features/play/portable-card";
import { createWildzMarketValuePortV129, wildzMarketModelCoordinatesV129, type WildzMarketValueSourceV129 } from "../src/features/market/wildz-market-value-v129";

const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "value.reader", encounterId: "v129:value-reader", capturedAt: "2026-07-15T12:00:00.000Z" });
const evaluation = () => ({ valuationKaiUPulse: "16000000000000", sampleKaiUPulses: ["16000000000000"] });
const localPayload = new TextEncoder().encode(canonicalPortableCardJson(card));
const payloadDigest = createHash("sha256").update(localPayload).digest("hex");
const source = (patch: Partial<WildzMarketValueSourceV129> = {}): WildzMarketValueSourceV129 => ({
  assetId: card.id, cardProofDigest: card.proof.digest, artifactBytes: localPayload,
  proofArtifactDigest: payloadDigest, originProofArtifactDigest: payloadDigest, historyHead: null,
  filename: "card.json", mimeType: "application/json", portableHistory: false, ...patch
});

test("default model coordinates clamp to admitted origin without inventing exact issuance precision", () => {
  assert.deepEqual(wildzMarketModelCoordinatesV129("10", null, "14000031"), ["10000000", "10000031", "11000031", "12000031", "13000031", "14000031"]);
  assert.deepEqual(wildzMarketModelCoordinatesV129("10", "10000020", "14000031"), ["10000020", "10000031", "11000031", "12000031", "13000031", "14000031"]);
  const longer = wildzMarketModelCoordinatesV129("10", null, "100000000");
  assert.equal(longer.length, 32); assert.equal(longer[0], "69000000"); assert.equal(longer.at(-1), "100000000");
});

test("v129 refuses a local card genome/proof payload without a canonical enclosing artifact", async () => {
  const port = createWildzMarketValuePortV129({ resolveSource: async () => source(), evaluation });
  const result = await port.read(card.id);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.match(result.message, /ARTIFACT_(?:DIGEST_MISMATCH|VERIFICATION_FAILED)/);
  assert.equal((await verifyReceizArtifact(localPayload)).status, "invalid");
});

test("v129 rejects a resolver selecting another card before its bytes enter valuation", async () => {
  const result = await createWildzMarketValuePortV129({ resolveSource: async () => source({ assetId: `wilds:${"f".repeat(24)}` }), evaluation }).read(card.id);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.match(result.message, /VALUATION_ASSET_BINDING_INVALID/);
});

test("v129 requires explicit canonical evaluation coordinates and bounded samples", async () => {
  let reads = 0;
  for (const input of [
    { valuationKaiUPulse: "016000000000000", sampleKaiUPulses: ["16000000000000"] },
    { valuationKaiUPulse: "16000000000000", sampleKaiUPulses: Array.from({ length: 33 }, () => "16000000000000") },
    { valuationKaiUPulse: "16000000000000", sampleKaiUPulses: ["invalid"] }
  ]) {
    const result = await createWildzMarketValuePortV129({ resolveSource: async () => { reads++; return source(); }, evaluation: () => input }).read(card.id);
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.match(result.message, /KAI_VALUATION_INVALID|SAMPLE_LIMIT/);
  }
  assert.equal(reads, 0, "invalid display requests do not even open a public source");
});

test("v129 distinguishes missing complete public source from invented price/history", async () => {
  const result = await createWildzMarketValuePortV129({ resolveSource: async () => null, evaluation }).read(card.id);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.match(result.message, /VALUATION_PUBLIC_ARTIFACT_NOT_AVAILABLE/);
  assert.equal("value" in result, false);
});

test("v129 rejects a mismatched exact artifact digest before publishing any replay", async () => {
  const result = await createWildzMarketValuePortV129({ resolveSource: async () => source({ proofArtifactDigest: "f".repeat(64) }), evaluation }).read(card.id);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.match(result.message, /ARTIFACT_DIGEST_MISMATCH/);
  assert.equal("value" in result, false);
});

test("v129 does not disclose private resolver error details", async () => {
  const result = await createWildzMarketValuePortV129({ resolveSource: async () => { throw Error("https://user:private@host/value?token=secret"); }, evaluation }).read(card.id);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") {
    assert.match(result.message, /VALUATION_PUBLIC_READ_FAILED/);
    assert.doesNotMatch(result.message, /private|token|secret|user/);
  }
});

test("v129 bounds simultaneous public source reads and releases the limit afterward", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let reads = 0;
  const port = createWildzMarketValuePortV129({ resolveSource: async () => { reads++; await gate; return null; }, evaluation });
  const pending = Array.from({ length: 4 }, () => port.read(card.id));
  const overflow = await port.read(card.id);
  assert.equal(overflow.status, "unavailable");
  if (overflow.status === "unavailable") assert.match(overflow.message, /VALUATION_READ_BUSY/);
  assert.equal(reads, 4);
  release();
  await Promise.all(pending);
  const next = await port.read(card.id);
  assert.equal(next.status, "unavailable");
  if (next.status === "unavailable") assert.match(next.message, /VALUATION_PUBLIC_ARTIFACT_NOT_AVAILABLE/);
  assert.equal(reads, 5);
});

test("real v129 admission and projection reject payload-only and copied custody", async () => {
  const verification = await verifyReceizArtifact(localPayload);
  const admission = await createReceizArtifactAdmissionEngine()(verification, { profile: "portable-state" });
  assert.equal(admission.verdict, "invalid");
  assert.equal(admission.writesPerformed, 0);
  await assert.rejects(projectReceizProofValueV129({ source: {
    status: "verified-artifact", artifactDigest: { value: "a".repeat(64) }
  } as unknown as Parameters<typeof projectReceizProofValueV129>[0]["source"], valuationKaiUPulse: "16000000000000" }), /ARTIFACT_VERIFICATION_NOT_RUNTIME_CUSTODIED/);
});

test("real v129 replay refuses a freshly checksummed detached source without network or writes", async () => {
  const previousFetch = globalThis.fetch;
  let requests = 0;
  try {
    globalThis.fetch = async () => { requests++; throw Error("valuation_network_forbidden"); };
    const body = { schema: "receiz.proof-value-replay.v129", sdkVersion: "129.0.0", roots: {
      kind: "sdk-pinned-signature-v4", digest: "f".repeat(64), keyIds: []
    }, source: { exactBytesB64u: Buffer.from(localPayload).toString("base64url"), filename: "card.json", mimeType: "application/json",
      artifactDigest: "a".repeat(64), payloadDigest: "b".repeat(64), admissionProfile: null, historyHead: null },
    policy: { algorithm: "phi/kosmos-vφ-5", checksum: "b05b2049" }, options: {}, saleRecoveries: [],
    valuationKaiUPulses: ["16000000000000"], expectedProjectionDigests: ["c".repeat(64)] };
    const result = await verifyReceizProofValueReplayV129({ ...body, replayDigest: await digestReceizCanonicalV122(body) });
    assert.equal(result.status, "invalid-replay");
    if (result.status === "invalid-replay") assert.match(result.code, /PINNED_ROOTS_MISMATCH/);
    assert.equal(result.writesPerformed, 0);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = previousFetch; }
});

test("real v129 replay verifies pinned roots before rejecting unsealed artifact bytes", async () => {
  // Public 129.0.0 Signature-V4 root metadata; no signing material is used.
  const roots = ["receiz.v3.prod.2026-03-02", "receiz.v4.prod.2026-03-02"].map(kid => [kid, {
    kid, alg: "Ed25519", publicKeyRawB64u: "z2pQNWhfQIfrFlkdutiHYLXmgwlt90UX8iIc8HvKtI0", status: "active"
  }]);
  const body = { schema: "receiz.proof-value-replay.v129", sdkVersion: "129.0.0", roots: {
    kind: "sdk-pinned-signature-v4", digest: await digestReceizCanonicalV122(roots), keyIds: roots.map(row => row[0])
  }, source: { exactBytesB64u: Buffer.from(localPayload).toString("base64url"), filename: "card.json", mimeType: "application/json",
    artifactDigest: payloadDigest, payloadDigest, admissionProfile: null, historyHead: null },
  policy: { algorithm: "phi/kosmos-vφ-5", checksum: "b05b2049" }, options: {}, saleRecoveries: [],
  valuationKaiUPulses: ["16000000000000"], expectedProjectionDigests: ["c".repeat(64)] };
  const result = await verifyReceizProofValueReplayV129({ ...body, replayDigest: await digestReceizCanonicalV122(body) });
  assert.equal(result.status, "invalid-replay");
  if (result.status === "invalid-replay") assert.equal(result.code, "V129_REPLAY_SOURCE_NOT_VERIFIED");
  assert.equal(result.writesPerformed, 0);
});
