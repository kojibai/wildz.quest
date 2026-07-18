import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzArtifactHistory } from "../src/lib/receiz/wildz-artifact-history";
import type { WildzAdmittedArtifact } from "../src/lib/receiz/wildz-artifact-custody";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

function artifact(overrides: Partial<WildzAdmittedArtifact> = {}): WildzAdmittedArtifact {
  return {
    artifactBytes: new Uint8Array([1, 2, 3]),
    artifactSha256: "a".repeat(64),
    payloadBytes: new Uint8Array([9]),
    payloadSha256: "b".repeat(64),
    filename: "proof.receized",
    mimeType: "application/json",
    ownerReceizId: "keeper.receiz.id",
    claimId: "claim-v108",
    verifyPath: "/v/claim-v108",
    recordId: "record-v108",
    compatibility: "current-native",
    ...overrides
  };
}

test("complete verified artifacts are retained exactly and duplicate admission is idempotent", async () => {
  const history = createWildzArtifactHistory(createMemoryWildzContinuityDatabase());
  const first = await history.append(artifact());
  const second = await history.append(artifact());

  assert.deepEqual(second, first);
  assert.deepEqual((await history.read("a".repeat(64)))?.artifactBytes, new Uint8Array([1, 2, 3]));
  assert.equal((await history.list()).length, 1);
});

test("an existing artifact digest can never be overwritten with different provenance or bytes", async () => {
  const history = createWildzArtifactHistory(createMemoryWildzContinuityDatabase());
  await history.append(artifact());

  await assert.rejects(history.append(artifact({ ownerReceizId: "attacker.receiz.id" })), /wildz_artifact_history_conflict/);
  await assert.rejects(history.append(artifact({ artifactBytes: new Uint8Array([1, 2, 4]) })), /wildz_artifact_history_conflict/);
  assert.equal((await history.read("a".repeat(64)))?.ownerReceizId, "keeper.receiz.id");
});
