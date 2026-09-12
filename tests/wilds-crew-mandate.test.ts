import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizSubjectMandateV122 } from "@receiz/sdk";
import { prepareWildsCrewMandate, validateWildsCrewMandateCommand, type WildsCrewVerifiedRuntime } from "../src/lib/receiz/wilds-crew-mandate";

// Explicit verifier test doubles model the trusted proof-opening port; these are not live proof evidence.
const proofs = { ownerProofObject: new Blob(["owner exact bytes"]), workerProofObject: new Blob(["worker exact bytes"]) };
const bindings = { ownerSubjectId: "receiz:subject:owner", workerSubjectId: "receiz:subject:worker", ownerHead: "owner-head", workerHead: "worker-head", currentOwnerSubjectId: "receiz:subject:owner", currentKai: "10" };
const bounds = { allowedCommandKinds: ["gather", "build", "gather"], worldIds: ["world"], regionIds: ["region"], maximumResourcePhiMicro: "10", maximumGeometryUnits: "4", maximumActions: "2", expiresAtKai: "20", nonce: "unique-nonce", revocationHead: "revocation-head" };
async function fixture() {
  const result = await prepareWildsCrewMandate({ ...proofs, ...bounds, verifySubjects: async (p) => {
    assert.equal(await p.ownerProofObject.text(), "owner exact bytes"); return bindings;
  } });
  if (!result.ok) throw new Error(result.code);
  assert.equal(result.ok, true);
  const command = { commandKind: "gather", worldId: "world", regionId: "region", resourcePhiMicro: "6", geometryUnits: "2", commandDigest: "exact-command-digest" };
  const runtime: WildsCrewVerifiedRuntime = { ...bindings, activeMandateDigest: result.prepared.mandate.mandateDigest, revoked: false, revocationHead: bounds.revocationHead,
    ownerConfirmedDigest: result.prepared.confirmationDigest, consentGranted: true, consentCommandDigest: command.commandDigest,
    usage: { resourcePhiMicro: "0", geometryUnits: "0", actions: "0" } };
  return { prepared: result.prepared, command, runtime };
}

test("crew preparation uses actual SDK identity and binds owner confirmation to action cap", async () => {
  const { prepared } = await fixture();
  const { maximumActions: _cap, ...sdkBounds } = bounds;
  const exact = await createReceizSubjectMandateV122({ ...sdkBounds, ownerSubjectId: bindings.ownerSubjectId, workerSubjectId: bindings.workerSubjectId,
    expectedOwnerHead: bindings.ownerHead, expectedWorkerHead: bindings.workerHead });
  assert.deepEqual(prepared.mandate, exact);
  const changed = await prepareWildsCrewMandate({ ...proofs, ...bounds, maximumActions: "3", verifySubjects: async () => bindings });
  assert.ok(changed.ok);
  if (changed.ok) { assert.equal(changed.prepared.mandate.mandateDigest, exact.mandateDigest); assert.notEqual(changed.prepared.confirmationDigest, prepared.confirmationDigest); }
});

test("preflight passes exact command to verifier and returns cumulative proposed usage without mutation", async () => {
  const f = await fixture(); const before = JSON.stringify(f);
  const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, verifyRuntime: async (request) => { assert.deepEqual(request.command, f.command); return f.runtime; } });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.nextUsage, { resourcePhiMicro: "6", geometryUnits: "2", actions: "1" });
  assert.equal(JSON.stringify(f), before);
});

test("revocation, transfer, stale heads, expiry, scope, consent and cumulative budgets fail with zero mutations", async () => {
  const cases: Array<[string, Partial<WildsCrewVerifiedRuntime>]> = [
    ["revoked", { revoked: true }], ["revocation head", { revocationHead: "new" }],
    ["transfer", { currentOwnerSubjectId: "new-owner" }], ["owner head", { ownerHead: "new" }], ["worker head", { workerHead: "new" }],
    ["expiry boundary", { currentKai: "20" }], ["confirmation", { ownerConfirmedDigest: "other" }],
    ["consent", { consentGranted: false }], ["different command consent", { consentCommandDigest: "other" }],
    ["Phi total", { usage: { resourcePhiMicro: "5", geometryUnits: "0", actions: "0" } }],
    ["geometry total", { usage: { resourcePhiMicro: "0", geometryUnits: "3", actions: "0" } }],
    ["action total", { usage: { resourcePhiMicro: "0", geometryUnits: "0", actions: "2" } }],
    ["negative usage", { usage: { resourcePhiMicro: "-1", geometryUnits: "0", actions: "0" } }]
  ];
  for (const [label, patch] of cases) {
    const f = await fixture(); const runtime = { ...f.runtime, ...patch }; const before = JSON.stringify({ f, runtime });
    const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, verifyRuntime: async () => runtime });
    assert.equal(result.ok, false, label); if (!result.ok) assert.equal(result.writesOnFailure, 0);
    assert.equal(JSON.stringify({ f, runtime }), before);
  }
  for (const patch of [{ worldId: "" }, { worldId: "other" }, { regionId: "other" }, { commandKind: "trade" }, { resourcePhiMicro: "-1" }]) {
    const f = await fixture();
    const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, command: { ...f.command, ...patch }, verifyRuntime: async () => f.runtime });
    assert.equal(result.ok, false);
  }
});

test("tampered prepared data and verifier failure cannot authorize commands", async () => {
  const f = await fixture();
  for (const prepared of [{ ...f.prepared, maximumActions: "999" }, { ...f.prepared, mandate: { ...f.prepared.mandate, maximumResourcePhiMicro: "999" } }]) {
    const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, prepared, verifyRuntime: async () => f.runtime }); assert.equal(result.ok, false);
  }
  assert.equal((await prepareWildsCrewMandate({ ...proofs, ...bounds, verifySubjects: async () => null })).ok, false);
  assert.deepEqual(await validateWildsCrewMandateCommand({ ...proofs, ...f, verifyRuntime: async () => { throw new Error("unavailable"); } }), { ok: false, code: "crew_mandate_validation_failed", writesOnFailure: 0 });
});

test("success returns the exact runtime heads checked before asynchronous SDK digest verification", async () => {
  const f = await fixture();
  const runtime = { ...f.runtime };
  const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, verifyRuntime: async () => {
    // The second microtask runs after the caller resumes but during SDK hashing.
    queueMicrotask(() => queueMicrotask(() => {
      runtime.ownerHead = "unvalidated-owner-head";
      runtime.workerHead = "unvalidated-worker-head";
    }));
    return runtime;
  } });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.ownerHead, bindings.ownerHead);
    assert.equal(result.workerHead, bindings.workerHead);
  }
});

test("extra command properties cannot override the owner-confirmed mandate during SDK validation", async () => {
  const f = await fixture();
  const { mandateDigest: _digest, mandateId: _id, schema: _schema, ...original } = f.prepared.mandate;
  const alternate = await createReceizSubjectMandateV122({ ...original, maximumResourcePhiMicro: "1000" });
  const command = { ...f.command, resourcePhiMicro: "999", mandate: alternate };
  const result = await validateWildsCrewMandateCommand({ ...proofs, ...f, command, verifyRuntime: async () => f.runtime });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.writesOnFailure, 0);
});
