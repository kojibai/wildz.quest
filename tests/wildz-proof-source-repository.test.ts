import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildzProofSourceRepository } from "../src/lib/receiz/wildz-proof-source-repository";
import { createWildzArtifactHistory } from "../src/lib/receiz/wildz-artifact-history";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const sha = "a".repeat(64);

test("unsealed export bytes never enter retained proof custody or the asset index", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const sources = createWildzProofSourceRepository(database);
  await assert.rejects(sources.retain({ bytes: new TextEncoder().encode('{"head":"claimed"}'),
    filename: "creature.json", mimeType: "application/json", assetId: "creature-1" }), /verification_failed/);
  assert.deepEqual(database.dump().artifacts, []);
  assert.deepEqual(await sources.locateAsset("creature-1"), { artifactSha256s: [], nextCursor: null });
});

test("a missing predecessor source is reported with its exact digest, never fabricated", async () => {
  const sources = createWildzProofSourceRepository(createMemoryWildzContinuityDatabase());
  await assert.rejects(sources.openFamily([{ currentArtifactSha256: sha,
    identityArtifactSha256: "b".repeat(64), subjectArtifactSha256: null }]), new RegExp(`wildz_exact_source_missing:${sha}`));
});

test("restored legacy artifact rows are reverified, not promoted from claimed admission metadata", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", {
    schema: "receiz.wildz.artifact_history.v119", artifactBytes: new Uint8Array([1, 2, 3]),
    artifactSha256: sha, payloadSha256: sha, filename: "forged.receiz", mimeType: "application/json"
  }, sha));
  await assert.rejects(createWildzProofSourceRepository(database).read(sha), /verification_failed/);
});

test("corrupt retained records fail closed and do not contaminate the legacy history listing", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await database.transaction(["artifacts"], "readwrite", async tx => {
    await tx.put("artifacts", { schema: "wildz.exact-proof-source.v126", artifact: { artifactSha256: "b".repeat(64) } }, `exact-proof-source:${sha}`);
    await tx.put("artifacts", null, "corrupt-null");
  });
  await assert.rejects(createWildzProofSourceRepository(database).read(sha), /record_invalid/);
  assert.deepEqual(await createWildzArtifactHistory(database).list(), []);
});

test("asset locations paginate immutable individual entries without loading full history", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const hashes = Array.from({ length: 120 }, (_, i) => i.toString(16).padStart(64, "0"));
  await database.transaction(["meta"], "readwrite", async tx => {
    for (let i = 0; i < hashes.length; i++) await tx.put("meta", { artifactSha256: hashes[i], previous: hashes[i + 1] ?? null },
      JSON.stringify(["exact-proof-source-asset-entry", "creature-1", hashes[i]]));
    await tx.put("meta", hashes[0], JSON.stringify(["exact-proof-source-asset-head", "creature-1"]));
  });
  const sources = createWildzProofSourceRepository(database);
  const page = await sources.locateAsset("creature-1", undefined, 24);
  assert.deepEqual(page, { artifactSha256s: hashes.slice(0, 24), nextCursor: hashes[24] });
  const older = await sources.locateAsset("creature-1", page.nextCursor!, 96);
  assert.deepEqual(older, { artifactSha256s: hashes.slice(24), nextCursor: null });
  await assert.rejects(sources.locateAsset("creature-1", undefined, 97), /page_invalid/);
  await assert.rejects(sources.locateAsset("other", page.nextCursor!), /index_invalid/);
  assert.equal(database.dump().meta.length, 121);
});

test("family root count is bounded before any repository read or canonical verification", async () => {
  const database = createMemoryWildzContinuityDatabase();
  let reads = 0;
  const sources = createWildzProofSourceRepository({ ...database, read: async (...args) => { reads++; return database.read(...args); } });
  await assert.rejects(sources.openFamily([{ currentArtifactSha256: sha, identityArtifactSha256: "b".repeat(64), subjectArtifactSha256: null }],
    { maxArtifacts: 1 }), /artifact_budget_exhausted/);
  assert.equal(reads, 0);
  // The same exact source selected for two roles occupies only one artifact slot.
  await assert.rejects(sources.openFamily([{ currentArtifactSha256: sha, identityArtifactSha256: sha, subjectArtifactSha256: null }],
    { maxArtifacts: 1 }), /source_missing/);
  assert.equal(reads, 2); // namespaced source lookup and legacy fallback
  assert.deepEqual(database.dump().artifacts, []);
});

test("family byte budget rejects retained transport before decoding invalid base64 or verifying it", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", {
    schema: "wildz.exact-proof-source.v126", artifact: { artifactSha256: sha, exactBytesB64u: "!".repeat(16),
      payloadSha256: sha, filename: "invalid.receiz", mimeType: "application/json" }
  }, `exact-proof-source:${sha}`));
  const before = database.dump();
  await assert.rejects(createWildzProofSourceRepository(database).openFamily([
    { currentArtifactSha256: sha, identityArtifactSha256: sha, subjectArtifactSha256: null }
  ], { maxDecodedBytes: 8 }), /byte_budget_exhausted/);
  assert.deepEqual(database.dump(), before);
});

test("family byte budget also applies to legacy exact bytes without deleting their history", async () => {
  const database = createMemoryWildzContinuityDatabase();
  await database.transaction(["artifacts"], "readwrite", tx => tx.put("artifacts", {
    schema: "receiz.wildz.artifact_history.v119", artifactBytes: new Uint8Array(16),
    artifactSha256: sha, filename: "invalid.receiz", mimeType: "application/json"
  }, sha));
  const before = database.dump();
  await assert.rejects(createWildzProofSourceRepository(database).openFamily([
    { currentArtifactSha256: sha, identityArtifactSha256: sha, subjectArtifactSha256: null }
  ], { maxDecodedBytes: 8 }), /byte_budget_exhausted/);
  assert.deepEqual(database.dump(), before);
});

test("callers cannot raise hard family budgets or submit unbounded duplicate roots", async () => {
  const sources = createWildzProofSourceRepository(createMemoryWildzContinuityDatabase());
  const binding = { currentArtifactSha256: sha, identityArtifactSha256: sha, subjectArtifactSha256: null };
  await assert.rejects(sources.openFamily([binding], { maxArtifacts: 257 }), /budget_invalid/);
  await assert.rejects(sources.openFamily([binding], { maxDecodedBytes: 64 * 1024 * 1024 + 1 }), /budget_invalid/);
  await assert.rejects(sources.openFamily(Array(257).fill(binding)), /binding_budget_exhausted/);
});
