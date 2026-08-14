import assert from "node:assert/strict";
import { test } from "node:test";
import { summarizeWildzInventoryImport } from "../src/features/play/inventory-import-result";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import type { WildzCommittedArtifactRestore } from "../src/features/identity/wildz-restore";

test("an artifact reports only its actual new Vault card instead of every embedded verified card", () => {
  const added = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "inventory_counter.receiz.id",
    encounterId: "one-actual-new-card",
    capturedAt: "2026-08-14T14:00:00.000Z"
  });
  const before = structuredClone(initialPlayState);
  const after = applyWildsInput(before, { type: "import-card", asset: added });
  const existingId = before.inventory[0]!.id;

  const summary = summarizeWildzInventoryImport(before, {
    playState: after,
    verifiedAssetIds: [existingId, added.id]
  } as WildzCommittedArtifactRestore);

  assert.deepEqual(summary, {
    addedAssetIds: [added.id],
    updatedAssetIds: []
  });
});
