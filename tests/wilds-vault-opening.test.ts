import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultIdentityRepository } from "../src/lib/receiz/wildz-active-identity";

test("preloading the Vault component starts no export, identity recovery, worker, or transport", async context => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  let workers = 0, identityReads = 0, exports = 0, requests = 0;
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: class {
    constructor() { workers++; throw Error("unexpected_vault_preload_worker"); }
  } });
  context.mock.method(defaultIdentityRepository, "active", async () => { identityReads++; return null; });
  context.mock.method(defaultIdentityRepository, "withKeyFile", async () => { exports++; throw Error("unexpected_vault_preload_export"); });
  context.mock.method(globalThis, "fetch", async () => { requests++; return Response.json({}, { status: 403 }); });
  try {
    await import("../src/features/play/WildsInventory");
    assert.deepEqual({ workers, identityReads, exports, requests }, { workers: 0, identityReads: 0, exports: 0, requests: 0 });
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "Worker", descriptor); else Reflect.deleteProperty(globalThis, "Worker");
  }
});
