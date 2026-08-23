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
        schema: "receiz.wallet.settlement-portable.v1",
        routeSummary: {
          userId: "receiz:explorer",
          balancePhiMicro: "2500000",
          balancePhi: "2.5",
          balanceUsd: "5.00",
          transferableResourceCount: 3,
          transferableCardCount: 2,
          reservedCardCount: 1,
          pendingCount: 0
        },
        ledgerEntries: []
      }
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

test("projects the exact older portable wallet account without a server read", () => {
  const account = identityAccount({
    verifiedState: {
      wallet: {
        schema: "receiz.wallet.settlement-portable.v1",
        account: { balance_phi_micro: "9000000", balance_usd: "900.00" },
        ledgerEntries: []
      }
    }
  });

  const projection = projectWildsWalletFromIdentityAccount(account);
  assert.equal(projection?.summary.admittedPhiMicro, "9000000");
  assert.equal(projection?.summary.displayUsdCents, "90000");
});

test("a Receiz ID with no settlement block is still its exact zero-value wallet", () => {
  const projection = projectWildsWalletFromIdentityAccount(identityAccount({
    verifiedState: { account: { userId: "receiz:explorer", username: "explorer" } },
    domains: { ...identityAccount().domains, wallet: false }
  }));

  assert.equal(projection?.summary.admittedPhiMicro, "0");
  assert.equal(projection?.summary.displayUsdCents, null);
  assert.equal(projection?.capabilities.receive, "available");
});

test("an identity-only Receiz ID is an active zero-value wallet", () => {
  const projection = projectWildsWalletFromIdentityAccount(identityAccount({
    accountStateSchema: null,
    portableStateVerified: false,
    portableStateStatus: "missing",
    authority: "identity-only",
    completeAtSealedHead: false,
    verifiedState: null,
    domains: Object.fromEntries(Object.keys(identityAccount().domains).map((domain) => [domain, false])) as ReceizIdentityAccountProjection["domains"]
  }));

  assert.equal(projection?.summary.admittedPhiMicro, "0");
  assert.equal(projection?.capabilities.receive, "available");
});

test("never projects a rejected portable state as wallet truth", () => {
  assert.equal(projectWildsWalletFromIdentityAccount(identityAccount({ portableStateVerified: false, authority: "rejected-portable-state" })), null);
});
