import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { projectWildsWalletPlayStateSeed, seedWildsWalletFromPlayState } from "../src/features/play/wallet/wilds-wallet-play-state";
import { projectWildsWalletFromIdentityAccount } from "../src/features/play/wallet/wilds-wallet-source-authority";
import { RECEIZ_IDENTITY_LOCAL_CONTINUITY_AUTHORITY, type ReceizIdentityAccountProjection } from "@receiz/sdk";

test("a recorded wallet balance is preserved when seeded from the user's actual Wildz inventory", () => {
  const account: ReceizIdentityAccountProjection = {
    schema: "receiz.sdk.identity_account_projection.v1",
    continuity: RECEIZ_IDENTITY_LOCAL_CONTINUITY_AUTHORITY, keyId: "a".repeat(64), alg: "Ed25519",
    owner: { uid: "owner", email: null, username: "explorer", displayName: "Explorer" },
    accountStateSchema: "receiz.account.state.v3", portableStateVerified: true, portableStateStatus: "verified", authority: "verified-identity-portable-state",
    completeAtSealedHead: true, networkRequiredForProjection: false, verifiedState: { wallet: { routeSummary: { balancePhiMicro: "2500000" } } }, snapshot: null,
    domains: { profile: false, showcase: false, actionLedger: false, calendar: false, contacts: false, wallet: true,
      market: false, sports: false, signalVault: false, media: false, preferences: false, proofHistory: false }
  };
  const wallet = projectWildsWalletFromIdentityAccount(account)!;
  const seed = projectWildsWalletPlayStateSeed(initialPlayState);
  const seeded = seedWildsWalletFromPlayState(wallet, seed);

  assert.equal(seeded.summary.admittedPhiMicro, "2500000");
  assert.equal(seeded.summary.transferableCardCount, initialPlayState.inventory.length);
  assert.equal(seeded.summary.transferableCardCount, 1);
  assert.equal(seeded.summary.transferableResourceCount, initialPlayState.beans + initialPlayState.fusionSparks + initialPlayState.ascensionCatalysts.length);
  assert.equal(seeded.summary.reservedCardCount, 0);
});
