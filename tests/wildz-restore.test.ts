import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreSummary } from "../src/features/identity/wildz-restore";

test("Identity Seal restoration restores authority without exposing the Seal", () => {
  const summary = restoreSummary({
    kind: "identity-seal",
    keyId: "rz_restored",
    username: "pathfinder",
    displayName: "Pathfinder",
    portableStateVerified: true
  });
  assert.equal(summary.authorityRestored, true);
  assert.doesNotMatch(JSON.stringify(summary), /private|cipher|sealBytes/);
});

test("Vault restoration restores game assets but never identity authority", () => {
  const summary = restoreSummary({ kind: "vault", cardCount: 7, vaultDigest: "a".repeat(64) });
  assert.equal(summary.authorityRestored, false);
  assert.equal(summary.cardCount, 7);
  assert.equal(summary.requiresOwnershipReconciliation, true);
});
