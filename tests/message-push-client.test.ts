import assert from "node:assert/strict";
import { test } from "node:test";
import { registerMessagePush, readMessagePushConfig } from "../src/features/pwa/message-push-client";

function browser(events: string[]) {
  const names = ["window", "navigator", "Notification"] as const;
  const descriptors = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { Notification: {}, PushManager: {} } });
  Object.defineProperty(globalThis, "Notification", { configurable: true, value: { permission: "default", requestPermission: async () => { events.push("permission"); return "granted"; } } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { serviceWorker: { ready: Promise.resolve({ pushManager: {
    getSubscription: async () => null,
    subscribe: async () => { events.push("subscribe"); return { toJSON: () => ({ endpoint: "https://web.push.apple.com/fixture" }) }; }
  } }) } } });
  return () => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
}

test("an unavailable backend never requests notification permission", async () => {
  const events: string[] = [];
  const restore = browser(events);
  try {
    await assert.rejects(registerMessagePush(true, { configured: false, publicKey: null }), /temporarily unavailable/);
    assert.deepEqual(events, []);
  } finally { restore(); }
});

test("ready push requests permission directly from the tap and persists the subscription", async (context) => {
  const events: string[] = [];
  const restore = browser(events);
  context.mock.method(globalThis, "fetch", async () => { events.push("save"); return Response.json({ ok: true }); });
  try {
    await registerMessagePush(true, { configured: true, publicKey: "AQID" });
    assert.deepEqual(events, ["permission", "subscribe", "save"]);
  } finally { restore(); }
});

test("a failed subscription save cannot report notifications enabled", async (context) => {
  const restore = browser([]);
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: "storage_failed" }, { status: 503 }));
  try { await assert.rejects(registerMessagePush(true, { configured: true, publicKey: "AQID" }), /Could not enable/); }
  finally { restore(); }
});

test("configuration without a public key cannot enable push", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ configured: true, publicKey: null }));
  assert.deepEqual(await readMessagePushConfig(), { configured: false, publicKey: null });
});
