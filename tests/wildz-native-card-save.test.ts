import assert from "node:assert/strict";
import { test } from "node:test";
import { saveBlobToDevice } from "../src/features/play/card-export";

test("native card sheet opens synchronously with the prepared file and no blob read", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let shared: ShareData | undefined;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => true,
    share: (data: ShareData) => { shared = data; return Promise.resolve(); }
  } });
  try {
    const blob = new Blob(["prepared-card"], { type: "image/png" });
    blob.arrayBuffer = async () => { throw new Error("must not delay user activation"); };
    const saving = saveBlobToDevice(blob, "creature.png");
    assert.ok(shared, "native sheet must be requested before the first async yield");
    assert.equal(shared.files?.[0]?.name, "creature.png");
    assert.equal(await shared.files![0]!.text(), "prepared-card");
    assert.equal(await saving, "native-share");
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});

test("a browser rejecting file-share capability still downloads on the first call", async () => {
  const originals = new Map(["navigator", "document", "window"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let clicks = 0;
  const anchor = { href: "", download: "", style: { display: "" }, click: () => { clicks++; }, remove: () => {} };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    canShare: () => { throw new DOMException("Unavailable", "NotAllowedError"); },
    share: () => { throw new Error("must not share"); }
  } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => anchor, body: { appendChild: () => {} } } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: (callback: () => void) => { callback(); } } });
  try {
    assert.equal(await saveBlobToDevice(new Blob(["proof"]), "identity.png"), "download");
    assert.equal(clicks, 1);
    assert.equal(anchor.download, "identity.png");
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
