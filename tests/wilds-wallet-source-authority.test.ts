import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizIdentityAccountProjection } from "@receiz/sdk";
import { projectWildsWalletFromIdentityAccount } from "../src/features/play/wallet/wilds-wallet-source-authority";

function identityAccount(overrides: Partial<ReceizIdentityAccountProjection> = {}): ReceizIdentityAccountProjection {
  return {
    schema: "receiz.sdk.identity_account_projection.v1",
    keyId: "a".repeat(64),
    alg: "Ed25519",
    owner: { uid: "receiz:explorer", email: null, username: "explorer", displayName: "Explorer" },
    accountStateSchema: "receiz.account.state.v3",
    portableStateVerified: true,
    portableStateStatus: "verified",
    authority: "verified-identity-portable-state",
    completeAtSealedHead: true,
    networkRequiredForProjection: false,
    verifiedState: {
      wallet: {
        balancePhiMicro: "2500000",
        balanceUsdCents: "500",
        transferableResourceCount: 3,
        transferableCardCount: 2,
        reservedCardCount: 1,
        pendingCount: 0
      },
      walletLedgerEntries: []
    },
    snapshot: null,
    domains: {
      profile: true, showcase: true, actionLedger: true, calendar: true, contacts: true,
      wallet: true, sports: true, signalVault: true, media: true, preferences: true, proofHistory: true
    },
    ...overrides
  };
}

test("projects exact wallet holdings from the verified portable source without network authority", () => {
  const projection = projectWildsWalletFromIdentityAccount(identityAccount());

  assert.equal(projection?.summary.admittedPhiMicro, "2500000");
  assert.equal(projection?.summary.displayUsdCents, "500");
  assert.equal(projection?.summary.transferableCardCount, 2);
  assert.equal(projection?.capabilities.read, "available");
  assert.equal(projection?.capabilities.receive, "available");
  assert.equal(projection?.ledger?.entries.length, 0);
});

test("never projects unverified or non-wallet portable state as wallet truth", () => {
  assert.equal(projectWildsWalletFromIdentityAccount(identityAccount({ portableStateVerified: false, authority: "rejected-portable-state" })), null);
  assert.equal(projectWildsWalletFromIdentityAccount(identityAccount({ domains: { ...identityAccount().domains, wallet: false } })), null);
});
