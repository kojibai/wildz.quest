import assert from "node:assert/strict";
import test from "node:test";
import { sealCollectedCard, verifyAnyWildsCard, wildsCardVerificationDiagnostics } from "../src/features/play/portable-card";
import { isAdmittedWildsCard, verifyAndAdmitWildsCard } from "../src/features/play/admitted-inventory";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";

test("direct immutable admission avoids a full-card cache encoding and retains complete proof checks", (t) => {
  const original = createOwnerBoundInitialPlayState("direct_admission", "2026-10-08T12:00:00.000Z").inventory[0]!;
  const asset = structuredClone(original);
  const changed = structuredClone(original);
  changed.manifest.name = "Forged with the unchanged claimed digest";
  const stringify = JSON.stringify;
  let fullCardEncodings = 0;
  t.mock.method(JSON, "stringify", (value: unknown, ...args: unknown[]) => {
    if (value && typeof value === "object" && "manifest" in value && "proof" in value) fullCardEncodings++;
    return Reflect.apply(stringify, JSON, [value, ...args]);
  });
  assert.equal(verifyAndAdmitWildsCard(asset), true);
  assert.equal(fullCardEncodings, 0, "the full-card content cache is redundant when retaining this exact immutable object");
  assert.ok(isAdmittedWildsCard(asset));
  assert.ok(Object.isFrozen(asset.manifest));
  const before = wildsCardVerificationDiagnostics();
  assert.equal(verifyAnyWildsCard(asset).ok, true);
  assert.equal(wildsCardVerificationDiagnostics().executions, before.executions);
  assert.equal(verifyAndAdmitWildsCard(changed), false);
  assert.equal(isAdmittedWildsCard(changed), false);
});

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
