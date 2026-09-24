import assert from "node:assert/strict";
import { test } from "node:test";
import { identitySaveErrorMessage } from "../src/features/profile/identity-save-error";
import { openWildzSealedDocument } from "../src/lib/receiz/wildz-sealed-document";

test("oversized in-memory verification reports the actual SDK denial and byte count", async () => {
  const bytes = new Uint8Array(16 * 1024 * 1024 + 1);
  await assert.rejects(openWildzSealedDocument({ bytes, mimeType: "image/png" }), error => {
    assert.equal(identitySaveErrorMessage(error), "The Identity Seal could not be verified. Diagnostic: denied/VERIFICATION_RESOURCE_UNAVAILABLE (16777217 bytes).");
    return true;
  });
});

test("save diagnostics never echo arbitrary exception contents", () => {
  for (const text of ["private key contents", "wildz_artifact_verification_failed:invalid:private key contents", "wildz_artifact_verification_failed:invalid:" + "a".repeat(200)]) {
    assert.ok(!identitySaveErrorMessage(new Error(text)).includes(text));
  }
  assert.match(identitySaveErrorMessage(new Error("wilds_native_save_cancelled")), /^Save cancelled/);
});
