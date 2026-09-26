import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createWildsGroundTexture, hydrateWildsGroundTexture } from "../src/features/play/wilds-ground-texture";

test("ground detail starts immediately, shares its decode, and ignores disposed consumers", async () => {
  const originalFetch = globalThis.fetch;
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let requests = 0;
  let decodes = 0;
  let closed = 0;
  let resolveFetch!: (response: Response) => void;
  globalThis.fetch = (() => { requests++; return new Promise<Response>(resolve => { resolveFetch = resolve; }); }) as typeof fetch;
  globalThis.createImageBitmap = (async () => { decodes++; return { close: () => { closed++; } }; }) as unknown as typeof createImageBitmap;
  globalThis.document = { createElement: () => ({ getContext: () => ({
    drawImage() {}, getImageData: () => ({ data: new Uint8Array(128 * 128 * 4).fill(120) })
  }) }) } as unknown as Document;
  const live = createWildsGroundTexture("#335522");
  const disposed = createWildsGroundTexture("#335522");
  const before = new Uint8Array(live.image.data!);
  const cancelLive = hydrateWildsGroundTexture(live, "#335522");
  const cancelDisposed = hydrateWildsGroundTexture(disposed, "#335522");
  cancelDisposed();
  try {
    assert.equal(requests, 1, "a fixed delay must not postpone settled ground detail");
    resolveFetch({ ok: true, blob: async () => new Blob(["texture"]) } as Response);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(decodes, 1);
    assert.equal(closed, 1);
    assert.notDeepEqual(live.image.data, before);
    assert.deepEqual(disposed.image.data, before);
  } finally {
    cancelLive(); cancelDisposed(); live.dispose(); disposed.dispose();
    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});

test("closed optional experiences do not start their imports during world boot", () => {
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  for (const component of ["WildsLandmarkExperience", "WildsSettlementExperience", "WildsEcologyExperience", "WildsRaidExperience"]) {
    assert.match(source, new RegExp(`<WildsVisitedSurface active=\\{[^\\n]+\\}>\\s*<${component}`));
  }
});


test("startup terrain optimization preserves every sampled terrain field", () => {
  const samples = [];
  for (let z = -30; z <= 30; z++) for (let x = -30; x <= 30; x++) {
    samples.push(sampleWildsTerrain(x * 2.125, z * 2.125));
  }
  // Recorded from the original implementation, including normals, traversal,
  // materials, regions and water depth, across 3,721 land/water/route positions.
  assert.equal(createHash("sha256").update(JSON.stringify(samples)).digest("hex"),
    "66d4659cccfbf1c1c139b001b4db8728d553b39503dececc5f6cbaf488a3ea01");
});
