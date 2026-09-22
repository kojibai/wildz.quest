import assert from "node:assert/strict";
import { test } from "node:test";
import { embedWildsMapInPng, readWildsMapFromPng, mergeWildsMapDiscovery } from "../src/features/play/wilds-map-image";
import { createInitialWildsExplorationAtlas, revealWildsExplorationAt, wildsExplorationBounds, wildsExplorationContainsWorld } from "../src/features/play/wilds-exploration-atlas";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("map image round trip keeps exact remote territory and excludes personal state", () => {
  const atlas = revealWildsExplorationAt(createInitialWildsExplorationAtlas(), { x: 499_999_900, z: -499_999_900 });
  const bytes = embedWildsMapInPng(png, { ...atlas, siteKeys: ["private-site"] });
  assert.deepEqual(readWildsMapFromPng(bytes), { ...atlas, siteKeys: [] });
  assert.equal(splitWildzPngEnvelope(bytes).trailer.length, 0);
  assert.ok(!new TextDecoder().decode(bytes).includes("private-site"));
  assert.deepEqual(bytes.slice(0, png.length - 12), png.slice(0, -12));
});

test("import unions discoveries, preserves personal sites and is idempotent", () => {
  const local = { ...revealWildsExplorationAt(createInitialWildsExplorationAtlas(), { x: -4800, z: 9600 }), siteKeys: ["local-site"] };
  const remote = revealWildsExplorationAt(createInitialWildsExplorationAtlas(), { x: 9600, z: -4800 });
  const imported = readWildsMapFromPng(embedWildsMapInPng(png, remote));
  const combined = mergeWildsMapDiscovery(local, imported);
  assert.ok(wildsExplorationContainsWorld(combined, { x: -4800, z: 9600 }));
  assert.ok(wildsExplorationContainsWorld(combined, { x: 9600, z: -4800 }));
  assert.equal(wildsExplorationBounds(combined).count, 99);
  assert.deepEqual(combined.siteKeys, local.siteKeys);
  assert.deepEqual(mergeWildsMapDiscovery(combined, imported), combined);
  assert.equal(wildsExplorationBounds(local).count, 90);
});

test("ordinary images, damaged payloads and truncated PNGs are rejected", () => {
  assert.throws(() => readWildsMapFromPng(png), /map/i);
  const bytes = embedWildsMapInPng(png, createInitialWildsExplorationAtlas());
  const damaged = bytes.slice(); damaged[damaged.length - 20] ^= 1;
  assert.throws(() => readWildsMapFromPng(damaged));
  assert.throws(() => readWildsMapFromPng(bytes.slice(0, -4)));
  assert.throws(() => readWildsMapFromPng(new Uint8Array([1, 2, 3])));
});

test("invalid discovery ranges cannot be embedded or expanded on import", () => {
  for (const range of [{ minX: 1, maxX: -1 }, { minX: 0, maxX: 1.5 }, { minX: 0, maxX: Number.POSITIVE_INFINITY }]) {
    assert.throws(() => embedWildsMapInPng(png, { version: 1, rows: [{ z: 0, ranges: [range] }], siteKeys: [] }));
  }
});


test("map sharing preserves billions of regions as compact ranges without a territory cap", () => {
  const atlas = { version: 1 as const, rows: [
    { z: -30_000_000, ranges: [{ minX: -2_000_000_000, maxX: 2_000_000_000 }] },
    { z: 40_000_000, ranges: [{ minX: 90_000_000, maxX: 90_000_003 }] }
  ], siteKeys: [] };
  const encoded = embedWildsMapInPng(png, atlas);
  assert.ok(encoded.length < 1024, "ranges must not expand during export");
  const restored = readWildsMapFromPng(encoded);
  assert.deepEqual(restored, atlas);
  const combined = mergeWildsMapDiscovery(createInitialWildsExplorationAtlas(), restored);
  assert.equal(wildsExplorationBounds(combined).count, 4_000_000_086);
  assert.deepEqual(mergeWildsMapDiscovery(combined, restored), combined);
});

test("large discovery payloads span PNG chunks without a metadata-size cap", () => {
  const atlas = { version: 1 as const, rows: Array.from({ length: 80_000 }, (_, z) => ({
    z, ranges: [{ minX: -1_000_000_000, maxX: 1_000_000_000 }]
  })), siteKeys: [] };
  const encoded = embedWildsMapInPng(png, atlas);
  assert.ok(encoded.length > 4 * 1024 * 1024);
  assert.deepEqual(readWildsMapFromPng(encoded), atlas);
  assert.equal(splitWildzPngEnvelope(encoded).trailer.length, 0);
});
