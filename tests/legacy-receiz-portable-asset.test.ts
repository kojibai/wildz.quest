import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLegacyReceizPortableAssetDocument,
  extractLegacyReceizPortableAssetDocument,
  serializeLegacyReceizPortableAssetDocument
} from "../src/lib/receiz/legacy-receiz-portable-asset";

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function encodeBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = bytes.slice();
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Buffer.from(digest).toString("hex");
}

async function legacyBundle(overrides: {
  originalBytes?: Uint8Array;
  manifestBasis?: string;
  proofBasis?: string;
  claimId?: string;
} = {}) {
  const payload = utf8(JSON.stringify({ schema: "receiz.wildz.legacy_fixture.v1", cards: [1, 2, 3] }));
  const document = await createLegacyReceizPortableAssetDocument({
    assetType: "proof_object",
    payload: { mimeType: "application/json", bytes: payload },
    ownership: {
      ownerReceizId: "legacy_keeper.receiz.id",
      custody: "current",
      proofRef: "legacy-wildz-genesis"
    },
    provenance: {
      root: "legacy-wildz-genesis",
      appends: [{ schema: "receiz.wildz.append.v1", sequence: 1 }]
    },
    settlement: { state: "none", primitive: "wildz-vault" }
  });
  const originalBytes = overrides.originalBytes ?? serializeLegacyReceizPortableAssetDocument(document);
  const basis = await sha256Hex(originalBytes);
  return {
    document,
    originalBytes,
    bytes: utf8(JSON.stringify({
      kind: "receiz.bundle.v1",
      originalBase64: encodeBase64Url(originalBytes),
      manifest: { basisSha256: overrides.manifestBasis ?? basis },
      proofbundle: {
        artifactSha256Basis: overrides.proofBasis ?? basis,
        receizClaimId: overrides.claimId ?? "legacy-wildz-claim"
      }
    }))
  };
}

test("the app-owned decoder reads a canonical v102 portable-asset bundle without SDK internals", async () => {
  const fixture = await legacyBundle();
  const extracted = await extractLegacyReceizPortableAssetDocument(fixture.bytes);

  assert.deepEqual(extracted.document, fixture.document);
  assert.deepEqual(extracted.originalBytes, fixture.originalBytes);
  assert.equal(extracted.artifactBasisSha256, await sha256Hex(fixture.originalBytes));
  assert.equal(extracted.proofClaimId, "legacy-wildz-claim");
});

test("the legacy decoder rejects payload, envelope-basis, claim, and canonical-byte splices", async () => {
  const fixture = await legacyBundle();
  const document = JSON.parse(new TextDecoder().decode(fixture.originalBytes)) as {
    payload: { sha256: string };
  };
  document.payload.sha256 = "0".repeat(64);
  const payloadSplice = await legacyBundle({ originalBytes: utf8(JSON.stringify(document)) });
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(payloadSplice.bytes),
    /continuity_media_unbound/
  );

  const badManifest = await legacyBundle({ manifestBasis: "f".repeat(64) });
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(badManifest.bytes),
    /continuity_offline_verification_failed/
  );

  const badProof = await legacyBundle({ proofBasis: "e".repeat(64) });
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(badProof.bytes),
    /continuity_offline_verification_failed/
  );

  const missingClaim = await legacyBundle({ claimId: "   " });
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(missingClaim.bytes),
    /continuity_offline_verification_failed/
  );

  const noncanonical = await legacyBundle({
    originalBytes: utf8(new TextDecoder().decode(fixture.originalBytes).replace(/,/g, ", "))
  });
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(noncanonical.bytes),
    /continuity_round_trip_failed/
  );
});

test("the legacy decoder enforces bounded artifacts and canonical base64url", async () => {
  const oversized = new Uint8Array(64 * 1024 * 1024 + 1);
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(oversized),
    /continuity_artifact_too_large/
  );

  const fixture = await legacyBundle();
  const envelope = JSON.parse(new TextDecoder().decode(fixture.bytes)) as { originalBase64: string };
  envelope.originalBase64 = `${envelope.originalBase64}=`;
  await assert.rejects(
    extractLegacyReceizPortableAssetDocument(utf8(JSON.stringify(envelope))),
    /continuity_payload_missing/
  );
});
