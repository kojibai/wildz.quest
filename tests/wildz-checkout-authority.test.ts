import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isAdmittedConnectTransfer } from "../src/lib/receiz/wildz-market-adapter";

const transferProof = {
  kind: "receiz.proof_bundle",
  payloadVersion: "v2",
  createdAtMs: 1781524800000,
  ts: "2026-07-15T12:00:00.000Z",
  code: "WILDZ-TRANSFER",
  slug: "wildz-transfer",
  verifyPath: "/v/wildz-transfer/WILDZ-TRANSFER/1",
  verifyUrl: "https://receiz.com/v/wildz-transfer/WILDZ-TRANSFER/1",
  kaiPulseEternal: "1",
  kaiKlok: "kai:1",
  receizClaimId: "a".repeat(32),
  sigilClaimSeed: "b".repeat(64)
} as const;

test("Connect settlement requires every Receiz proof field", () => {
  assert.equal(isAdmittedConnectTransfer({ ok: true, transferId: "tr_1", ledgerEventId: "ledger_1" }), false);
  assert.equal(isAdmittedConnectTransfer({ ok: true, transferId: "tr_1", ledgerEventId: "ledger_1", proofBundle: {} }), false);
  assert.equal(isAdmittedConnectTransfer({
    ok: true,
    transferId: "tr_1",
    ledgerEventId: "ledger_1",
    proofBundle: transferProof
  }), true);
});

test("checkout and recovery derive recipient and amount from the admitted listing", () => {
  for (const path of ["app/api/market/checkout/route.ts", "app/api/market/settlement/route.ts"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /resolveWildzCookieActor/);
    assert.match(source, /purchaseAdmittedWildzTrade/);
    assert.doesNotMatch(source, /body\.(?:buyer|seller|recipientUserId|amount|price|accessToken)/);
    assert.doesNotMatch(source, /oneClickCheckout|checkoutSession/);
  }
});
