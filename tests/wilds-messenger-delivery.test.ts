import assert from "node:assert/strict";
import { test } from "node:test";
import { assertWildsPrivateMessagePublished, wildsMessageRequestFailure, WildsMessageZeroWriteError } from "../src/features/play/wilds-messenger-delivery";

test("wallet claim delivery requires admitted private publication", () => {
  for (const publication of [undefined, { published: false, mode: "sync_pending" }, { published: true, mode: "local_practice" }, { published: true }]) {
    assert.throws(() => assertWildsPrivateMessagePublished(publication), /private_delivery_pending/);
  }
  assert.doesNotThrow(() => assertWildsPrivateMessagePublished({ published: true, mode: "receiz_synced" }));
});

test("only a server-confirmed zero-write failure releases an uncertain send", () => {
  const rejected = wildsMessageRequestFailure({ error: "receiz_recipient_binding_unavailable", writesOnFailure: 0 });
  assert.ok(rejected instanceof WildsMessageZeroWriteError);
  assert.match(rejected.message, /recipient identity is unavailable/i);
  assert.equal(wildsMessageRequestFailure({ error: "connection_lost" }) instanceof WildsMessageZeroWriteError, false);
  assert.equal(wildsMessageRequestFailure({ writesOnFailure: "0" }) instanceof WildsMessageZeroWriteError, false);
});
