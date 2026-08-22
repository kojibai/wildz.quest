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

describe("Wilds wallet projections", () => {
  it("projects only bounded admitted Phi values and display-only price data", () => {
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
      transferableResourceCount: 0,
      transferableCardCount: 0,
      reservedCardCount: 0,
      pendingCount: 0
    });
    assert.doesNotMatch(JSON.stringify(projection), /private-owner|private-head/);
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

  it("redacts private ledger and recipient fields while preserving public read facts", () => {
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
        receiptReference: "receipt_001",
        direction: "sent",
        state: "committed",
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
    assert.doesNotMatch(JSON.stringify({ ledger, recipient }), /private|example\.test|receiz:/);
  });

  it("marks every V123 execution surface unavailable while retaining V122 reads", () => {
    assert.deepEqual(projectWildsWalletCapabilities(), {
      read: "available",
      receive: "available",
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    });
  });
});
