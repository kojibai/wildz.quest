import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ReceizProofObjectCreateInput,
  ReceizProofObjectCreateResult
} from "@receiz/sdk";
import {
  embedPortableCardInPng,
  embedPortableVaultInPng,
  verifyPortableVaultPng
} from "../src/features/play/card-export";
import { applyWildsInput, initialPlayState, type PlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { createWildzExportProofObject } from "../src/lib/receiz/wildz-proof-object-export";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function vaultPng(owner = "vault_keeper") {
  const assets = Array.from({ length: 7 }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: owner,
    encounterId: `v103-proof-export-${index}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 22, index)).toISOString()
  }));
  const empty: PlayState = {
    ...structuredClone(initialPlayState),
    inventory: [],
    discoveredCardIds: [],
    pendingSyncAssetIds: [],
    companionProgress: {},
    livingProgress: {},
    selectedAssetId: "",
    selectedCardId: ""
  };
  const playState = assets.reduce(
    (state, asset) => applyWildsInput(state, { type: "import-card", asset }),
    empty
  );
  const player = createWildsPlayerVault({
    playerId: `${owner}.receiz.id`,
    exportedAt: "2026-07-15T22:45:00.000Z",
    playState,
    settings: { avatarStyle: "female", movementMode: "walk", audio: {} },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
  return embedPortableVaultInPng(BASE_PNG, player.playState.inventory, player);
}

function nativeCreateResult(overrides: {
  ownerReceizId?: string;
  claimId?: string;
  verifyPath?: string;
  verifiedClaimId?: string;
  verifiedPath?: string;
  verificationOk?: boolean;
  verificationErrors?: string[];
  carrier?: string;
  artifact?: Blob;
} = {}): ReceizProofObjectCreateResult {
  const claimId = overrides.claimId ?? "wildz-v103-native-claim";
  const verifyPath = overrides.verifyPath ?? "/v/wildz-v103-native-claim";
  return {
    ok: true,
    artifact: overrides.artifact ?? new Blob([
      new TextEncoder().encode("byte-exact-native-record-seal").buffer
    ], { type: "image/png" }),
    verification: {
      ok: overrides.verificationOk ?? true,
      kind: "bundle",
      errors: overrides.verificationErrors ?? [],
      warnings: [],
      bundle: {
        receizClaimId: overrides.verifiedClaimId ?? claimId,
        verifyPath: overrides.verifiedPath ?? verifyPath,
        artifactSha256Basis: "a".repeat(64)
      }
    },
    continuity: {
      ownerReceizId: overrides.ownerReceizId ?? "vault_keeper.receiz.id",
      claimId,
      verifyPath,
      carrier: (overrides.carrier ?? "native-record-seal") as "native-record-seal"
    }
  };
}

test("authenticated v103 native export submits only the validated PNG and returns the Record/Seal artifact byte-exact", async () => {
  const source = vaultPng();
  const nativeBytes = new TextEncoder().encode("native-record-seal-bytes-must-not-be-repacked");
  const nativeArtifact = new Blob([nativeBytes.buffer], { type: "image/png" });
  let capturedInput: ReceizProofObjectCreateInput | null = null;
  let capturedOptions: { idempotencyKey: string; filename?: string } | null = null;
  const created = await createWildzExportProofObject({
    actor: {
      actorId: "vault_keeper",
      profileHandle: "vault_keeper.receiz.id",
      receizUserId: "receiz-user-vault-keeper"
    },
    bytes: source,
    filename: "wilds-vault.png",
    kind: "vault",
    async createProofObject(input, options) {
      capturedInput = input;
      capturedOptions = options;
      return nativeCreateResult({ artifact: nativeArtifact });
    }
  });

  assert.ok(capturedInput);
  const observedInput = capturedInput as ReceizProofObjectCreateInput;
  assert.deepEqual(Object.keys(observedInput).sort(), ["assetType", "payload"]);
  assert.equal(observedInput.assetType, "proof_object");
  assert.equal(observedInput.payload.mimeType, "image/png");
  assert.deepEqual(observedInput.payload.bytes, source);
  assert.equal("ownership" in observedInput, false);
  assert.equal("provenance" in observedInput, false);
  assert.equal("settlement" in observedInput, false);
  const observedOptions = capturedOptions as {
    idempotencyKey: string;
    filename?: string;
  } | null;
  assert.ok(observedOptions);
  assert.deepEqual({
    filename: observedOptions.filename,
    idempotencyKey: observedOptions.idempotencyKey
  }, {
    filename: "wilds-vault.png",
    idempotencyKey: `wildz-v103-${await crypto.subtle.digest("SHA-256", source.slice().buffer).then((value) => Buffer.from(value).toString("hex"))}`
  });
  assert.strictEqual(created.artifact, nativeArtifact);
  assert.deepEqual(new Uint8Array(await created.artifact.arrayBuffer()), nativeBytes);
  assert.equal(created.continuity.carrier, "native-record-seal");
  assert.equal(verifyPortableVaultPng(source).ok, true);
});

test("v103 export rejects native continuity that does not match the authenticated owner, claim, path, or verifier verdict", async () => {
  const source = vaultPng();
  const run = (result: ReceizProofObjectCreateResult) => createWildzExportProofObject({
    actor: {
      actorId: "vault_keeper",
      profileHandle: "vault_keeper.receiz.id",
      receizUserId: "receiz-user-vault-keeper"
    },
    bytes: source,
    filename: "wilds-vault.png",
    kind: "vault",
    createProofObject: async () => result
  });

  await assert.rejects(run(nativeCreateResult({ ownerReceizId: "other.receiz.id" })), /wildz_proof_object_continuity_invalid/);
  await assert.rejects(run(nativeCreateResult({ carrier: "portable_asset" })), /wildz_proof_object_continuity_invalid/);
  await assert.rejects(run(nativeCreateResult({ verifiedClaimId: "spliced-claim" })), /wildz_proof_object_continuity_invalid/);
  await assert.rejects(run(nativeCreateResult({ verifiedPath: "/v/spliced-path" })), /wildz_proof_object_continuity_invalid/);
  await assert.rejects(run(nativeCreateResult({ verificationOk: false })), /wildz_proof_object_continuity_invalid/);
  await assert.rejects(run(nativeCreateResult({ verificationErrors: ["native seal invalid"] })), /wildz_proof_object_continuity_invalid/);
});

test("v103 export validates the local Vault owner before any native proof-object network call", async () => {
  let calls = 0;
  await assert.rejects(createWildzExportProofObject({
    actor: {
      actorId: "other_keeper",
      profileHandle: "other_keeper.receiz.id",
      receizUserId: "receiz-user-other-keeper"
    },
    bytes: vaultPng(),
    filename: "wilds-vault.png",
    kind: "vault",
    async createProofObject() {
      calls += 1;
      return nativeCreateResult();
    }
  }), /wildz_proof_object_owner_mismatch/);
  assert.equal(calls, 0);
});

test("v103 export validates the local card proof and owner before any native proof-object network call", async () => {
  const asset = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "vault_keeper",
    encounterId: "v103-card-owner-guard",
    capturedAt: "2026-07-15T22:50:00.000Z"
  });
  let calls = 0;
  const createProofObject = async () => {
    calls += 1;
    return nativeCreateResult();
  };
  const actor = {
    actorId: "other_keeper",
    profileHandle: "other_keeper.receiz.id",
    receizUserId: "receiz-user-other-keeper"
  };

  await assert.rejects(createWildzExportProofObject({
    actor,
    bytes: BASE_PNG,
    filename: "mintcub.png",
    kind: "card",
    createProofObject
  }), /wilds_png_proof_missing/);
  await assert.rejects(createWildzExportProofObject({
    actor,
    bytes: embedPortableCardInPng(BASE_PNG, asset),
    filename: "mintcub.png",
    kind: "card",
    createProofObject
  }), /wildz_proof_object_owner_mismatch/);
  assert.equal(calls, 0);
});
