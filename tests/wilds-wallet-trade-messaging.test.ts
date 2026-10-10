import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade.js";
import { validateWildsWalletTradeMessage, wildsWalletTradeMessageId } from "../src/features/play/wallet/wilds-wallet-trade-messaging.js";
import { appendWildsDirectMessage } from "../src/features/play/wilds-messenger-ledger.js";

const alice = {id: "trade-test:alice", handle: "tradealice.receiz.id"};
const bob = {id: "trade-test:bob", handle: "tradebob.receiz.id"};
const offer = {kind: "trade-package" as const, stage: "offer" as const, draft: createWildsWalletTradeDraft({
  attemptId: "trade:private:offer", recipient: bob.handle, selfHandle: alice.handle, phiMicro: "1250000",
  requestedPhiMicro: "0", requestNote: "Living Honey", selections: []
})};
const counter = {kind: "trade-package" as const, stage: "counteroffer" as const,
  draft: createWildsWalletTradeDraft({attemptId: "trade:private:counter", recipient: alice.handle, selfHandle: bob.handle,
    phiMicro: "0", requestedPhiMicro: "1250000", requestNote: "", selections: [{selection: {
      id: "honey", label: "Living Honey", quantity: 1, asset: {kind: "inventory", foodItemIds: [], materialLotIds: [], resourceLotIds: ["honey:lot:one"]}
    }, quantity: 1}]}), inReplyTo: {senderHandle: alice.handle, draft: offer.draft}};

it("binds counteroffers to an actual earlier private offer and replays one exact attempt", () => {
  assert.throws(() => appendWildsDirectMessage({sender: bob, recipient: alice, body: "Counteroffer", clientMessageId: wildsWalletTradeMessageId(bob.handle, counter), context: counter}), /wilds_wallet_trade_original_offer_required/);
  const first = appendWildsDirectMessage({sender: alice, recipient: bob, body: "Trade offer", clientMessageId: wildsWalletTradeMessageId(alice.handle, offer), context: offer});
  const replay = appendWildsDirectMessage({sender: alice, recipient: bob, body: "Trade offer", clientMessageId: wildsWalletTradeMessageId(alice.handle, offer), context: offer});
  assert.equal(replay.message.id, first.message.id);
  const reply = appendWildsDirectMessage({sender: bob, recipient: alice, body: "Counteroffer", clientMessageId: wildsWalletTradeMessageId(bob.handle, counter), context: counter});
  assert.equal(reply.conversation.messages.length, 2);
  assert.equal(reply.message.context?.kind, "trade-package");
  assert.throws(() => appendWildsDirectMessage({sender: alice, recipient: bob, body: "Trade offer", clientMessageId: wildsWalletTradeMessageId(alice.handle, offer), context: {...offer, draft: {...offer.draft, offered: {...offer.draft.offered, phiMicro: "2500000"}}}}), /idempotency_conflict/);
  assert.throws(() => appendWildsDirectMessage({sender: bob, recipient: alice, body: "Counteroffer", clientMessageId: wildsWalletTradeMessageId(bob.handle, counter), context: {...counter, inReplyTo: {...counter.inReplyTo, draft: {...offer.draft, requestNote: "Foundation Stone"}}}}), /wilds_wallet_trade_original_offer_required/);
});

it("rejects changed trade peers, extra transport fields, and invalid message identity", () => {
  assert.throws(() => validateWildsWalletTradeMessage(offer, alice.handle, "stranger.receiz.id"), /recipient_invalid/);
  assert.throws(() => validateWildsWalletTradeMessage({...offer, approved: true}, alice.handle, bob.handle), /message_invalid/);
  assert.throws(() => validateWildsWalletTradeMessage(counter, alice.handle, bob.handle), /Choose another|recipient_invalid/);
  assert.throws(() => appendWildsDirectMessage({sender: alice, recipient: bob, body: "Trade offer", clientMessageId: "wrong-attempt", context: offer}), /wilds_wallet_trade_message_invalid/);
});
