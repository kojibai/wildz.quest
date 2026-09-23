import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz verifies the exact Receiz-sealed Card and Vault before download", () => {
  const proofExport = readFileSync("src/lib/receiz/wildz-proof-object-export.ts", "utf8");
  const route = readFileSync("app/api/receiz/proof-object/route.ts", "utf8");

  assert.match(proofExport, /ReceizProofObjectCreateInput/);
  assert.match(proofExport, /ReceizClient\["assets"\]\["createProofObject"\]/);
  assert.match(proofExport, /downloadAndReopenWildzArtifact/);
  assert.match(proofExport, /assetType: "proof_object"/);
  assert.match(proofExport, /payload: \{ mimeType: "image\/png", bytes:/);
  assert.match(proofExport, /wildz-v126-/);
  assert.doesNotMatch(proofExport, /ReceizPortableAsset/);
  assert.doesNotMatch(proofExport, /ownership:/);
  assert.doesNotMatch(proofExport, /provenance:/);
  assert.doesNotMatch(proofExport, /settlement:/);
  assert.match(route, /resolveWildzCookieActor/);
  assert.match(proofExport, /requireOwnedWildzPng/);
  assert.match(proofExport, /requireWildzIdentityBindingFromEnvelope/);
  assert.match(route, /client.assets.createProofObject/);
  assert.match(route, /createReceizClient/);
  assert.doesNotMatch(route, /\/api\/document-seal/);
  assert.match(route, /receiz-sealed-artifact/);
  assert.doesNotMatch(route, /receiz-v102-proof-object/);
});
