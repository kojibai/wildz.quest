import assert from "node:assert/strict";
import test from "node:test";
import {
  completeWildsCapabilityAdmission,
  resolveWildsCapabilityRequest
} from "../src/features/play/wilds-world-capability-action";
import type { WildsCapabilityContext } from "../src/features/play/wilds-world-capability-context";
import type { WildsWorldCapabilityFamily } from "../src/features/play/wilds-world-capability-registry";

function context(
  family: WildsWorldCapabilityFamily,
  kind: WildsCapabilityContext["intent"]["kind"],
  targetId: string | null = null,
  expectedHead: string | null = null
): WildsCapabilityContext {
  return Object.freeze({
    family,
    state: kind === "explain-recovery" ? "recovering" : targetId ? "awakened" : "ready",
    candidateIds: Object.freeze(targetId ? [targetId] : []),
    primaryTargetId: targetId,
    explanation: `${family} feedback`,
    intent: Object.freeze({ kind, targetId, expectedHead })
  });
}

test("resolves execution, sustained, source preview, guidance, and recovery without a remote permission branch", () => {
  assert.deepEqual(resolveWildsCapabilityRequest({ family: "flight", assetId: "asset:1" }, context("flight", "execute")), {
    kind: "immediate", family: "flight", assetId: "asset:1", targetId: null
  });
  assert.deepEqual(resolveWildsCapabilityRequest({ family: "light", assetId: "asset:1" }, context("light", "toggle")), {
    kind: "sustained", family: "light", assetId: "asset:1", active: true, targetId: null
  });
  const source = resolveWildsCapabilityRequest({ family: "lumber", assetId: "asset:1" }, context("lumber", "source-preview", "tree:1", "sha256:source"));
  assert.equal(source.kind, "source-preview");
  if (source.kind === "source-preview") {
    assert.equal(source.targetId, "tree:1");
    assert.equal(source.expectedHead, "sha256:source");
    assert.match(source.idempotencyKey, /^capability:/);
  }
  assert.equal(resolveWildsCapabilityRequest({ family: "track", assetId: "asset:1" }, context("track", "highlight-route")).kind, "guidance");
  assert.equal(resolveWildsCapabilityRequest({ family: "rescue", assetId: "asset:1" }, context("rescue", "explain-recovery")).kind, "recovery");
});

test("rejects context from a different family before any action", () => {
  assert.throws(
    () => resolveWildsCapabilityRequest({ family: "flight", assetId: "asset:1" }, context("swim", "execute")),
    /wilds_capability_context_mismatch/
  );
});

test("global distribution state cannot demote a locally admitted source transition", () => {
  const admitted = Object.freeze({ transitionId: "transition:1", sourceHead: "sha256:local", localStatus: "admitted" as const });
  const offline = completeWildsCapabilityAdmission(admitted, "offline");
  const synced = completeWildsCapabilityAdmission(admitted, "synced");

  assert.deepEqual(offline, { ...admitted, distributionStatus: "pending" });
  assert.deepEqual(synced, { ...admitted, distributionStatus: "synced" });
  assert.equal(offline.localStatus, "admitted");
});

