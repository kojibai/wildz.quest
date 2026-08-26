import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWildsWalletCursor,
  normalizeWildsWalletPublicUsername,
  parseWildsWalletMicroPhi,
  projectWildsWalletCapabilities,
  projectWildsWalletLedgerPage,
  projectWildsWalletRecipient,
  projectWildsWalletSummary
} from "../src/lib/receiz/wilds-wallet-projections";
import { receizOidcScopesForRails } from "@receiz/sdk";

describe("Wilds wallet projections", () => {
  it("keeps absent SDK asset counts explicitly unknown instead of claiming zero inventory", () => {
    const projection = projectWildsWalletSummary({
      ok: true,
      balancePhiMicro: "2500000",
      balanceUsdCents: "425",
      userId: "receiz:private-owner",
      settlement: { sourceValueHead: "private-head" }
    });

    assert.deepEqual(projection, {
      status: "verified",
      admittedPhiMicro: "2500000",
      displayUsdCents: "425",
      assetCountsStatus: "unknown",
      transferableResourceCount: null,
      transferableCardCount: null,
      reservedCardCount: null,
      pendingCount: null
    });
    assert.doesNotMatch(JSON.stringify(projection), /private-owner|private-head/);
  });

  it("retains supplied bounded asset counts only when every count is present", () => {
    assert.deepEqual(projectWildsWalletSummary({
      ok: true,
      balancePhiMicro: "1",
      transferableResourceCount: 3,
      transferableCardCount: 4,
      reservedCardCount: 2,
      pendingCount: 1
    }), {
      status: "verified",
      admittedPhiMicro: "1",
      displayUsdCents: null,
      assetCountsStatus: "available",
      transferableResourceCount: 3,
      transferableCardCount: 4,
      reservedCardCount: 2,
      pendingCount: 1
    });
  });

  it("rejects non-integer, negative, and unbounded micro-Phi values", () => {
    assert.equal(parseWildsWalletMicroPhi("0002500000"), "2500000");
    for (const invalid of ["2.5", "-1", "1e6", "", "9".repeat(31)]) {
      assert.throws(() => parseWildsWalletMicroPhi(invalid), /wilds_wallet_micro_phi_invalid/);
    }
  });

  it("normalizes exact public usernames and refuses Unicode-confusable identities", () => {
    assert.equal(normalizeWildsWalletPublicUsername(" @Kai_01.RECEIZ.ID "), "kai_01");
    for (const invalid of ["ka", "kai-name", "kаi_01", "kai_01.receiz.id.extra"]) {
      assert.throws(() => normalizeWildsWalletPublicUsername(invalid), /wilds_wallet_username_invalid/);
    }
  });

  it("bounds server-owned cursors", () => {
    assert.equal(normalizeWildsWalletCursor(null), null);
    assert.equal(normalizeWildsWalletCursor("aB_9-xy"), "aB_9-xy");
    for (const invalid of ["cursor=forged", "x".repeat(257), "with space"]) {
      assert.throws(() => normalizeWildsWalletCursor(invalid), /wilds_wallet_cursor_invalid/);
    }
  });

  it("does not serialize raw ledger source IDs, proof material, or owner values", () => {
    const ledger = projectWildsWalletLedgerPage({
      ok: true,
      cursor: "first",
      nextCursor: "next_2",
      since: null,
      events: [{
        id: "receipt_001",
        kind: "transfer",
        createdAt: "2026-08-21T12:00:00.000Z",
        pulse: 88,
        amountPhiMicro: "2500000",
        actor: { id: "receiz:private-owner", email: "owner@example.test" },
        fromActor: { handle: "kai_01.receiz.id", ownerId: "receiz:private-owner" },
        toActor: { handle: "friend_2.receiz.id", email: "friend@example.test" },
        proofBundle: { digest: "private-proof" },
        receiz: { subjectId: "private-subject" }
      }]
    }, "kai_01");
    const recipient = projectWildsWalletRecipient({
      username: "friend_2.receiz.id",
      profileMark: "FT",
      email: "friend@example.test",
      id: "receiz:friend",
      allowedTransferKinds: ["phi", "resource", "card", "forged"]
    });

    assert.deepEqual(ledger, {
      cursor: "first",
      nextCursor: "next_2",
      entries: [{
        receiptReference: null,
        direction: "sent",
        state: "unknown",
        counterpartyUsername: "friend_2",
        amountPhiMicro: "2500000",
        createdAt: "2026-08-21T12:00:00.000Z",
        kaiPulse: 88
      }]
    });
    assert.deepEqual(recipient, {
      username: "friend_2",
      profileMark: "FT",
      allowedTransferKinds: ["phi", "resource", "card"]
    });
    assert.doesNotMatch(JSON.stringify({ ledger, recipient }), /receipt_001|private|example\.test|receiz:/);
  });

  it("does not turn an event kind into a committed settlement state", () => {
    const ledger = projectWildsWalletLedgerPage({
      ok: true,
      cursor: null,
      nextCursor: null,
      events: [{
        id: "raw_transfer_event",
        kind: "transfer",
        createdAt: "2026-08-21T12:00:00.000Z",
        fromActor: { handle: "kai_01.receiz.id" },
        toActor: { handle: "friend_2.receiz.id" }
      }]
    }, "kai_01");

    assert.equal(ledger.entries[0]?.state, "unknown");
  });

  it("accepts only bounded canonical ISO instants for ledger timestamps", () => {
    const page = (createdAt: string) => projectWildsWalletLedgerPage({
      ok: true,
      cursor: null,
      nextCursor: null,
      events: [{ id: "event_001", kind: "transfer", createdAt }]
    }, "kai_01");

    assert.equal(page("2026-08-21T12:00:00.000Z").entries[0]?.createdAt, "2026-08-21T12:00:00.000Z");
    for (const invalid of ["0", "2026-08-21T12:00:00Z", "2026-08-21 12:00:00.000Z", "x".repeat(65)]) {
      assert.throws(() => page(invalid), /wilds_wallet_ledger_invalid/);
    }
  });

  it("marks every execution surface unavailable while retaining reads without V124 admission", () => {
    assert.deepEqual(projectWildsWalletCapabilities(), {
      read: "available",
      receive: "available",
      recipientLookup: { available: false, reason: "receiz_v123_execution_unavailable" },
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    });
  });

  it("admits live V124 Phi capabilities only for exact installed rails and SDK-derived granted scopes", () => {
    const rails = {
      proofAuthorityExchange: true,
      settlementExecution: true,
      reserveExecution: true,
      valueExecutionRecovery: true,
      worldPlanning: true,
      worldExecution: true,
      subjectNamespaces: true
    } as const;
    const exactScopes = receizOidcScopesForRails(
      "settlement",
      "reserve",
      "worldCommands",
      "worldEvents",
      "subjects",
      "subjectMandates",
      "subjectInventory"
    );

    const admitted = projectWildsWalletCapabilities({
      sdkVersion: "124.0.3",
      rails,
      grantedScopes: exactScopes
    }, true);
    assert.deepEqual(admitted.recipientLookup, { available: true });
    assert.deepEqual(admitted.phiSettlement, { available: true });
    assert.deepEqual(admitted.phiReserve, { available: true });
    assert.deepEqual(admitted.send, { available: true });
    assert.deepEqual(admitted.resourceTransfer, {
      available: false,
      reason: "receiz_v123_execution_unavailable"
    });
    assert.deepEqual(admitted.cardTransfer, {
      available: false,
      reason: "receiz_v123_execution_unavailable"
    });

    const partial = projectWildsWalletCapabilities({
      sdkVersion: "124.0.3",
      rails,
      grantedScopes: exactScopes.filter((scope) => scope !== "receiz:reserve.write")
    });
    assert.deepEqual(partial.phiReserve, {
      available: false,
      reason: "receiz_v123_scope_required"
    });
    assert.deepEqual(partial.send, { available: true });

    const packageOnly = projectWildsWalletCapabilities({
      sdkVersion: "124.0.3",
      rails: { ...rails, valueExecutionRecovery: false },
      grantedScopes: exactScopes
    });
    assert.deepEqual(packageOnly.send, {
      available: false,
      reason: "receiz_v123_execution_unavailable"
    });
  });
});
