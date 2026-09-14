import assert from "node:assert/strict";
import { test } from "node:test";
import { compressPublicCardRecord, decompressPublicCardRecord } from "../src/features/play/public-card-compression";

test("large repeated proof histories retain every byte in a bounded compact transport", () => {
  const original = JSON.stringify({ history: Array.from({ length: 5000 }, (_, i) => ({ index: i, proof: "sha256:" + "a".repeat(64), evidence: "exact original evidence" })) });
  const compressed = compressPublicCardRecord(original);
  assert.equal(decompressPublicCardRecord(compressed.recordDeflateB64, compressed.recordByteLength), original);
  assert.ok(compressed.recordDeflateB64.length < original.length / 5);
  assert.throws(() => decompressPublicCardRecord(compressed.recordDeflateB64, 33 * 1024 * 1024));
  assert.throws(() => decompressPublicCardRecord("invalid!", 100));
});
