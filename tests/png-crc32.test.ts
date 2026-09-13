import assert from "node:assert/strict";
import { test } from "node:test";
import { pngCrc32 } from "../src/lib/png-crc32";
test("PNG checksum preserves the standard vectors and chunk boundaries", () => {
  const bytes = new TextEncoder().encode("123456789");
  assert.equal(pngCrc32(bytes), 0xcbf43926);
  assert.equal(pngCrc32(new Uint8Array()), 0);
  for (let split = 0; split <= bytes.length; split++) assert.equal(pngCrc32(bytes.subarray(0, split), bytes.subarray(split)), 0xcbf43926);
});
test("all byte values and larger PNG payloads match the previous bitwise validator", () => {
  const bytes = Uint8Array.from({ length: 65537 }, (_, i) => (i * 173 + (i >>> 8)) & 255);
  let old = 0xffffffff;
  for (const byte of bytes) { old ^= byte; for (let bit = 0; bit < 8; bit++) old = (old >>> 1) ^ (old & 1 ? 0xedb88320 : 0); }
  assert.equal(pngCrc32(bytes), (old ^ 0xffffffff) >>> 0);
});
