import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createLegacyReceizPortableAssetDocument,
  parseLegacyReceizPortableAssetDocument,
  serializeLegacyReceizPortableAssetDocument
} from "../src/lib/receiz/legacy-receiz-portable-asset";

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

test("the compatibility parser accepts only an already-opened verified payload document", async () => {
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
  const serialized = serializeLegacyReceizPortableAssetDocument(document);
  const parsed = await parseLegacyReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(serialized)));

  assert.deepEqual(parsed, document);
  assert.deepEqual(serializeLegacyReceizPortableAssetDocument(parsed), serialized);
});

test("verified-payload parsing still rejects payload and continuity field splices", async () => {
  const document = await createLegacyReceizPortableAssetDocument({
    assetType: "proof_object",
    payload: { mimeType: "application/json", bytes: utf8("verified") },
    ownership: { ownerReceizId: "owner.receiz.id", custody: "current", proofRef: "claim" },
    provenance: { root: "claim", appends: [] },
    settlement: { state: "none" }
  });
  const tampered = structuredClone(document) as unknown as { payload: { sha256: string } };
  tampered.payload.sha256 = "0".repeat(64);
  await assert.rejects(parseLegacyReceizPortableAssetDocument(tampered), /continuity_media_unbound/);
  await assert.rejects(
    parseLegacyReceizPortableAssetDocument({ ...document, ownership: null }),
    /continuity_ownership_missing/
  );
});
