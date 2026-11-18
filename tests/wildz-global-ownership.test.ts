import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import {
  locallyClaimedWildzAssetIds,
  locallyTransferredWildzAssetIds,
  recordLocalWildzOwnershipTransfer,
  removeWildzAssetsFromActiveVault
} from "../src/features/identity/wildz-ownership-reconciliation";
import { wildzVaultUploadDisposition } from "../src/features/identity/wildz-restore";
import {
  parseWildzOwnershipReconcileRequest,
  WILDZ_OWNERSHIP_SYNC_NAMESPACE,
  WILDZ_OWNERSHIP_SYNC_SCHEMA,
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
  assert.match(route, /after\(async \(\) =>/);
  assert.match(route, /claimedArtifactResponse\(admitted, assetIds, "unavailable", ownershipSync\)/);
});

test("a verified same-device bearer transfer removes the card when the previous owner returns", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
  const asset = initialPlayState.inventory[0]!;
  recordLocalWildzOwnershipTransfer(storage, "new_owner.receiz.id", [asset.id], "2026-08-16T12:00:00.000Z");
  assert.deepEqual(locallyTransferredWildzAssetIds(storage, "old_owner.receiz.id", [asset.id]), [asset.id]);
  assert.deepEqual(locallyTransferredWildzAssetIds(storage, "new_owner", [asset.id]), []);
  assert.deepEqual(locallyClaimedWildzAssetIds(storage, "new_owner", [asset.id]), [asset.id]);
  assert.deepEqual(locallyClaimedWildzAssetIds(storage, "old_owner", [asset.id]), []);

  recordLocalWildzOwnershipTransfer(storage, "new_owner.receiz.id", [asset.id], "2026-08-16T12:00:01.000Z", "published");
  assert.deepEqual(locallyClaimedWildzAssetIds(storage, "new_owner", [asset.id]), []);
  assert.deepEqual(locallyTransferredWildzAssetIds(storage, "old_owner", [asset.id]), [asset.id]);
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

test("native routing rows cannot remove a held creature in the active Vault or its reopened save", async () => {
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

  const records = [syncRecord("first.receiz.id", 1, "claim-first"), syncRecord("second.receiz.id", 2, "claim-second")];
  const { verifiedWildzPublishedOwnershipRecords } = await import("../src/lib/receiz/wildz-published-ownership-record");
  const { restorePlayState, serializePlayState } = await import("../src/features/play/game-state");
  const ready = {status: "ready", lostAssetIds: [asset.id], ownershipClaims: records};
  const { latestWildzOwnershipClaims } = await import("../src/lib/receiz/wildz-ownership-reconcile");
  assert.equal(latestWildzOwnershipClaims(records).heads.get(asset.id)?.ownerReceizId, "second.receiz.id");
  const publicRecords = await verifiedWildzPublishedOwnershipRecords(records);
  const { readWildzArtifactCrewCustody, transferredWildzCrewAssetIds } = await import("../src/lib/receiz/wildz-artifact-codec");
  const lost = transferredWildzCrewAssetIds(null, [asset], readWildzArtifactCrewCustody(ready as never));
  const held = {...structuredClone(initialPlayState), selectedAssetId: asset.id, hearttreeSquadAssetIds: [asset.id]};
  const saved = removeWildzAssetsFromActiveVault(held, lost);
  assert.equal(saved, held, "a raw synchronization row cannot rewrite the active save");
  assert.deepEqual(restorePlayState(serializePlayState(saved)).inventory, restorePlayState(serializePlayState(held)).inventory);
  assert.deepEqual(publicRecords, [], "unsigned native ownership hints must not be classified as verified proof");
});

test("owned Vault uploads merge directly while foreign bearer artifacts claim first", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const claimStart = shell.indexOf("const claimAndRestoreVaultArtifact");
  const explicitClaimStart = shell.indexOf("const claimBearerArtifact", claimStart);
  const claimPath = shell.slice(claimStart, explicitClaimStart);

  assert.ok(claimStart >= 0 && explicitClaimStart > claimStart);
  assert.match(claimPath, /authorizeWildsWalletReadWithIdentity/);
  assert.match(claimPath, /"artifact-claim"/);
  assert.match(claimPath, /prepareWildzRestore\(file\)/);
  assert.match(claimPath, /wildzVaultUploadDisposition\(inspection, current\.session\.actorId\)/);
  assert.match(claimPath, /const artifactAssetIds = inspection\.assets\.map/);
  assert.match(claimPath, /disposition === "merge-owned"/);
  assert.match(claimPath, /fetch\("\/api\/market\/claims"/);
  assert.match(claimPath, /openWildzArtifactSameOrigin/);
  assert.match(claimPath, /x-receiz-artifact-sha256/);
  assert.match(claimPath, /downloadBlob/);
  assert.match(claimPath, /restoreArtifact\(\s*claimedFile,\s*"card-vault",\s*true,[\s\S]*"merge-vault"/);
  assert.match(claimPath, /restoreArtifact\(\s*file,\s*"card-vault",\s*true,/);
  assert.ok(claimPath.indexOf("prepareWildzRestore(file)") < claimPath.indexOf('fetch("/api/market/claims"'));
  assert.ok(claimPath.indexOf('disposition === "merge-owned"') < claimPath.indexOf('fetch("/api/market/claims"'));
  assert.doesNotMatch(claimPath, /void reconcileBearerProjection|return baseline|AbortController/);
  assert.match(claimPath, /if \(!response\.ok\)/);
  assert.match(claimPath, /x-wildz-ownership-sync/);
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
  assert.equal(wildzVaultUploadDisposition({ ...base, proofObject: null }, "new-explorer"), "restore-portable");
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

test("active Vault refresh opens exact local bytes and applies the successor to the current keeper", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const reconciliation = shell.slice(
    shell.lastIndexOf("useEffect(() => {", shell.indexOf("const reconcileActiveVaultOwnership")),
    shell.indexOf("useEffect(() => {", shell.indexOf("const reconcileActiveVaultOwnership") + 1)
  );
  assert.match(reconciliation, /startWildzLiveOwnershipRefresh/);
  assert.match(reconciliation, /defaultWildzProofSourceRepository.read/);
  assert.match(reconciliation, /prepareWildzRestore\(file\)/);
  assert.match(reconciliation, /transferredWildzCrewAssetIds\(live.crewCustody/);
  assert.match(reconciliation, /if \(!isCurrent\(\)\) return/);
  assert.doesNotMatch(reconciliation, /fetch\(|\.lostAssetIds|overlay\?\.kind/);
});

test("restoring into another keeper preserves the old Vault until the exact native predecessor transfers", async () => {
  const { createMemoryWildzContinuityDatabase } = await import("./support/memory-wildz-continuity-database");
  const { createWildzIdentityRepository } = await import("../src/lib/receiz/wildz-identity-repository");
  const { createWildzArtifactCodec, transferredWildzCrewAssetIds, readWildzArtifactCrewCustody } = await import("../src/lib/receiz/wildz-artifact-codec");
  const { restoreWildzArtifactForSurface, loadWildzRestoredOwnerState } = await import("../src/features/identity/wildz-restore");
  const { sealCollectedCard } = await import("../src/features/play/portable-card");
  const { embedPortableCardInPng } = await import("../src/features/play/card-export");
  const { sha256WildzArtifactBytes } = await import("../src/lib/receiz/wildz-artifact-custody");
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const base = await repository.bootstrap();
  const keeper = (name: string) => ({ ...base, actorId: name, keyId: name + "-key", username: name });
  const former = keeper("former_keeper"), next = keeper("next_keeper"), observer = keeper("observer");
  let active = former;
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "creator", encounterId: "same-held-object", capturedAt: "2026-08-16T12:00:00.000Z" });
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const payload = embedPortableCardInPng(png, card);
  const bytes = (label: string) => new TextEncoder().encode(JSON.stringify({kind: "receiz.bundle.v1", label}));
  const priorBytes = bytes("prior"), successorBytes = bytes("successor"), siblingBytes = bytes("sibling");
  const priorSha = await sha256WildzArtifactBytes(priorBytes);
  const payloadSha = await sha256WildzArtifactBytes(payload);
  const codec = createWildzArtifactCodec({ identityRepository: repository, commerceVaultReader: {inspect: async () => null},
    artifactOpener: {open: async input => {
      const label = JSON.parse(new TextDecoder().decode(input.bytes)).label;
      const from = label === "prior" ? "creator.receiz.id" : "former_keeper.receiz.id";
      const owner = label === "prior" ? "former_keeper.receiz.id" : "next_keeper.receiz.id";
      const head = "head-" + label;
      return { artifactBytes: input.bytes, artifactSha256: await sha256WildzArtifactBytes(input.bytes), payloadBytes: payload,
        payloadSha256: payloadSha, filename: label + ".receized", mimeType: "image/png", ownerReceizId: owner,
        claimId: head, verifyPath: "/v/" + head, recordId: "card", compatibility: "current-native",
        ownershipWitness: {artifactId: "a".repeat(64), namespace: "native-card", genesisOwnerReceizId: "creator.receiz.id",
          ownerReceizId: owner, previousOwnerReceizId: from, priorHeadReference: label === "prior" ? "genesis" : "head-prior",
          previousArtifactSha256: label === "successor" ? priorSha : "f".repeat(64), appendCount: label === "prior" ? 1 : 2,
          headReference: head, historyDigestSha256: "b".repeat(64), witnessedKaiPulse: "123", witnessedAt: "2026-08-16T12:00:00.000Z"} };
    }} });
  const restore = (input: Uint8Array, mimeType = "application/json") => restoreWildzArtifactForSurface({
    surface: "card-vault", bytes: input, mimeType, codec, database, repository: {...repository, active: async () => active},
    preserveActiveIdentity: true, confirmCardOnly: true
  });
  const old = await restore(priorBytes);
  const read = (session: typeof former) => loadWildzRestoredOwnerState({database, session});
  const before = await read(former);
  assert.ok(before);
  assert.ok(before.playState.inventory.some(asset => asset.id === card.id));
  active = observer;
  await restore(payload, "image/png");
  assert.deepEqual(await read(former), before, "ordinary portable import must preserve another owner's durable state");
  active = next;
  await restore(siblingBytes);
  assert.deepEqual(await read(former), before, "a signed append for a different predecessor cannot prune this card");
  const nextInspection = await codec.inspect({bytes: successorBytes, mimeType: "application/json"});
  const issued = readWildzArtifactCrewCustody(nextInspection);
  assert.deepEqual(transferredWildzCrewAssetIds(old.crewCustody, [card], {...issued!}), [], "a copied token has no admission");
  const transferred = await restore(successorBytes);
  assert.deepEqual(transferred.playState.inventory.find(asset => asset.id === card.id)?.proof, before.playState.inventory.find(asset => asset.id === card.id)?.proof);
  assert.equal((await read(former))?.playState.inventory.some(asset => asset.id === card.id), false);
  assert.ok((await read(observer))?.playState.inventory.some(asset => asset.id === card.id), "an unrelated holder was untouched");
});
