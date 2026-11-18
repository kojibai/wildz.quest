import assert from "node:assert/strict";
import { test } from "node:test";
import { identitySaveErrorMessage } from "../src/features/profile/identity-save-error";
import { openWildzSealedDocument } from "../src/lib/receiz/wildz-sealed-document";

test("a failed signing-device enrollment tells the player which save step to retry", () => {
  const message = identitySaveErrorMessage(new Error("offline_seal_enrollment_failed:503"));
  assert.match(message, /device/i);
  assert.match(message, /503/);
  assert.match(identitySaveErrorMessage(new Error("wildz_local_enrollment_unreachable")), /reach Receiz.*signing-device/);
  assert.match(identitySaveErrorMessage(new Error("offline_seal_certificate_invalid")), /certificate/);
  assert.match(identitySaveErrorMessage(new Error("offline_seal_output_verification_failed")), /verify the new Identity Seal/);
  assert.doesNotMatch(identitySaveErrorMessage(new Error("offline_seal_enrollment_failed:503:private")), /503|private/);
});

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
