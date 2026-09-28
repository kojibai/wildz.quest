import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMessagePushSubscription, pushEndpointId } from "../src/lib/receiz/wilds-message-push";

const keys = { p256dh: Buffer.alloc(65, 4).toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") };

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
