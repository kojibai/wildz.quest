import assert from "node:assert/strict";
import { test } from "node:test";
import type { WildzOwnershipReceipt } from "../src/features/market/wildz-market";
import { initialPlayState } from "../src/features/play/game-state";
import { reconcileWildzVaultOwnership } from "../src/features/play/wildz-vault-ownership";
import { canonicalWildzActorId } from "../src/lib/receiz/wildz-identity-repository";
import { advanceWildzMarketState, emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

test("vault reconciliation removes cards admitted to another owner", () => {
  const asset = initialPlayState.inventory[0]!;
  const previousOwner = canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
  const receipt: WildzOwnershipReceipt = {
    schema: "receiz.wilds_ownership_receipt.v1",
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    previousOwnerReceizId: previousOwner,
    ownerReceizId: "new-owner",
    transferId: "bearer:claim:owned-vault",
    ledgerEventId: "bearer-ledger:claim:owned-vault",
    proofBundle: { schema: "receiz.wilds_bearer_claim.v1", custody: "offline-bearer" },
    transferredAt: "2026-07-15T12:00:02.000Z"
  };
  const ownership = advanceWildzMarketState(
    emptyWildzMarketState(),
    { type: "bearer-claim-admitted", asset, receipt },
    { occurredAt: receipt.transferredAt }
  );

  const reconciled = reconcileWildzVaultOwnership(initialPlayState, previousOwner, ownership);

  assert.equal(reconciled.inventory.some((candidate) => candidate.id === asset.id), false);
  assert.notEqual(reconciled.selectedAssetId, asset.id);
  assert.equal(reconciled.pendingSyncAssetIds.includes(asset.id), false);
});
