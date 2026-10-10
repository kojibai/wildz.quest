import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletSendReadiness } from "../src/features/play/wallet/wilds-wallet-send-readiness";
test("Send readiness is lazy, coalesces the exact account and never refreshes a cancelled review", async () => {
  let state = { open: true, page: "send", identityKey: "alice", sourceKey: "key-alice", authorityGeneration: "session-alice" };
  let continueCalls = 0; let refreshed = 0; let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const ensure = createWildsWalletSendReadiness({ current: () => state, continueSession: async () => { continueCalls++; await wait; return true; }, refresh: async () => { refreshed++; } });
  assert.equal(continueCalls, 0, "constructing the helper performs no startup work");
  const first = ensure(); const second = ensure();
  assert.equal(first, second); assert.equal(continueCalls, 1);
  state = { ...state, page: "assets" };
  release(); assert.equal(await first, false); assert.equal(refreshed, 0);
  state = { ...state, page: "send", identityKey: "bob", sourceKey: "key-bob", authorityGeneration: "session-bob" };
  assert.equal(await ensure(), true); assert.equal(continueCalls, 2); assert.equal(refreshed, 1);
});
test("an identity switch while continuation is pending cannot refresh the new account", async () => {
  let state = { open: true, page: "send", identityKey: "alice", sourceKey: "key-alice", authorityGeneration: "a" };
  let release!: () => void; let refreshed = 0;
  const ensure = createWildsWalletSendReadiness({ current: () => state, continueSession: () => new Promise<boolean>(resolve => { release = () => resolve(true); }), refresh: async () => { refreshed++; } });
  const pending = ensure(); state = { ...state, identityKey: "bob", sourceKey: "key-bob" }; release();
  assert.equal(await pending, false); assert.equal(refreshed, 0);
});
test("a rejected continuation from a cancelled identity cannot publish an error into a later Send review", async () => {
  let state = { open: true, page: "send", identityKey: "alice", sourceKey: "key-alice", authorityGeneration: "a" };
  let reject!: (cause: Error) => void;
  const ensure = createWildsWalletSendReadiness({ current: () => state, continueSession: () => new Promise<boolean>((_resolve, fail) => { reject = fail; }), refresh: async () => assert.fail("cancelled continuation cannot refresh") });
  const pending = ensure(); state = { ...state, identityKey: "bob", sourceKey: "key-bob" };
  reject(Error("old Alice session expired"));
  assert.equal(await pending, false);
});
