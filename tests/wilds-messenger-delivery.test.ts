import assert from "node:assert/strict";
import { test } from "node:test";
import { assertWildsPrivateMessagePublished, retryWildsWalletMessageAfterAuthorityRefusal, wildsMessageRequestFailure, WildsMessageZeroWriteError } from "../src/features/play/wilds-messenger-delivery";

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

test("an expired Wallet grant renews once before retrying the same message", async () => {
  const body = JSON.stringify({ clientMessageId: "trade:retained", context: "exact offer" });
  const steps: string[] = [];
  const result = await retryWildsWalletMessageAfterAuthorityRefusal(async () => {
    steps.push(body);
    if (steps.length === 1) throw Error("receiz_wallet_authority_required");
    return "published";
  }, async () => {
    steps.push("renew");
    return true;
  });
  assert.deepEqual(steps, [body, "renew", body]);
  assert.equal(result, "published");
});

test("unknown, unresolved, or repeated refusals do not duplicate delivery", async () => {
  let deliveries = 0;
  let renewals = 0;
  const renew = async () => { renewals++; return true; };
  const send = (code: string) => async () => { deliveries++; throw Error(code); };
  await assert.rejects(retryWildsWalletMessageAfterAuthorityRefusal(send("connection_lost"), renew), /connection_lost/);
  assert.deepEqual({ deliveries, renewals }, { deliveries: 1, renewals: 0 });
  await assert.rejects(retryWildsWalletMessageAfterAuthorityRefusal(send("receiz_wallet_authority_required"), async () => false), /receiz_wallet_authority_required/);
  assert.deepEqual({ deliveries, renewals }, { deliveries: 2, renewals: 0 });
  await assert.rejects(retryWildsWalletMessageAfterAuthorityRefusal(send("wilds_wallet_bearer_identity_required"), renew), /wilds_wallet_bearer_identity_required/);
  assert.deepEqual({ deliveries, renewals }, { deliveries: 4, renewals: 1 });
});
