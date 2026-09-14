import assert from "node:assert/strict";
import test from "node:test";
import { sealCollectedCard, verifyAnyWildsCard, wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";

test("identical decoded card contents reuse verification while changed bytes with the same claimed digest do not", () => {
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "verification_reuse", encounterId: "exact-content-cache", capturedAt: "2026-09-14T12:00:00.000Z" });
  assert.equal(verifyAnyWildsCard(asset).ok, true);
  const before = wildsCardVerificationDiagnostics();
  for (let index = 0; index < 5; index++) assert.equal(verifyAnyWildsCard(structuredClone(asset)).ok, true);
  const after = wildsCardVerificationDiagnostics();
  assert.equal(after.executions, before.executions);
  assert.equal(after.contentCacheHits, before.contentCacheHits + 5);
  const changed = structuredClone(asset);
  changed.manifest.name = "Tampered after verification";
  assert.equal(changed.proof.digest, asset.proof.digest);
  assert.equal(verifyAnyWildsCard(changed).ok, false);
  assert.equal(wildsCardVerificationDiagnostics().executions, after.executions + 1);
});
