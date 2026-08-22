import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWalletControllerDriver } from "../src/features/play/wallet/wilds-wallet-controller-driver";
import { createWildsWalletSessionCache } from "../src/features/play/wallet/wilds-wallet-controller";

const response = () => ({
  summary: { status: "verified", admittedPhiMicro: "1", displayUsdCents: null, assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null },
  capabilities: { read: "available", receive: "available", send: { available: false, reason: "receiz_v123_execution_unavailable" }, resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" }, phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" }, phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" } },
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
