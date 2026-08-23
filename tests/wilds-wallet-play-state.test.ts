import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { projectWildsWalletPlayStateSeed, seedWildsWalletFromPlayState } from "../src/features/play/wallet/wilds-wallet-play-state";
import { projectWildsWalletFromIdentityAccount } from "../src/features/play/wallet/wilds-wallet-source-authority";
import type { ReceizIdentityAccountProjection } from "@receiz/sdk";

test("a brand-new Receiz ID wallet is seeded from the user's actual first Wildz data", () => {
  const account: ReceizIdentityAccountProjection = {
    schema: "receiz.sdk.identity_account_projection.v1", keyId: "a".repeat(64), alg: "Ed25519",
    owner: { uid: "owner", email: null, username: "explorer", displayName: "Explorer" },
    accountStateSchema: null, portableStateVerified: false, portableStateStatus: "missing", authority: "identity-only",
    completeAtSealedHead: false, networkRequiredForProjection: false, verifiedState: null, snapshot: null,
    domains: { profile: false, showcase: false, actionLedger: false, calendar: false, contacts: false, wallet: false, sports: false, signalVault: false, media: false, preferences: false, proofHistory: false }
  };
  const wallet = projectWildsWalletFromIdentityAccount(account)!;
  const seed = projectWildsWalletPlayStateSeed(initialPlayState);
  const seeded = seedWildsWalletFromPlayState(wallet, seed);

  assert.equal(seeded.summary.admittedPhiMicro, "0");
  assert.equal(seeded.summary.transferableCardCount, initialPlayState.inventory.length);
  assert.equal(seeded.summary.transferableCardCount, 1);
  assert.equal(seeded.summary.transferableResourceCount, initialPlayState.beans + initialPlayState.fusionSparks + initialPlayState.ascensionCatalysts.length);
  assert.equal(seeded.summary.reservedCardCount, 0);
});
