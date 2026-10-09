import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletTerminal } from "../src/features/play/wallet/WildsWalletTerminal";
import { createWildsWalletControllerState } from "../src/features/play/wallet/wilds-wallet-controller";
import { initialPlayState } from "../src/features/play/game-state";
import { walletFoodFixture } from "./fixtures/wilds-wallet-food";
import { createWildsWalletAssetSendReview, type WildsWalletAssetSendSelection } from "../src/features/play/wallet/wilds-wallet-asset-send";

const actions = { onClose() {}, onNavigate() {}, onRefresh() {}, onLookupRecipient() {}, onSelectRecipient() {}, onReviewAmount() {}, onStage() {}, onAuthorizationPointerStart() {}, onAuthorizationPointerCancel() {}, onRecover() {}, onEditTransfer() {}, onResetTransfer() {}, onRequestReceive() {} };

test("wallet food and resource cards can be selected for a recipient-bound reviewed send", () => {
  const { nourishment } = walletFoodFixture();
  const props = { ...actions, cards: initialPlayState.inventory, nourishment,
    resourceCards: [{ id: "package:one", title: "Farm supplies", summary: "2 vegetables · 1 timber", status: "packed", transferable: true, unpackable: true, cancellable: false }],
    onSendAsset: async () => ({ status: "sent" as const, message: "Sent to @recipient · awaiting acceptance" }),
    publicUsername: "explorer", state: { ...createWildsWalletControllerState("explorer"), open: true, page: "assets" as const, status: "verified" as const } };
  const markup = renderToStaticMarkup(createElement(WildsWalletTerminal, props));
  assert.match(markup, /aria-label="Select Wild fruit for wallet send"/);
  assert.match(markup, /aria-label="Select Wild vegetables for wallet send"/);
  assert.match(markup, /aria-label="Select Ground bird meat for wallet send"/);
  assert.match(markup, /Farm supplies/);
  assert.match(markup, /aria-label="Select Farm supplies for wallet send"/);
  assert.match(markup, /aria-label="Wallet asset recipient"/);
  assert.match(markup, /Review send/);
  assert.doesNotMatch(markup, /Send selected Living Honey|Receiz username or email to send this card/);
});

test("asset review freezes the chosen whole food portions and normalized recipient before confirmation", () => {
  const ids = ["fruit:one", "fruit:two", "fruit:three"];
  const selection: WildsWalletAssetSendSelection = { id: "fruit", label: "Wild fruit", quantity: 3, adjustableQuantity: true,
    asset: { kind: "inventory", foodItemIds: ids, materialLotIds: [], resourceLotIds: [] } };
  const review = createWildsWalletAssetSendReview(selection, "@Recipient", 2, "wallet:attempt:one", "sender");
  ids[0] = "later:inventory";
  assert.deepEqual(review.request, { attemptId: "wallet:attempt:one", recipientHandle: "recipient.receiz.id",
    asset: { kind: "inventory", foodItemIds: ["fruit:one", "fruit:two"], materialLotIds: [], resourceLotIds: [] } });
  assert.equal(review.quantity, 2);
  assert.equal(Object.isFrozen(review.request), true);
  assert.equal(Object.isFrozen(review.request.asset), true);
  assert.equal(review.request.asset.kind === "inventory" && Object.isFrozen(review.request.asset.foodItemIds), true);
});

test("asset review rejects fractional, excess and self sends and keeps sealed resource lots whole", () => {
  const food: WildsWalletAssetSendSelection = { id: "fruit", label: "Wild fruit", quantity: 2, adjustableQuantity: true,
    asset: { kind: "inventory", foodItemIds: ["one", "two"], materialLotIds: [], resourceLotIds: [] } };
  for (const quantity of [0, 1.5, 3]) assert.throws(() => createWildsWalletAssetSendReview(food, "recipient", quantity, "attempt"), /whole quantity/);
  assert.throws(() => createWildsWalletAssetSendReview(food, "sender.receiz.id", 1, "attempt", "@sender"), /another user/);
  assert.throws(() => createWildsWalletAssetSendReview(food, "recipient@example.com", 1, "attempt"), /valid Receiz username/);
  const honey: WildsWalletAssetSendSelection = { id: "honey:lot", label: "Living Honey", quantity: 3,
    asset: { kind: "inventory", foodItemIds: [], materialLotIds: [], resourceLotIds: ["honey:lot"] } };
  assert.throws(() => createWildsWalletAssetSendReview(honey, "recipient", 1, "attempt"), /whole quantity/);
  assert.deepEqual(createWildsWalletAssetSendReview(honey, "recipient", 3, "attempt").request.asset,
    { kind: "inventory", foodItemIds: [], materialLotIds: [], resourceLotIds: ["honey:lot"] });
});
