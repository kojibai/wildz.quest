import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletReceiveCoordinate, encodeWildsWalletReceiveCoordinate, parseWildsWalletReceiveCoordinate } from "../src/features/play/wallet/wilds-wallet-coordinate";

const locator = `wildz:receive:v1.${"a".repeat(16)}.${"b".repeat(32)}.${"c".repeat(22)}`;

test("receiving QR round-trips the sealed source locator and optional exact Phi request", () => {
  const coordinate = createWildsWalletReceiveCoordinate({ recipientUsername: "@bjklock", recipientLocator: locator, amountPhiMicro: "2500000" });
  assert.deepEqual(parseWildsWalletReceiveCoordinate(encodeWildsWalletReceiveCoordinate(coordinate)), {
    schema: "receiz.wildz.wallet.receive-coordinate.v1",
    recipientUsername: "bjklock",
    recipientLocator: locator,
    amountPhiMicro: "2500000"
  });
});

test("receiving QR rejects foreign shapes, plaintext identities, and zero requests", () => {
  assert.throws(() => parseWildsWalletReceiveCoordinate(JSON.stringify({ schema: "foreign", recipientUsername: "bjklock", recipientLocator: locator })), /invalid/);
  assert.throws(() => createWildsWalletReceiveCoordinate({ recipientUsername: "bjklock", recipientLocator: "wildz:receive:bjklock" }), /invalid/);
  assert.throws(() => createWildsWalletReceiveCoordinate({ recipientUsername: "bjklock", recipientLocator: locator, amountPhiMicro: "0" }), /invalid/);
});
