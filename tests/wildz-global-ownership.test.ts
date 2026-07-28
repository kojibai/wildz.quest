import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { removeWildzAssetsFromActiveVault } from "../src/features/identity/wildz-ownership-reconciliation";

test("custody reconciliation removes active cards but retains their permanent history", () => {
  const asset = initialPlayState.inventory[0]!;
  const state = {
    ...structuredClone(initialPlayState),
    selectedAssetId: asset.id,
    pendingSyncAssetIds: [asset.id],
    hearttreeSquadAssetIds: [asset.id],
    achievements: ["proof-history-remains"]
  };
  const next = removeWildzAssetsFromActiveVault(state, [asset.id]);

  assert.equal(next.inventory.some((candidate) => candidate.id === asset.id), false);
  assert.equal(next.pendingSyncAssetIds.includes(asset.id), false);
  assert.equal(next.hearttreeSquadAssetIds.includes(asset.id), false);
  assert.notEqual(next.selectedAssetId, asset.id);
  assert.deepEqual(next.achievements, ["proof-history-remains"]);
});

test("proof-verified Vault restore is never gated by an online ownership claim", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const restore = shell.indexOf("await restoreWildzFileForSurface(");
  assert.ok(restore >= 0);
  const restoreBoundary = shell.slice(
    shell.indexOf("const restoreArtifact"),
    shell.indexOf("const claimBearerArtifact")
  );
  assert.doesNotMatch(restoreBoundary, /claimVerifiedImportedCards|Global Receiz ownership must be online|\/api\/market\/claims/);
  assert.match(shell, /BroadcastChannel\("receiz:wildz:ownership:v114"\)/);

  const route = readFileSync("app/api/market/claims/route.ts", "utf8");
  assert.match(route, /claimedArtifactResponse\(admitted/);
  assert.match(route, /x-receiz-artifact-sha256/);
  assert.match(route, /marketProjection = "unavailable"/);
});
