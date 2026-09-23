import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletControllerDriver } from "../src/features/play/wallet/wilds-wallet-controller-driver";
import { createWildsWalletSessionCache } from "../src/features/play/wallet/wilds-wallet-controller";
import { writeWildsCreatureLocomotionFrame } from "../src/features/play/WildsCreatureActor";

const response = () => ({
  summary: { status: "verified", admittedPhiMicro: "1", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null },
  capabilities: { read: "available", receive: "available", recipientLookup: { available: false, reason: "receiz_v123_execution_unavailable" }, send: { available: false, reason: "receiz_v123_execution_unavailable" }, resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" }, phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" } },
  ledger: { cursor: null, nextCursor: null, entries: [] }
});

test("driver deduplicates a read, clears malformed receive completion, and permits retry", async () => {
  const publications: unknown[] = [];
  let receiveCalls = 0;
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1",
    publish: (state) => publications.push(state),
    fetcher: async (path) => {
      if (path === "/api/wilds/wallet/request") {
        receiveCalls += 1;
        return receiveCalls === 1 ? { ok: true, status: 200, json: async () => ({ invalid: true }) } : { ok: true, status: 200, json: async () => ({ locator: "wildz:receive:kai" }) };
      }
      const part = path.endsWith("summary") ? response().summary : path.endsWith("capabilities") ? response().capabilities : response().ledger;
      return { ok: true, status: 200, json: async () => part };
    }
  });
  driver.open();
  const first = driver.refresh();
  assert.equal(driver.refresh(), first);
  await first;
  await driver.requestReceive();
  assert.equal(driver.state.receiveRequestId, null);
  assert.equal(driver.state.receiveLocator, null);
  await driver.requestReceive();
  assert.equal(driver.state.receiveLocator, "wildz:receive:kai");
  assert.ok(publications.length > 0);
});

test("driver revokes verified state from exact server code and synchronously hides a renewed generation cache", async () => {
  const cache = createWildsWalletSessionCache(2);
  cache.write("kai:issued-1", response());
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1", publish: () => {},
    cache,
    fetcher: async (path) => path.endsWith("summary")
      ? { ok: false, status: 401, json: async () => ({ error: "receiz_wallet_authority_revoked" }) }
      : { ok: true, status: 200, json: async () => response().capabilities }
  });
  assert.equal(driver.state.status, "offline-verified");
  driver.open();
  await driver.refresh();
  assert.equal(driver.state.status, "revoked");
  assert.equal(driver.state.summary, null);
  driver.setAuthority("kai", "issued-2");
  assert.equal(driver.state.summary, null);
});

test("ambiguous HTTP 401 clears the shared cache and live diagnostics stay unchanged through world frames", async () => {
  const cache = createWildsWalletSessionCache(4);
  cache.write("kai:issued-1", response());
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1", cache, publish: () => {},
    fetcher: async (path) => path.endsWith("summary")
      ? { ok: false, status: 401, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => path.endsWith("capabilities") ? response().capabilities : response().ledger }
  });
  driver.open();
  await driver.refresh();
  assert.equal(driver.state.status, "revoked");
  assert.equal(cache.read("kai:issued-1"), null);

  const working = createWildsWalletControllerDriver({
    identityKey: "other", authorityGeneration: "issued-2", cache, publish: () => {},
    fetcher: async (path) => path.endsWith("request")
      ? { ok: true, status: 200, json: async () => ({ locator: "wildz:receive:other" }) }
      : { ok: true, status: 200, json: async () => path.endsWith("summary") ? response().summary : path.endsWith("capabilities") ? response().capabilities : response().ledger }
  });
  working.open();
  await working.refresh();
  await working.requestReceive();
  const baseline = working.diagnostics();
  const frame = { rootY: 0, rootPitch: 0, rootRoll: 0, limbPitch: 0, wingAngle: 0 };
  for (let index = 0; index < 10_000; index += 1) writeWildsCreatureLocomotionFrame(frame, "air", index / 60, 1, .25, "idle");
  assert.ok(baseline.refreshStarts > 0 && baseline.cacheWrites > 0 && baseline.receiveStarts > 0 && baseline.publications > 0);
  assert.deepEqual(working.diagnostics(), baseline);
});

test("driver deduplicates staging, requires an armed pointer, and recovers an ambiguous exact attempt", async () => {
  const calls: string[] = [];
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1", publish: () => {},
    fetcher: async (path) => {
      calls.push(path);
      if (path.endsWith("/preview")) return {
        ok: true, status: 200,
        json: async () => ({ status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.opaque", expiresAtKai: 100 })
      };
      if (path.endsWith("/execute")) return {
        ok: true, status: 202,
        json: async () => ({ status: "unknown", rail: "settlement", amountPhiMicro: "25" })
      };
      if (path.includes("/status?")) return {
        ok: true, status: 200,
        json: async () => ({ status: "committed", rail: "settlement", amountPhiMicro: "25" })
      };
      const part = path.endsWith("summary") ? response().summary : path.endsWith("capabilities") ? response().capabilities : response().ledger;
      return { ok: true, status: 200, json: async () => part };
    }
  });
  driver.open();
  driver.selectTransferRecipient("friend");
  driver.reviewTransferAmount("settlement", "25", "nonce-1");
  const stage = driver.stageTransfer();
  assert.equal(driver.stageTransfer(), stage);
  await stage;
  assert.equal(driver.state.transfer.phase, "authorize");

  await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  assert.equal(calls.filter((path) => path.endsWith("/execute")).length, 0);
  driver.authorizationPointerStart(7);
  await driver.authorizeTransfer(7, { artifact: "signed", challenge: {} });
  assert.equal(driver.state.transfer.phase, "unknown");
  await driver.recoverTransfer();
  assert.equal(driver.state.transfer.phase, "committed");
  assert.equal(driver.state.stagedTransactionId, null);
  assert.equal(calls.filter((path) => path.endsWith("/preview")).length, 1);
});

test("a scanned receiving QR stages against its sealed locator and keeps its proposed amount editable", async () => {
  const bodies: Record<string, unknown>[] = [];
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1", publish: () => {},
    fetcher: async (path, init) => {
      assert.equal(path, "/api/wilds/wallet/transfer/preview");
      bodies.push(JSON.parse(init.body ?? "null"));
      return { ok: true, status: 200, json: async () => ({ status: "staged", rail: "settlement", amountPhiMicro: "3000000", quotedUsdCents: "1", attempt: "v1.coordinate", expiresAtKai: 100 }) };
    }
  });
  driver.open();
  driver.selectReceiveCoordinate("friend", "wildz:receive:v1.aaa.bbb.ccc", "2500000");
  assert.equal(driver.state.transfer.amountPhiMicro, "2500000");
  driver.reviewTransferAmount("settlement", "3000000", "nonce-coordinate");
  await driver.stageTransfer();
  assert.deepEqual(bodies, [{ recipientLocator: "wildz:receive:v1.aaa.bbb.ccc", amountPhiMicro: "3000000", rail: "settlement", operationNonce: "nonce-coordinate" }]);
});

test("driver converts malformed execution success to unknown and cancellation cannot publish a late commit", async () => {
  let resolveExecute!: (value: { ok: boolean; status: number; json(): Promise<unknown> }) => void;
  const driver = createWildsWalletControllerDriver({
    identityKey: "kai", authorityGeneration: "issued-1", publish: () => {},
    fetcher: async (path) => {
      if (path.endsWith("/preview")) return { ok: true, status: 200, json: async () => ({ status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.opaque", expiresAtKai: 100 }) };
      if (path.endsWith("/execute")) return new Promise((resolve) => { resolveExecute = resolve; });
      return { ok: true, status: 200, json: async () => response().ledger };
    }
  });
  driver.open();
  driver.selectTransferRecipient("friend");
  driver.reviewTransferAmount("settlement", "25", "nonce-1");
  await driver.stageTransfer();
  driver.authorizationPointerStart(9);
  const execution = driver.authorizeTransfer(9, { artifact: "signed", challenge: {} });
  driver.cancelPending();
  resolveExecute({ ok: true, status: 200, json: async () => ({ status: "committed", rail: "settlement", amountPhiMicro: "25", executionId: "private" }) });
  await execution;
  assert.equal(driver.state.transfer.phase, "unknown");
  assert.equal(driver.state.stagedTransactionId, "v1.opaque");
});

test("driver performs bounded live recipient lookup and admits only the sanitized projection", async () => {
  const bodies: unknown[] = [];
  const driver = createWildsWalletControllerDriver({
    identityKey: "private-actor-coordinate", authorityGeneration: "issued-1", publish: () => {},
    fetcher: async (path, init) => {
      assert.equal(path, "/api/wilds/wallet/recipient");
      bodies.push(JSON.parse(init.body ?? "null"));
      return { ok: true, status: 200, json: async () => ({ username: "friend_2", profileMark: "F2", allowedTransferKinds: ["phi"] }) };
    }
  });
  driver.open();
  await driver.lookupRecipient("friend_2");
  assert.deepEqual(bodies, [{ username: "friend_2" }]);
  assert.deepEqual(driver.state.recipient.projection, { username: "friend_2", profileMark: "F2", allowedTransferKinds: ["phi"] });
});

test("driver rejects a valid but crossed recipient response that does not match the normalized request", async () => {
  const driver = createWildsWalletControllerDriver({
    identityKey: "private-actor-coordinate", authorityGeneration: "issued-1", publish: () => {},
    fetcher: async () => ({ ok: true, status: 200, json: async () => ({ username: "different_user", profileMark: null, allowedTransferKinds: ["phi"] }) })
  });
  driver.open();
  await driver.lookupRecipient("@Friend_2.RECEIZ.ID");
  assert.equal(driver.state.recipient.status, "failed");
  assert.equal(driver.state.recipient.projection, null);
});


test("refreshing a source-backed wallet shows and caches settled earnings", async () => {
  const cache = createWildsWalletSessionCache(2);
  const source = response();
  const live = { ...source, summary: { ...source.summary, admittedPhiMicro: "20000" } };
  const driver = createWildsWalletControllerDriver({
    identityKey: "earner", authorityGeneration: "generation-1", cache, publish() {},
    fetcher: async path => ({ ok: true, status: 200, json: async () => path.endsWith("summary") ? live.summary : path.endsWith("capabilities") ? live.capabilities : live.ledger })
  });
  driver.admitSourceAuthority(source as Parameters<typeof driver.admitSourceAuthority>[0]);
  await driver.refresh();
  assert.equal(driver.state.summary?.admittedPhiMicro, "20000");
  assert.equal(cache.read("earner:generation-1")?.summary.admittedPhiMicro, "20000");
  driver.admitSourceAuthority(source as Parameters<typeof driver.admitSourceAuthority>[0]);
  assert.equal(cache.read("earner:generation-1")?.summary.admittedPhiMicro, "20000");
});


test("a late saved identity projection cannot populate a different account", () => {
  const driver = createWildsWalletControllerDriver({ identityKey: "old", authorityGeneration: "one", cache: createWildsWalletSessionCache(2), publish() {}, fetcher: async () => { throw new Error("not needed"); } });
  driver.setAuthority("new", "two");
  driver.admitSourceAuthority(response() as Parameters<typeof driver.admitSourceAuthority>[0], { identityKey: "old", authorityGeneration: "one" });
  assert.equal(driver.state.summary, null);
  assert.equal(driver.state.sourceAuthorityVerified, false);
});


test("remounting offline keeps the last current balance instead of the old identity balance", async () => {
  const cache = createWildsWalletSessionCache(2);
  const source = response();
  cache.write("earner:generation-2", { ...source, summary: { ...source.summary, admittedPhiMicro: "30000" } });
  const driver = createWildsWalletControllerDriver({ identityKey: "earner", authorityGeneration: "generation-2", cache, publish() {}, fetcher: async () => { throw new Error("offline"); } });
  driver.admitSourceAuthority(source as Parameters<typeof driver.admitSourceAuthority>[0]);
  await driver.refresh();
  assert.equal(driver.state.summary?.admittedPhiMicro, "30000");
  assert.equal(driver.state.status, "offline-verified");
});


test("the current PHI amount appears without waiting for transfer capabilities or history", async () => {
  let releaseDetails!: () => void;
  const details = new Promise<void>(resolve => { releaseDetails = resolve; });
  const source = response();
  const driver = createWildsWalletControllerDriver({ identityKey: "bjklock", authorityGeneration: "one", cache: createWildsWalletSessionCache(2), publish() {},
    fetcher: async path => {
      if (!path.endsWith("summary")) await details;
      return { ok: true, status: 200, json: async () => path.endsWith("summary") ? { ...source.summary, admittedPhiMicro: "1234567" } : path.endsWith("capabilities") ? source.capabilities : source.ledger };
    }
  });
  try {
    const read = driver.refresh();
    await Promise.race([read, new Promise(resolve => setTimeout(resolve, 30))]);
    assert.equal(driver.state.summary?.admittedPhiMicro, "1234567");
    assert.equal(driver.state.status, "verified");
  } finally { releaseDetails(); driver.close(); }
});

test("unavailable history does not suppress a successful balance response", async () => {
  const source = response();
  const driver = createWildsWalletControllerDriver({ identityKey: "bjklock", authorityGeneration: "one", cache: createWildsWalletSessionCache(2), publish() {},
    fetcher: async path => {
      if (path.endsWith("ledger")) throw new Error("history unavailable");
      return { ok: true, status: 200, json: async () => path.endsWith("summary") ? { ...source.summary, admittedPhiMicro: "1234567" } : source.capabilities };
    }
  });
  await driver.refresh();
  assert.equal(driver.state.summary?.admittedPhiMicro, "1234567");
  assert.equal(driver.state.status, "verified");
  driver.close();
});

test("a stalled optional read times out without hiding the available PHI", async () => {
  const driver = createWildsWalletControllerDriver({
    identityKey: "timeout-fixture", authorityGeneration: "one", readTimeoutMs: 15,
    cache: createWildsWalletSessionCache(2), publish() {},
    fetcher: async path => path.endsWith("summary")
      ? { ok: true, status: 200, json: async () => response().summary }
      : new Promise(() => {})
  });
  await driver.refresh();
  assert.equal(driver.state.summary?.admittedPhiMicro, "1");
  assert.equal(driver.state.status, "verified");
  assert.equal(driver.state.requestId, null);
  driver.close();
});

test("a stalled balance request settles instead of loading forever", async () => {
  const driver = createWildsWalletControllerDriver({
    identityKey: "timeout-fixture", authorityGeneration: "two", readTimeoutMs: 15,
    cache: createWildsWalletSessionCache(2), publish() {},
    fetcher: async () => new Promise(() => {})
  });
  await driver.refresh();
  assert.equal(driver.state.status, "failed");
  assert.equal(driver.state.summary, null);
  assert.equal(driver.state.requestId, null);
  driver.close();
});

test("refreshing a known amount keeps it visible without a loading state", async () => {
  const driver = createWildsWalletControllerDriver({
    identityKey: "silent-fixture", authorityGeneration: "one",
    cache: createWildsWalletSessionCache(2), publish() {},
    fetcher: async path => ({ ok: true, status: 200, json: async () => path.endsWith("summary") ? response().summary : path.endsWith("ledger") ? response().ledger : response().capabilities })
  });
  await driver.refresh();
  const refresh = driver.refresh();
  assert.equal(driver.state.status, "verified");
  assert.equal(driver.state.summary?.admittedPhiMicro, "1");
  await refresh;
  driver.close();
});
