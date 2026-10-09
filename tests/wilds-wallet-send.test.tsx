import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WildsWalletSend } from "../src/features/play/wallet/WildsWalletSend";
import { createWildsWalletControllerDriver } from "../src/features/play/wallet/wilds-wallet-controller-driver";
import { createWildsWalletSessionCache, gateWildsWalletClientCapabilities, reduceWildsWalletController, type WildsWalletTransferState } from "../src/features/play/wallet/wilds-wallet-controller";
import { projectWildsWalletCapabilities } from "../src/lib/receiz/wilds-wallet-projections";
import { wildsWalletBrowserTransferRecoveryStore } from "../src/features/play/wallet/wilds-wallet-transfer-recovery";

type Consent = Readonly<{ artifact: unknown; challenge: unknown }>;
function transferDriver(fetcher?: Parameters<typeof createWildsWalletControllerDriver>[0]["fetcher"], options: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const records = new Map<string, unknown>();
  const driver = createWildsWalletControllerDriver({ identityKey: "sender", authorityGeneration: "one", cache: createWildsWalletSessionCache(1), publish() {},
    recoveryStore: { load: identity => records.get(identity), write: (identity, value) => { records.set(identity, JSON.parse(JSON.stringify(value))); }, delete: identity => { records.delete(identity); } },
    fetcher: fetcher ?? (async path => {
      calls.push(path);
      return { ok: true, status: 200, json: async () => path.endsWith("/preview")
        ? { status: "staged", rail: "settlement", amountPhiMicro: "1", quotedUsdCents: "0", attempt: "v2.exact-attempt", expiresAtKai: 999 }
        : path.endsWith("/execute") ? { status: "unknown", rail: "settlement", amountPhiMicro: "1" }
        : path.endsWith("summary") ? { status: "verified", admittedPhiMicro: "1000000", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null }
        : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : { cursor: null, nextCursor: null, entries: [] } };
    }), ...options
  });
  driver.open();
  return { driver, calls };
}
async function stage(driver: ReturnType<typeof transferDriver>["driver"]) {
  driver.selectTransferRecipient("friend");
  driver.reviewTransferAmount("settlement", "1", "nonce-one");
  await driver.stageTransfer();
  driver.authorizationPointerStart(7);
}
function signer(driver: ReturnType<typeof transferDriver>["driver"]) {
  const candidate = driver as typeof driver & { signAndAuthorizeTransfer(pointerId: number, authorize: (transfer: WildsWalletTransferState) => Promise<Consent>): Promise<void> };
  assert.equal(typeof candidate.signAndAuthorizeTransfer, "function", "completed consent must latch before asynchronous signing");
  return candidate.signAndAuthorizeTransfer;
}

test("Send advances an exact username when optional public lookup is unavailable", async () => {
  const { driver } = transferDriver(async () => ({ ok: false, status: 503, json: async () => ({ error: "receiz_wallet_recipient_lookup_unavailable" }) }));
  await driver.lookupRecipient("@Friend.RECEIZ.ID");
  assert.equal(driver.state.transfer.phase, "amount");
  assert.equal(driver.state.transfer.recipientUsername, "friend");
  assert.equal(driver.state.recipient.status, "unavailable");
});

test("Send skips an unavailable lookup capability without waiting for source archive projection", async () => {
  const { driver, calls } = transferDriver();
  await driver.refresh();
  assert.equal(driver.state.sourceAuthorityVerified, false);
  calls.length = 0;
  await driver.lookupRecipient("@Friend.RECEIZ.ID");
  assert.equal(driver.state.transfer.phase, "amount");
  assert.equal(driver.state.transfer.recipientUsername, "friend");
  assert.deepEqual(calls, []);
});

test("releasing a completed gesture while identity signs cannot discard consent or submit twice", async () => {
  const { driver, calls } = transferDriver();
  await stage(driver);
  let release!: (consent: Consent) => void;
  let signatures = 0;
  const sign = signer(driver);
  const authorize = async () => { signatures++; return new Promise<Consent>(resolve => { release = resolve; }); };
  const sending = sign(7, authorize);
  assert.equal(driver.state.transfer.phase, "signing");
  driver.authorizationPointerCancel(7);
  assert.equal(sign(7, authorize), sending);
  assert.equal(signatures, 1);
  release({ artifact: "signed", challenge: {} });
  await sending;
  assert.equal(driver.state.transfer.phase, "unknown");
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 1);
});

test("failed identity signing retries the same reviewed attempt without executing a transfer", async () => {
  const { driver, calls } = transferDriver();
  await stage(driver);
  const sign = signer(driver);
  await assert.rejects(sign(7, async () => { throw new Error("signing unavailable"); }), /signing unavailable/);
  assert.equal(driver.state.transfer.phase, "authorize");
  assert.equal(driver.state.transfer.attempt, "v2.exact-attempt");
  assert.equal(driver.state.transfer.authorizationPointerId, null);
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
  driver.authorizationPointerStart(8);
  await sign(8, async () => ({ artifact: "signed", challenge: {} }));
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 1);
});

test("closing during signing retires a late signature without sending or claiming an uncertain payment", async () => {
  const { driver, calls } = transferDriver();
  await stage(driver);
  let release!: (consent: Consent) => void;
  const sending = signer(driver)(7, async () => new Promise(resolve => { release = resolve; }));
  driver.close();
  release({ artifact: "signed", challenge: {} });
  await sending;
  assert.equal(driver.state.transfer.phase, "authorize");
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
});

test("a late cancelled signature cannot join a newly confirmed gesture for the same reviewed attempt", async () => {
  const { driver, calls } = transferDriver();
  await stage(driver);
  let releaseOld!: (consent: Consent) => void;
  let releaseNew!: (consent: Consent) => void;
  const sign = signer(driver);
  const oldSigning = sign(7, async () => new Promise(resolve => { releaseOld = resolve; }));
  driver.close(); driver.open(); driver.authorizationPointerStart(7);
  const newSigning = sign(7, async () => new Promise(resolve => { releaseNew = resolve; }));
  releaseOld({ artifact: "old-signature", challenge: {} }); await oldSigning;
  assert.equal(driver.state.transfer.phase, "signing");
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
  releaseNew({ artifact: "current-signature", challenge: {} }); await newSigning;
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 1);
});

test("stalled local signing releases the review for retry without executing any funds", async () => {
  const { driver, calls } = transferDriver(undefined, { authorizationTimeoutMs: 15 });
  await stage(driver);
  const sending = signer(driver)(7, async () => new Promise(() => {})).catch(cause => cause);
  await Promise.race([sending, new Promise(resolve => setTimeout(resolve, 100))]);
  assert.equal(driver.state.transfer.phase, "authorize");
  assert.equal(driver.state.transfer.attempt, "v2.exact-attempt");
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
  driver.close();
});

test("uncertain payment cannot be replaced by recipient selection or a new amount", async () => {
  const { driver } = transferDriver();
  await stage(driver);
  await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  const pending = driver.state.transfer;
  driver.selectTransferRecipient("different");
  driver.reviewTransferAmount("settlement", "2000000", "nonce-two");
  assert.deepEqual(driver.state.transfer, pending);
});

test("review confirms the exact amount and recipient with a direct Send action", () => {
  const { driver } = transferDriver();
  const markup = renderToStaticMarkup(<WildsWalletSend state={{ ...driver.state, status: "verified", capabilities: gateWildsWalletClientCapabilities(projectWildsWalletCapabilities(), { proofAuthorization: true }), transfer: { ...driver.state.transfer, phase: "authorize", recipientUsername: "friend", amountPhiMicro: "1", rail: "settlement", attempt: "v2.exact" } }}
    onLookupRecipient={() => {}} onSelectRecipient={() => {}} onReviewAmount={() => {}} onStage={() => {}} onAuthorizationPointerStart={() => {}} onAuthorizationPointerCancel={() => {}} onAuthorize={() => {}} onRecover={() => {}} onEditTransfer={() => {}} onResetTransfer={() => {}} />);
  assert.match(markup, /@friend/);
  assert.match(markup, /0\.000001/);
  assert.match(markup, />Confirm send</);
  assert.doesNotMatch(markup, /Hold to|proof object|SOURCE-ISSUED/);
});

test("amount entry rejects more than the current available balance before preparation", () => {
  const { driver } = transferDriver();
  const markup = renderToStaticMarkup(<WildsWalletSend state={{ ...driver.state, status: "verified", balanceBasis: "current", summary: { status: "verified", admittedPhiMicro: "1", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null }, capabilities: gateWildsWalletClientCapabilities(projectWildsWalletCapabilities(), { proofAuthorization: true }), transfer: { ...driver.state.transfer, phase: "amount", recipientUsername: "friend", amountPhiMicro: "2" } }}
    onLookupRecipient={() => {}} onSelectRecipient={() => {}} onReviewAmount={() => {}} onStage={() => {}} onAuthorizationPointerStart={() => {}} onAuthorizationPointerCancel={() => {}} onAuthorize={() => {}} onRecover={() => {}} onEditTransfer={() => {}} onResetTransfer={() => {}} />);
  assert.match(markup, /exceeds your available PHI/);
  assert.match(markup, /disabled=""[^>]*>Review payment/);
});

test("successful payment displays its exact recipient and amount", () => {
  const { driver } = transferDriver();
  const markup = renderToStaticMarkup(<WildsWalletSend state={{ ...driver.state, transfer: { ...driver.state.transfer, phase: "committed", recipientUsername: "friend", amountPhiMicro: "1", rail: "settlement", result: { status: "committed", rail: "settlement", amountPhiMicro: "1" } } }}
    onLookupRecipient={() => {}} onSelectRecipient={() => {}} onReviewAmount={() => {}} onStage={() => {}} onAuthorizationPointerStart={() => {}} onAuthorizationPointerCancel={() => {}} onAuthorize={() => {}} onRecover={() => {}} onEditTransfer={() => {}} onResetTransfer={() => {}} />);
  assert.match(markup, /Payment sent/);
  assert.match(markup, /@friend/);
  assert.match(markup, /0\.000001/);
});

test("a crossed preparation amount returns to review instead of leaving the payment stuck", async () => {
  const { driver } = transferDriver(async () => ({ ok: true, status: 200, json: async () => ({ status: "staged", rail: "settlement", amountPhiMicro: "2", quotedUsdCents: "0", attempt: "v2.crossed", expiresAtKai: 999 }) }));
  driver.selectTransferRecipient("friend"); driver.reviewTransferAmount("settlement", "1", "nonce-one");
  await driver.stageTransfer();
  assert.equal(driver.state.transfer.phase, "review");
  assert.equal(driver.state.transfer.amountPhiMicro, "1");
  assert.ok(driver.state.transfer.preparationError);
});

test("read-authority expiry retains the exact uncertain payment for status recovery", async () => {
  const { driver } = transferDriver();
  await stage(driver);
  await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  const pending = driver.state.transfer;
  driver.setAuthority("sender", "renewed");
  assert.equal(driver.state.transfer.phase, "unknown");
  assert.equal(driver.state.transfer.attempt, pending.attempt);
  assert.equal(driver.state.transfer.operationNonce, pending.operationNonce);
  driver.selectTransferRecipient("different");
  assert.equal(driver.state.transfer.recipientUsername, "friend");
});

test("stalled preparation becomes retryable and retains the same semantic operation nonce", async () => {
  const driver = createWildsWalletControllerDriver({ identityKey: "sender", authorityGeneration: "one", cache: createWildsWalletSessionCache(1), publish() {},
    ...{ transferTimeoutMs: 15 }, fetcher: async () => new Promise(() => {}) });
  driver.open(); driver.selectTransferRecipient("friend"); driver.reviewTransferAmount("settlement", "1", "nonce-one");
  await Promise.race([driver.stageTransfer(), new Promise(resolve => setTimeout(resolve, 100))]);
  assert.equal(driver.state.transfer.phase, "review");
  assert.equal(driver.state.transfer.operationNonce, "nonce-one");
  assert.ok(driver.state.transfer.preparationError);
  driver.close();
});

test("remounting after uncertain delivery restores only this user's exact payment for read-only recovery", async () => {
  const saved = new Map<string, unknown>();
  const recoveryStore = { load: (identity: string) => saved.get(identity), write: (identity: string, value: unknown) => { saved.set(identity, value); }, delete: (identity: string) => { saved.delete(identity); } };
  const first = transferDriver(undefined, { recoveryStore, sourceKey: "sealed-source-one" });
  await stage(first.driver);
  await first.driver.authorizeTransfer(7, { artifact: "private-signature-artifact", challenge: { privateChallenge: "secret" } });
  const retained = first.driver.state.transfer;
  first.driver.dispose();
  assert.doesNotMatch(JSON.stringify([...saved.values()]), /private-signature-artifact|privateChallenge|secret/);
  const remounted = transferDriver(undefined, { recoveryStore, authorityGeneration: "renewed", sourceKey: "sealed-source-one" });
  assert.equal(remounted.driver.state.transfer.phase, "unknown");
  assert.equal(remounted.driver.state.transfer.attempt, retained.attempt);
  assert.equal(remounted.driver.state.transfer.operationNonce, retained.operationNonce);
  assert.equal(remounted.driver.state.transfer.recipientUsername, "friend");
  await remounted.driver.recoverTransfer();
  assert.equal(remounted.calls.filter(path => path.endsWith("/execute") || path.endsWith("/preview")).length, 0);
  const other = transferDriver(undefined, { recoveryStore, identityKey: "different-user" });
  assert.equal(other.driver.state.transfer.phase, "recipient");
});

test("a confirmed terminal outcome retires the persisted attempt instead of resurrecting it", async () => {
  const saved = new Map<string, unknown>();
  const recoveryStore = { load: (identity: string) => saved.get(identity), write: (identity: string, value: unknown) => { saved.set(identity, value); }, delete: (identity: string) => { saved.delete(identity); } };
  const first = transferDriver(undefined, { recoveryStore });
  await stage(first.driver); await first.driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  assert.ok(saved.has("sender"));
  const recovered = transferDriver(async path => ({ ok: true, status: 200, json: async () => path.includes("/status?")
    ? { status: "committed", rail: "settlement", amountPhiMicro: "1", recipientUsername: "friend" }
    : path.endsWith("summary") ? { status: "verified", admittedPhiMicro: "999999", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null }
      : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : { cursor: null, nextCursor: null, entries: [] } }), { recoveryStore });
  assert.equal(recovered.driver.state.transfer.recipientVerified, false);
  const pendingMarkup = renderToStaticMarkup(<WildsWalletSend state={recovered.driver.state}
    onLookupRecipient={() => {}} onSelectRecipient={() => {}} onReviewAmount={() => {}} onStage={() => {}} onAuthorizationPointerStart={() => {}} onAuthorizationPointerCancel={() => {}} onAuthorize={() => {}} onRecover={() => {}} onEditTransfer={() => {}} onResetTransfer={() => {}} />);
  assert.doesNotMatch(pendingMarkup, /@impostor/);
  await recovered.driver.recoverTransfer();
  assert.equal(recovered.driver.state.transfer.phase, "committed");
  assert.equal(saved.has("sender"), false);
  assert.equal(transferDriver(undefined, { recoveryStore }).driver.state.transfer.phase, "recipient");
});

test("browser recovery refuses new payments at capacity without evicting any uncertain attempt", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: storage } });
  try {
    for (let index = 0; index < 5; index++) {
      const { driver, calls } = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: index === 3 ? "accounts" : `sender-${index}`, sourceKey: `sealed-source-${index}` });
      await stage(driver); await driver.authorizeTransfer(7, { artifact: "private-signed-identity", challenge: { nonce: "private-challenge" } });
      assert.equal(calls.filter(path => path.endsWith("/execute")).length, index < 4 ? 1 : 0);
    }
    assert.ok(values.size > 0, "retain a submitted attempt before the browser can reload");
    assert.ok(values.size <= 5, "four attempts plus their bounded index");
    assert.doesNotMatch([...values.values()].join("\n"), /private-signed-identity|private-challenge/);
    const restored = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "accounts", sourceKey: "sealed-source-3" });
    assert.equal(restored.driver.state.transfer.phase, "unknown");
    assert.equal(restored.driver.state.transfer.amountPhiMicro, "1");
    const oldest = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "sender-0", sourceKey: "sealed-source-0" });
    assert.equal(oldest.driver.state.transfer.phase, "unknown");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window");
  }
});

for (const failure of ["throwing write", "silent dropped write", "throwing read", "throwing readback", "crossed readback"] as const) {
  test(`execution fails closed on ${failure} before any funds request`, async () => {
    let saved: unknown;
    const recoveryStore = {
      load: () => { if (failure === "throwing read" || (failure === "throwing readback" && saved)) throw new Error("storage read blocked"); return failure === "crossed readback" && saved ? { ...(saved as object), attempt: "v2.other-attempt" } : saved; },
      write: (_identity: string, value: unknown) => { if (failure === "throwing write") throw new Error("storage quota"); if (failure !== "silent dropped write") saved = value; },
      delete() {}
    };
    const { driver, calls } = transferDriver(undefined, { recoveryStore });
    await stage(driver); await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
    assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
    assert.equal(driver.state.transfer.phase, "authorize");
    assert.match(driver.state.transfer.preparationError ?? "", /save|storage/i);
    assert.equal(driver.state.transfer.attempt, "v2.exact-attempt");
  });
}

test("an exact payment is reconstructable from durable storage before the execute request starts", async () => {
  const records = new Map<string, unknown>();
  const recoveryStore = { load: (identity: string) => records.get(identity), write: (identity: string, value: unknown) => { records.set(identity, JSON.parse(JSON.stringify(value))); }, delete: (identity: string) => { records.delete(identity); } };
  let executes = 0;
  const { driver } = transferDriver(async path => ({ ok: true, status: 200, json: async () => {
    if (path.endsWith("/preview")) return { status: "staged", rail: "settlement", amountPhiMicro: "1", quotedUsdCents: "0", attempt: "v2.exact-attempt", expiresAtKai: 999 };
    assert.ok(path.endsWith("/execute")); executes++;
    const restored = transferDriver(undefined, { recoveryStore, authorityGeneration: "renewed" });
    assert.equal(restored.driver.state.transfer.phase, "unknown");
    assert.equal(restored.driver.state.transfer.attempt, "v2.exact-attempt");
    assert.equal(restored.driver.state.transfer.operationNonce, "nonce-one");
    assert.equal(restored.driver.state.transfer.recipientUsername, "friend");
    return { status: "unknown", rail: "settlement", amountPhiMicro: "1" };
  } }), { recoveryStore });
  await stage(driver); await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  assert.equal(executes, 1);
});

test("a temporarily unreadable older pending attempt is never overwritten by a newly reviewed payment", async () => {
  const original = { schema: "wildz.wallet.submitted-payment.v1", identityKey: "sender", sourceKey: "source", attempt: "v2.older-attempt", recipientUsername: "friend", amountPhiMicro: "1", rail: "settlement", operationNonce: "older-nonce", expiresAtKai: 999 };
  let reads = 0, writes = 0;
  const recoveryStore = { load: () => { if (++reads === 1) throw new Error("temporary read failure"); return original; }, write: () => { writes++; }, delete() {} };
  const { driver, calls } = transferDriver(undefined, { recoveryStore });
  await stage(driver); await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
  assert.equal(writes, 0);
  assert.equal(driver.state.transfer.phase, "authorize");
  assert.equal(recoveryStore.load(), original);
});

test("blocked browser storage cannot substitute memory for a durable payment checkpoint", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get sessionStorage() { throw new Error("storage blocked"); } } });
  try {
    const { driver, calls } = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore });
    await stage(driver); await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
    assert.equal(calls.filter(path => path.endsWith("/execute")).length, 0);
    assert.equal(driver.state.transfer.phase, "authorize");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window");
  }
});

test("browser quota failure preserves previous checkpoints and cannot execute or reconstruct a new payment", async () => {
  const values = new Map<string, string>();
  let quota = false;
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (quota) throw new Error("QuotaExceededError"); values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: storage } });
  try {
    const first = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "first" });
    await stage(first.driver); await first.driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
    const saved = [...values.entries()]; quota = true;
    const second = transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "second" });
    await stage(second.driver); await second.driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
    assert.equal(second.calls.filter(path => path.endsWith("/execute")).length, 0);
    assert.deepEqual([...values.entries()], saved);
    assert.equal(transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "first" }).driver.state.transfer.phase, "unknown");
    assert.equal(transferDriver(undefined, { recoveryStore: wildsWalletBrowserTransferRecoveryStore, identityKey: "second" }).driver.state.transfer.phase, "recipient");
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window");
  }
});

test("committed recovery replaces a tampered local recipient with the sealed attempt's authoritative recipient", async () => {
  const records = new Map<string, unknown>();
  const recoveryStore = { load: (identity: string) => records.get(identity), write: (identity: string, value: unknown) => { records.set(identity, value); }, delete: (identity: string) => { records.delete(identity); } };
  const first = transferDriver(undefined, { recoveryStore });
  await stage(first.driver); await first.driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  records.set("sender", { ...(records.get("sender") as object), recipientUsername: "impostor" });
  const recovered = transferDriver(async path => ({ ok: true, status: 200, json: async () => path.includes("/status?")
    ? { status: "committed", rail: "settlement", amountPhiMicro: "1", recipientUsername: "friend" }
    : path.endsWith("summary") ? { status: "verified", admittedPhiMicro: "999999", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null }
      : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : { cursor: null, nextCursor: null, entries: [] } }), { recoveryStore });
  await recovered.driver.recoverTransfer();
  assert.equal(recovered.driver.state.transfer.phase, "committed");
  assert.equal(recovered.driver.state.transfer.recipientUsername, "friend");
});

for (const recipientUsername of [undefined, "@Friend", "invalid recipient"] as const) {
  test(`committed recovery refuses missing or noncanonical authoritative recipient ${recipientUsername}`, async () => {
    const records = new Map<string, unknown>();
    const recoveryStore = { load: (identity: string) => records.get(identity), write: (identity: string, value: unknown) => { records.set(identity, value); }, delete: (identity: string) => { records.delete(identity); } };
    const first = transferDriver(undefined, { recoveryStore });
    await stage(first.driver); await first.driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
    const recovered = transferDriver(async () => ({ ok: true, status: 200, json: async () => ({ status: "committed", rail: "settlement", amountPhiMicro: "1", ...(recipientUsername === undefined ? {} : { recipientUsername }) }) }), { recoveryStore });
    await recovered.driver.recoverTransfer();
    assert.equal(recovered.driver.state.transfer.phase, "unknown");
    assert.ok(records.has("sender"));
  });
}

test("an expired read bearer clears holdings without erasing a submitted payment's recovery", async () => {
  const { driver } = transferDriver();
  await stage(driver); await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  const reading = reduceWildsWalletController(driver.state, { type: "refresh-start", requestId: 100 });
  const expired = reduceWildsWalletController(reading, { type: "refresh-failed", requestId: 100, reason: "revoked" });
  assert.equal(expired.summary, null);
  assert.equal(expired.transfer.phase, "unknown");
  assert.equal(expired.transfer.attempt, driver.state.transfer.attempt);
});
