import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Wildz uses the v103 native Record/Seal proof-object contract", () => {
  const proofExport = readFileSync("src/lib/receiz/wildz-proof-object-export.ts", "utf8");
  const route = readFileSync("app/api/receiz/proof-object/route.ts", "utf8");

  assert.match(proofExport, /ReceizProofObjectCreateInput/);
  assert.match(proofExport, /ReceizProofObjectCreateResult/);
  assert.match(proofExport, /carrier !== "native-record-seal"/);
  assert.match(proofExport, /assetType: "proof_object"/);
  assert.match(proofExport, /payload: \{ mimeType: "image\/png", bytes:/);
  assert.match(proofExport, /wildz-v103-/);
  assert.doesNotMatch(proofExport, /ReceizPortableAsset/);
  assert.doesNotMatch(proofExport, /ownership:/);
  assert.doesNotMatch(proofExport, /provenance:/);
  assert.doesNotMatch(proofExport, /settlement:/);
  assert.match(route, /created\.artifact\.stream\(\)/);
  assert.match(route, /receiz-v103-native-record-seal/);
  assert.doesNotMatch(route, /receiz-v102-proof-object/);
});
