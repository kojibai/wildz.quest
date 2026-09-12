import assert from "node:assert/strict";
import { test } from "node:test";
import { walletAuthorizationFailureCode, WildsWalletAuthorizationError } from "../src/features/play/wallet/wilds-wallet-authorization-error";

test("wallet diagnostics preserve protocol rejection without exposing response bodies", () => {
  assert.equal(walletAuthorizationFailureCode({ error: "IDENTITY_NOT_BOUND", accessToken: "private" }), "IDENTITY_NOT_BOUND");
  for (const value of [null, "private", { error: "Bearer private" }, { error: { accessToken: "private" } }, { error: "x".repeat(100) }]) {
    assert.equal(walletAuthorizationFailureCode(value), "AUTHORIZATION_UNAVAILABLE");
  }
  const message = new WildsWalletAuthorizationError("IDENTITY_NOT_BOUND").message;
  assert.match(message, /remote account/);
  assert.match(message, /No transfer was submitted/);
  assert.match(message, /IDENTITY_NOT_BOUND/);
});
