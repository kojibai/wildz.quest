import assert from "node:assert/strict";
import { test } from "node:test";
import { messagePushConfigured, parseMessagePushSubscription, pushEndpointId, pushRedis } from "../src/lib/receiz/wilds-message-push";

const keys = { p256dh: Buffer.alloc(65, 4).toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") };

test("push storage uses connected Vercel Redis credentials without duplicated env vars", async () => {
  const names = ["WILDS_PUSH_REDIS_URL", "WILDS_PUSH_REDIS_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "WILDS_PUSH_VAPID_PUBLIC_KEY", "WILDS_PUSH_VAPID_PRIVATE_KEY", "WILDS_PUSH_VAPID_SUBJECT"];
  const previous = names.map((name) => process.env[name]);
  const previousFetch = globalThis.fetch;
  try {
    delete process.env.WILDS_PUSH_REDIS_URL;
    delete process.env.WILDS_PUSH_REDIS_TOKEN;
    process.env.KV_REST_API_URL = "https://redis.example.test";
    process.env.KV_REST_API_TOKEN = "fixture-token";
    process.env.WILDS_PUSH_VAPID_PUBLIC_KEY = "fixture-public-key";
    process.env.WILDS_PUSH_VAPID_PRIVATE_KEY = "fixture-private-key";
    process.env.WILDS_PUSH_VAPID_SUBJECT = "https://wildz.quest";
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "https://redis.example.test");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-token");
      assert.equal(init?.body, '["PING"]');
      return Response.json({ result: "PONG" });
    };
    assert.equal(messagePushConfigured(), true);
    assert.equal(await pushRedis(["PING"]), "PONG");
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    globalThis.fetch = previousFetch;
  }
});

test("push subscriptions accept browser providers and strip extra client fields", () => {
  for (const endpoint of ["https://fcm.googleapis.com/fcm/send/token", "https://web.push.apple.com/token", "https://updates.push.services.mozilla.com/wpush/v2/token", "https://wns2.notify.windows.com/token"]) {
    assert.deepEqual(parseMessagePushSubscription({ endpoint, keys, actorId: "someone-else" }), { endpoint, keys });
    assert.equal(pushEndpointId(endpoint).length, 64);
  }
});

test("push subscriptions reject private hosts, provider lookalikes and malformed keys", () => {
  for (const endpoint of ["http://fcm.googleapis.com/token", "https://localhost/token", "https://127.0.0.1/token", "https://fcm.googleapis.com.attacker.test/token", "https://fcm.googleapis.com:8443/token", "https://user:password@web.push.apple.com/token"]) {
    assert.throws(() => parseMessagePushSubscription({ endpoint, keys }), /invalid/);
  }
  assert.throws(() => parseMessagePushSubscription({ endpoint: "https://web.push.apple.com/token", keys: { ...keys, auth: "bad" } }), /invalid/);
});
