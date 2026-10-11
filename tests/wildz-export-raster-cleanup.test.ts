import assert from "node:assert/strict";
import test from "node:test";
import { portableCardPngBlobForIdentityOwnership, embedPortableCardInPng } from "../src/features/play/card-export";
import { createWildzIdentityCardArtworkPng } from "../src/lib/receiz/wildz-identity-seal";
import { sealCollectedCard } from "../src/features/play/portable-card";
import type { WildzIdentitySession } from "../src/lib/receiz/wildz-identity-repository";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
function platform() {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document"), imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const fetch = globalThis.fetch, revoke = URL.revokeObjectURL;
  const urls: string[] = [];
  let encode: BlobCallback | undefined;
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 100 }) }, {
    get: (target, key) => Reflect.get(target, key) ?? (() => {})
  });
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => { encode = callback; } };
  const images: RasterImage[] = [];
  class RasterImage {
    decoding = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null; source = "";
    constructor() { images.push(this); }
    set src(value: string) { this.source = value; queueMicrotask(() => this.onload?.()); }
    decode() { return new Promise<void>(() => {}); }
    removeAttribute(name: string) { if (name === "src") this.source = ""; }
  }
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => canvas } });
  Object.defineProperty(globalThis, "Image", { configurable: true, value: RasterImage });
  URL.revokeObjectURL = url => { urls.push(url); revoke(url); };
  globalThis.fetch = async () => { throw new Error("raster fallback unavailable"); };
  return { canvas, images, urls, finish(blob: Blob | null) { assert.ok(encode); encode(blob); },
    restore() { URL.revokeObjectURL = revoke; globalThis.fetch = fetch;
      if (documentDescriptor) Object.defineProperty(globalThis, "document", documentDescriptor); else Reflect.deleteProperty(globalThis, "document");
      if (imageDescriptor) Object.defineProperty(globalThis, "Image", imageDescriptor); else Reflect.deleteProperty(globalThis, "Image"); }
  };
}

for (const successful of [true, false]) {
  test(`card raster ${successful ? "preserves encoded proof bytes" : "rejects failed encoding"} and releases only after encoder completion`, async () => {
    const runtime = platform();
    const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "raster", capturedAt: "2026-10-10T12:00:00.000Z" });
    try {
      const pending = portableCardPngBlobForIdentityOwnership(asset);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual([runtime.canvas.width, runtime.canvas.height], [750, 1050]);
      assert.equal(runtime.urls.length, 0, "SVG stays live during PNG encoding");
      runtime.finish(successful ? new Blob([png]) : null);
      if (successful) assert.deepEqual(new Uint8Array(await (await pending).arrayBuffer()), embedPortableCardInPng(png, asset));
      else await assert.rejects(pending, /raster fallback unavailable/);
      assert.deepEqual([runtime.canvas.width, runtime.canvas.height], [0, 0]);
      assert.equal(runtime.images[0]!.source, "");
      assert.equal(runtime.images[0]!.onload, null);
      assert.equal(runtime.images[0]!.onerror, null);
      assert.equal(runtime.urls.length, 1);
    } finally { runtime.restore(); }
  });

  test(`identity artwork ${successful ? "preserves bytes" : "rejects failed encoding"} and releases its raster after completion`, async () => {
    const runtime = platform();
    try {
      const pending = createWildzIdentityCardArtworkPng({ keyId: "fixture", username: "keeper" } as WildzIdentitySession, "2026-10-10T12:00:00.000Z");
      assert.deepEqual([runtime.canvas.width, runtime.canvas.height], [900, 900]);
      runtime.finish(successful ? new Blob([png]) : null);
      if (successful) assert.deepEqual(await pending, png);
      else await assert.rejects(pending, /canvas_export_failed/);
      assert.deepEqual([runtime.canvas.width, runtime.canvas.height], [0, 0]);
    } finally { runtime.restore(); }
  });
}
