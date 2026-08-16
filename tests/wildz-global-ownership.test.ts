import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { removeWildzAssetsFromActiveVault } from "../src/features/identity/wildz-ownership-reconciliation";
import { wildzVaultUploadDisposition } from "../src/features/identity/wildz-restore";
import {
  lostWildzOwnershipAssetIdsFromSync,
  parseWildzOwnershipReconcileRequest,
  WILDZ_OWNERSHIP_SYNC_NAMESPACE,
  WILDZ_OWNERSHIP_SYNC_SCHEMA,
  WILDZ_OWNERSHIP_RECONCILE_INTERVAL_MS,
  WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS
} from "../src/lib/receiz/wildz-ownership-reconcile";

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

test("same-device ownership broadcasts retain active-custody removal", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.match(shell, /BroadcastChannel\("receiz:wildz:ownership:v119"\)/);

  const route = readFileSync("app/api/market/claims/route.ts", "utf8");
  assert.match(route, /claimedArtifactResponse\(admitted/);
  assert.match(route, /x-receiz-artifact-sha256/);
  assert.match(route, /marketProjection = "unavailable"/);
});

test("ownership reconciliation requests are exact and bounded", () => {
  const asset = initialPlayState.inventory[0]!;

  assert.deepEqual(
    parseWildzOwnershipReconcileRequest({ assetIds: [asset.id, asset.id, "wilds:aaaaaaaaaaaaaaaaaaaaaaaa"] }),
    [asset.id, "wilds:aaaaaaaaaaaaaaaaaaaaaaaa"]
  );
  assert.throws(() => parseWildzOwnershipReconcileRequest({ assetIds: [] }), /wildz_ownership_reconcile_request_invalid/);
  assert.throws(() => parseWildzOwnershipReconcileRequest({ assetIds: [asset.id], ownerActorId: "formerowner" }), /wildz_ownership_reconcile_request_invalid/);
  assert.throws(() => parseWildzOwnershipReconcileRequest({
    assetIds: Array.from({ length: WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS + 1 }, (_, index) => `wilds:${index.toString(16).padStart(24, "0")}`)
  }), /wildz_ownership_reconcile_request_invalid/);
});

test("v119 app-state reconciliation treats the server record as sync-only", () => {
  const asset = initialPlayState.inventory[0]!;
  const syncRecord = (ownerReceizId: string, appendCount: number, headReference: string) => ({
    namespace: WILDZ_OWNERSHIP_SYNC_NAMESPACE,
    schema: WILDZ_OWNERSHIP_SYNC_SCHEMA,
    state: "published",
    data: {
      schema: WILDZ_OWNERSHIP_SYNC_SCHEMA,
      assetId: asset.id,
      artifactId: "a".repeat(64),
      previousOwnerReceizId: "former.receiz.id",
      ownerReceizId,
      headReference,
      historyDigestSha256: appendCount === 1 ? "b".repeat(64) : "c".repeat(64),
      appendCount,
      witnessedKaiPulse: `13661${appendCount}`,
      witnessedAt: `2026-08-16T12:00:0${appendCount}.000Z`,
      authority: {
        claim: "witnessed-kai-pulse-in-sealed-artifact",
        server: "synchronization-projection-only"
      }
    }
  });

  assert.deepEqual(lostWildzOwnershipAssetIdsFromSync(
    [syncRecord("first.receiz.id", 1, "claim-first"), syncRecord("second.receiz.id", 2, "claim-second")],
    "first.receiz.id",
    [asset.id]
  ), [asset.id]);
  assert.deepEqual(lostWildzOwnershipAssetIdsFromSync(
    [syncRecord("first.receiz.id", 1, "claim-first"), syncRecord("second.receiz.id", 2, "claim-second")],
    "second.receiz.id",
    [asset.id]
  ), []);
  assert.deepEqual(lostWildzOwnershipAssetIdsFromSync(
    [syncRecord("second.receiz.id", 2, "claim-second"), syncRecord("third.receiz.id", 2, "claim-divergent")],
    "first.receiz.id",
    [asset.id]
  ), []);
});

test("owned Vault uploads merge directly while foreign bearer artifacts claim first", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const claimStart = shell.indexOf("const claimAndRestoreVaultArtifact");
  const explicitClaimStart = shell.indexOf("const claimBearerArtifact", claimStart);
  const claimPath = shell.slice(claimStart, explicitClaimStart);

  assert.ok(claimStart >= 0 && explicitClaimStart > claimStart);
  assert.match(claimPath, /proofSessionConnected/);
  assert.match(claimPath, /inspectWildzRestore\(file\)/);
  assert.match(claimPath, /wildzVaultUploadDisposition\(inspection, current\.session\.actorId\)/);
  assert.match(claimPath, /disposition === "merge-owned"/);
  assert.match(claimPath, /fetch\("\/api\/market\/claims"/);
  assert.match(claimPath, /openWildzArtifactSameOrigin/);
  assert.match(claimPath, /x-receiz-artifact-sha256/);
  assert.match(claimPath, /downloadBlob/);
  assert.match(claimPath, /restoreArtifact\(\s*claimedFile,[\s\S]*"merge-vault"/);
  assert.match(claimPath, /restoreArtifact\(\s*file,/);
  assert.ok(claimPath.indexOf("inspectWildzRestore(file)") < claimPath.indexOf('fetch("/api/market/claims"'));
  assert.ok(claimPath.indexOf('disposition === "merge-owned"') < claimPath.indexOf('fetch("/api/market/claims"'));
  const claimedRestore = claimPath.indexOf("restoreArtifact(", claimPath.indexOf("const claimedFile"));
  assert.ok(claimPath.indexOf('fetch("/api/market/claims"') < claimedRestore);

  assert.match(shell, /onRestoreArtifact=\{claimAndRestoreVaultArtifact\}/);
  assert.match(shell, /onAddVault=\{async \(file\) => \{[\s\S]*claimAndRestoreVaultArtifact\(file/);

  const activation = shell.slice(shell.indexOf("const activateIdentitySeal"), claimStart);
  assert.match(activation, /restoreArtifact\([\s\S]*"activate-identity"/);
  assert.doesNotMatch(activation, /claimAndRestoreVaultArtifact/);

  const explicitClaim = shell.slice(explicitClaimStart, shell.indexOf("const persistPlayState", explicitClaimStart));
  assert.match(explicitClaim, /window\.confirm/);
  assert.match(explicitClaim, /claimAndRestoreVaultArtifact\(\s*file/);
});

test("Vault upload disposition treats bearer claiming as transfer-only", () => {
  const asset = initialPlayState.inventory[0]!;
  const base = {
    kind: "card-vault" as const,
    assets: [asset],
    vaultDigest: "sha256:" + "a".repeat(64),
    player: null,
    playerBinding: null,
    identity: null
  };
  assert.equal(wildzVaultUploadDisposition({ ...base, proofObject: null }, asset.manifest.ownerReceizId), "merge-owned");
  assert.equal(wildzVaultUploadDisposition({
    ...base,
    proofObject: {
      schema: "receiz.wildz.verified_artifact.v119",
      compatibility: "current-native",
      ownerReceizId: asset.manifest.ownerReceizId,
      custody: "v119-verified-artifact",
      proofRef: "proof-ref",
      provenanceRoot: "root",
      payloadSha256: "a".repeat(64),
      payloadMimeType: "image/png",
      artifactBasisSha256: "b".repeat(64),
      artifactBytes: new Uint8Array([1]),
      proofClaimId: "claim"
    }
  }, asset.manifest.ownerReceizId), "merge-owned");
  assert.equal(wildzVaultUploadDisposition({
    ...base,
    proofObject: {
      schema: "receiz.wildz.verified_artifact.v119",
      compatibility: "current-native",
      ownerReceizId: "another.receiz.id",
      custody: "v119-verified-artifact",
      proofRef: "proof-ref",
      provenanceRoot: "root",
      payloadSha256: "a".repeat(64),
      payloadMimeType: "image/png",
      artifactBasisSha256: "b".repeat(64),
      artifactBytes: new Uint8Array([1]),
      proofClaimId: "claim"
    }
  }, asset.manifest.ownerReceizId), "claim-bearer");
});

test("cross-device active Vault invalidation checks the admitted projection every two seconds", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");

  assert.equal(WILDZ_OWNERSHIP_RECONCILE_INTERVAL_MS, 2_000);
  assert.match(shell, /const removeLostVaultAssets = useCallback/);
  assert.match(shell, /removeWildzAssetsFromActiveVault/);
  assert.match(shell, /kind:\s*"vault"/);
  assert.match(shell, /proofSessionConnected/);
  assert.match(shell, /document\.visibilityState === "hidden"/);
  assert.match(shell, /reconcileInFlight/);
  assert.match(shell, /fetch\("\/api\/market\/ownership\/reconcile"/);
  assert.match(shell, /JSON\.stringify\(\{\s*assetIds\s*\}\)/);
  assert.match(shell, /removeLostVaultAssets\(result\.lostAssetIds(?: as string\[\])?\)/);
  assert.match(shell, /window\.setInterval\([\s\S]*WILDZ_OWNERSHIP_RECONCILE_INTERVAL_MS/);
  assert.match(shell, /window\.addEventListener\("focus"/);
  assert.match(shell, /document\.addEventListener\("visibilitychange"/);
  assert.match(shell, /window\.removeEventListener\("focus"/);
  assert.match(shell, /document\.removeEventListener\("visibilitychange"/);
});
