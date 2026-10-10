import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletTradeDraft, wildsWalletTradeDraftDigest } from "../src/features/play/wallet/wilds-wallet-trade";

const fruit = { id: "fruit", label: "Wild fruit", quantity: 3, adjustableQuantity: true, asset: { kind: "inventory" as const, foodItemIds: ["fruit:1", "fruit:2", "fruit:3"], materialLotIds: [], resourceLotIds: [] } };
const creature = { id: "creature:a", label: "Mosswing", quantity: 1, asset: { kind: "creature" as const, assetId: "creature:a" } };
const base = { attemptId: "wallet:trade:1", recipient: "@bob", selfHandle: "alice", phiMicro: "1000001", requestedPhiMicro: "500000", requestNote: "Foundation stone", selections: [{ selection: fruit, quantity: 2 }, { selection: creature, quantity: 1 }] };

test("trade review freezes mixed package exact units and micro-PHI without reserving sources", () => {
  const draft = createWildsWalletTradeDraft(base);
  assert.equal(draft.recipientHandle, "bob.receiz.id");
  assert.equal(draft.offered.phiMicro, "1000001");
  assert.deepEqual(draft.offered.assets, [{ kind: "inventory", foodItemIds: ["fruit:1", "fruit:2"], materialLotIds: [], resourceLotIds: [] }, { kind: "creature", assetId: "creature:a" }]);
  assert.equal(fruit.asset.foodItemIds.length, 3);
  assert.ok(Object.isFrozen(draft.offered.assets));
  assert.ok(Object.isFrozen(draft.offered.assets[0]));
  assert.notEqual(wildsWalletTradeDraftDigest(draft), wildsWalletTradeDraftDigest(createWildsWalletTradeDraft({ ...base, phiMicro: "1000002" })));
});

test("trade drafting rejects overlapping source units, self sends and invalid exact amounts", () => {
  assert.throws(() => createWildsWalletTradeDraft({ ...base, selections: [{ selection: fruit, quantity: 2 }, { selection: fruit, quantity: 1 }] }), /distinct/);
  assert.throws(() => createWildsWalletTradeDraft({ ...base, recipient: "alice.receiz.id" }), /another/);
  assert.throws(() => createWildsWalletTradeDraft({ ...base, phiMicro: "1.5" }), /exact/);
  assert.throws(() => createWildsWalletTradeDraft({ ...base, selections: [], phiMicro: "0" }), /Add/);
  assert.throws(() => createWildsWalletTradeDraft({ ...base, requestedPhiMicro: "0", requestNote: "" }), /exchange/);
});

test("trade drafting binds the same attempt to exact recipient, quantity and requested consideration", () => {
  const draft = createWildsWalletTradeDraft(base);
  for (const update of [{ recipient: "carol" }, { requestedPhiMicro: "500001" }, { requestNote: "Living Honey" }, { selections: [{ selection: fruit, quantity: 1 }] }]) {
    assert.notEqual(wildsWalletTradeDraftDigest(draft), wildsWalletTradeDraftDigest(createWildsWalletTradeDraft({ ...base, ...update })));
  }
  assert.throws(() => createWildsWalletTradeDraft({ ...base, requestNote: "a\u0000b" }), /500/);
});
