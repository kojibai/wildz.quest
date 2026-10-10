import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletTradeAgreement, createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { createWildsWalletStagedTradePlan, wildsWalletStagedTradeApprovalChallenge } from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
const path = "../src/features/market/wildz-market-purchase-terms-v128.js";
const quote = { schema: "wildz.market.connect-quote.v128", ownerHandle: "alice.receiz.id", priceUsdCents: "125", amountPhiMicro: "500000", usdPerPhiMicrocents: "250000000", basisDigest: "a".repeat(64), issuedAtKai: 100, expiresAtKai: 220 };
const basis = { schema: "wildz.market.purchase-terms.v128", listingId: "market:listing:one", listingHead: "b".repeat(64), reservationId: "market:reservation:one", reservationHead: "c".repeat(64), buyerHandle: "alice.receiz.id", sellerHandle: "bob.receiz.id", sourceDigest: "d".repeat(64), asset: { kind: "creature", assetId: "creature:one" }, quote };

test("market full-plan approvals bind real USD quote, named reservation, source and exact Phi before any stage", async () => {
  const marketModule = await import(path).catch(() => ({}));
  assert.equal(typeof marketModule.createWildzMarketPurchaseAgreementV128, "function");
  const agreement = marketModule.createWildzMarketPurchaseAgreementV128(basis);
  const plan = createWildsWalletStagedTradePlan(agreement);
  assert.deepEqual(plan.legs.map(leg => [leg.kind, leg.senderHandle, leg.recipientHandle]), [["phi", "alice.receiz.id", "bob.receiz.id"], ["asset", "bob.receiz.id", "alice.receiz.id"]]);
  assert.equal(plan.agreement.purpose, "market");
  assert.ok(plan.agreement.market);
  assert.equal(plan.agreement.market.quote.priceUsdCents, "125");
  const binding = { ownerHandle: "alice.receiz.id", keyId: "key:alice", identityArtifactDigest: "e".repeat(64), sourceHeads: [] };
  const original = wildsWalletStagedTradeApprovalChallenge(plan, binding);
  const changed = createWildsWalletStagedTradePlan(marketModule.createWildzMarketPurchaseAgreementV128({ ...basis, reservationHead: "f".repeat(64) }));
  assert.notEqual(wildsWalletStagedTradeApprovalChallenge(changed, binding).approvalId, original.approvalId);
  assert.notEqual(changed.tradeId, plan.tradeId);
});

test("changing buyer, source or quoted amount in a frozen market plan is rejected instead of reinterpreted as a generic trade", async () => {
  const marketModule = await import(path);
  const agreement = marketModule.createWildzMarketPurchaseAgreementV128(basis);
  for (const market of [{ ...agreement.market, buyerHandle: "mallory.receiz.id" }, { ...agreement.market, sourceDigest: "f".repeat(64) }, { ...agreement.market, quote: { ...quote, amountPhiMicro: "1" } }]) {
    assert.throws(() => createWildsWalletStagedTradePlan({ ...agreement, market }));
  }
  assert.throws(() => createWildsWalletStagedTradePlan({ ...agreement, purpose: undefined }));
});

test("normal staged trade approval and plan bytes stay free of new market fields", () => {
  const draft = (sender: string, recipient: string) => createWildsWalletTradeDraft({ attemptId: sender, selfHandle: sender, recipient, phiMicro: "10", requestedPhiMicro: "1", requestNote: "Existing exchange", selections: [] });
  const plan = createWildsWalletStagedTradePlan(createWildsWalletTradeAgreement({ senderHandle: "alice", draft: draft("alice", "bob") }, { senderHandle: "bob", draft: draft("bob", "alice") }));
  assert.equal(Object.hasOwn(plan.agreement, "purpose"), false);
  assert.equal(Object.hasOwn(plan.agreement, "market"), false);
});

test("generic wallet adapter refuses market execution before enrollment or Send readiness", async () => {
  const marketModule = await import(path);
  const { createWildsWalletStagedTradeAdapter } = await import("../src/features/play/wallet/wilds-wallet-staged-trade-adapter");
  let readiness = 0;
  const unavailable = async () => { throw Error("This dependency must never run for a generic market agreement."); };
  const adapter = createWildsWalletStagedTradeAdapter({ keyId: "e".repeat(64), ownerHandle: "alice.receiz.id", currentIdentity: () => ({ keyId: "e".repeat(64), ownerHandle: "alice.receiz.id" }),
    sendWalletAsset: unavailable, assetPort: { prepareSource: unavailable, sendSource: unavailable, observeSource: unavailable, verifyAccepted: unavailable }, readConversations: unavailable, publish: unavailable,
    ensureReady: async () => { readiness++; return false; } });
  const agreement = marketModule.createWildzMarketPurchaseAgreementV128(basis);
  assert.equal((await adapter.approve(agreement)).status, "failed");
  assert.equal((await adapter.resume(agreement)).status, "failed");
  assert.equal(readiness, 0, "a market approval may not fall through normal wallet execution");
});
