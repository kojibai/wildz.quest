import assert from "node:assert/strict";
import { test } from "node:test";
import { openWildzSealedDocument, verifyWildzSealedExport, wildzSealedDownloadFilename } from "../src/lib/receiz/wildz-sealed-document";

test("unsealed payload and forged enclosing document cannot pass export or restore", async () => {
  const bytes = new TextEncoder().encode('{"kind":"receiz.bundle.v1","payload":"unverified"}');
  await assert.rejects(verifyWildzSealedExport(bytes, bytes), /continuity_invalid/);
  await assert.rejects(openWildzSealedDocument({ bytes, mimeType: "application/json" }), /wildz_artifact_verification_failed:invalid:ARTIFACT_VERIFICATION_FAILED/);
  await assert.rejects(verifyWildzSealedExport(new Uint8Array(), bytes), /size_invalid/);
});

test("bundle downloads keep a container extension even when the UI requests PNG", () => {
  assert.equal(wildzSealedDownloadFilename("creature.receized.png", "application/vnd.receiz.bundle+json"), "creature.receizbundle");
  assert.equal(wildzSealedDownloadFilename("vault.receizbundle", "application/vnd.receiz.bundle+json"), "vault.receizbundle");
  assert.equal(wildzSealedDownloadFilename("creature.receized.png", "image/png"), "creature.receized.png");
});
