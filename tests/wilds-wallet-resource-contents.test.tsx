import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as assets from "../src/features/play/wallet/WildsWalletAssets";
import { WildsWalletTerminal } from "../src/features/play/wallet/WildsWalletTerminal";
import { createWildsWalletControllerState } from "../src/features/play/wallet/wilds-wallet-controller";
import { countWildsWalletResourceInventory } from "../src/features/play/wallet/wilds-wallet-inventory";
import type { ExchangeCard } from "../src/features/play/WildsResourceExchange";

const received = { id: `wildz:package:${"a".repeat(64)}`, title: "Food and timber", summary: "2 berries · 1 timber", status: "Received", transferable: true, unpackable: true, cancellable: false, resourceUnits: 3 };
const actions = { onClose() {}, onNavigate() {}, onRefresh() {}, onLookupRecipient() {}, onSelectRecipient() {}, onReviewAmount() {}, onStage() {}, onAuthorizationPointerStart() {}, onAuthorizationPointerCancel() {}, onRecover() {}, onEditTransfer() {}, onResetTransfer() {}, onRequestReceive() {} };

test("packed source cards count actual units while unpacked/sent cards contribute zero", () => {
  assert.equal(countWildsWalletResourceInventory({ resourceLots: [], resourceCards: [received] }), 3);
  assert.equal(countWildsWalletResourceInventory({ resourceLots: [{ quantity: 2 }], resourceCards: [received, { ...received, id: "unpacked", resourceUnits: 0 }, { ...received, id: "sent", resourceUnits: 0 }] }), 5);
  assert.equal(countWildsWalletResourceInventory({ resourceLots: [], resourceCards: [{ resourceUnits: -1 }, { resourceUnits: 1.5 }, { resourceUnits: Number.NaN }] }), 0);
  assert.equal(countWildsWalletResourceInventory({ resourceLots: [], resourceCards: [{ id: "legacy-one-unit" }] }), 1);
});

test("Assets exposes explicit Use contents and Refresh contents without invoking source work on render", () => {
  let calls = 0;
  const props = { ...actions, publicUsername: "bob", state: { ...createWildsWalletControllerState("bob"), open: true, page: "assets" as const }, resourceCards: [received, { ...received, id: "unpacked", title: "Unpacked berries", status: "Contents unpacked", transferable: false, resourceUnits: 0, unpackLabel: "Refresh contents" as const }, { ...received, id: "reserved", title: "Reserved package", unpackable: false }], onUnpackResourceCard: async () => { calls++; } };
  const html = renderToStaticMarkup(createElement(WildsWalletTerminal, props));
  assert.match(html, />Use contents<\/button>/); assert.match(html, />Refresh contents<\/button>/);
  assert.match(html, /aria-label="Use contents of Food and timber"/); assert.match(html, /aria-label="Refresh contents of Unpacked berries"/);
  assert.equal((html.match(/contents of /g) ?? []).length, 2); assert.equal(calls, 0);
  const unsupported = renderToStaticMarkup(createElement(WildsWalletTerminal, { ...props, onUnpackResourceCard: undefined }));
  assert.doesNotMatch(unsupported, />Use contents<\/button>/);
});

test("contents action serializes duplicate clicks and uses the exact selected package only", async () => {
  assert.equal(typeof assets.createWildsWalletResourceContentsRuntime, "function");
  const ids: string[] = [], states: { busyId: string | null; message: string; error: boolean }[] = [];
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const runtime = assets.createWildsWalletResourceContentsRuntime({ onUnpackResourceCard: async id => { ids.push(id); await gate; }, onChange: state => states.push(state) });
  assert.equal(states.length, 0);
  const first = runtime.unpack(received as ExchangeCard); await runtime.unpack({ ...received, id: "different-package" });
  assert.deepEqual(ids, [received.id]); assert.equal(states[0]!.busyId, received.id);
  finish(); await first; assert.equal(states.at(-1)!.busyId, null); assert.equal(states.at(-1)!.error, false);
});

test("source rejection is shown as an error and leaves the same package available for explicit retry", async () => {
  const states: { busyId: string | null; message: string; error: boolean }[] = []; let attempts = 0;
  const runtime = assets.createWildsWalletResourceContentsRuntime({ onUnpackResourceCard: async () => { attempts++; if (attempts === 1) throw Error("Current SDK source unavailable · retry this package"); }, onChange: state => states.push(state) });
  await runtime.unpack(received); assert.equal(states.at(-1)!.error, true); assert.match(states.at(-1)!.message, /SDK source unavailable/); assert.equal(states.at(-1)!.busyId, null);
  await runtime.unpack(received); assert.equal(attempts, 2); assert.equal(states.at(-1)!.error, false);
  await runtime.unpack({ ...received, unpackable: false }); assert.equal(attempts, 2);
});
