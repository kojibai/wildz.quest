import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizOpenedArtifact, ReceizSealedArtifact } from "@receiz/sdk";
import { claimWildzBearerArtifact } from "../src/lib/receiz/wildz-bearer-ownership";

const payload = new TextEncoder().encode("owned-payload");
const originalBytes = new TextEncoder().encode("original-artifact");
const claimedBytes = new TextEncoder().encode("claimed-artifact");

async function digest(bytes: Uint8Array) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)).toString("hex");
}

async function sealed(bytes: Uint8Array, ownerReceizId: string, priorSha?: string, priorHead = "claim-former.receiz.id"): Promise<ReceizSealedArtifact> {
  const payloadSha256 = await digest(payload);
  const claimId = `claim-${ownerReceizId}`;
  const ownershipWitness = ownerReceizId === "keeper.receiz.id" ? {
    state: "verified",
    carrier: "portable_asset",
    artifactId: payloadSha256,
    headReference: claimId,
    ownerReceizId,
    namespace: `receiz.native-proof:${payloadSha256}`,
    priorHeadReference: priorHead,
    genesisOwnerReceizId: "former.receiz.id",
    historyDigestSha256: "c".repeat(64),
    appendCount: 1,
    historyComplete: true,
    history: [
      {
        schema: "receiz.native_ownership_genesis.v1",
        index: 0,
        ownerReceizId: "former.receiz.id",
        headReference: "claim-former.receiz.id",
        historyDigestSha256: "b".repeat(64)
      },
      {
        schema: "receiz.native_ownership_transfer.v1",
        index: 1,
        fromOwnerReceizId: "former.receiz.id",
        toOwnerReceizId: ownerReceizId,
        priorHeadReference: priorHead,
        sourceArtifactSha256: priorSha ?? await digest(originalBytes),
        headReference: claimId,
        historyDigestSha256: "c".repeat(64)
      }
    ]
  } : undefined;
  return {
    kind: "receiz.native-record-seal",
    artifact: new Blob([bytes.slice().buffer], { type: "application/vnd.receiz.artifact" }),
    filename: "owned.receized",
    mimeType: "application/json",
    artifactSha256: await digest(bytes),
    payloadSha256,
    continuity: {
      carrier: "native-record-seal",
      ownerReceizId,
      recordId: "record-owned",
      claimId,
      verifyPath: `/v/claim-${ownerReceizId}`,
      signatureVersion: 4
    },
    verification: {
      ok: true,
      integrity: { ok: true, errors: [] },
      kind: "bundle",
      errors: [],
      warnings: [],
      bundle: ownerReceizId === "keeper.receiz.id" ? {
        kaiPulseEternal: "13661156000000",
        ts: "2026-08-16T04:24:45.768Z",
        nativeRecordSeal: {
          ownershipContinuity: {
            schema: "receiz.native_ownership_continuity.v1",
            artifactId: payloadSha256,
            namespace: `receiz.native-proof:${payloadSha256}`,
            genesisOwnerReceizId: "former.receiz.id",
            ownerReceizId,
            headReference: claimId,
            historyDigestSha256: "c".repeat(64),
            appendCount: 1
          }
        }
      } : {},
      assetContinuity: ownershipWitness
    }
  } as unknown as ReceizSealedArtifact;
}

async function opened(value: ReceizSealedArtifact): Promise<ReceizOpenedArtifact> {
  return {
    sealedArtifact: value,
    verifiedPayload: {
      bytes: payload.slice(),
      filename: "payload.json",
      mimeType: "application/json",
      sha256: await digest(payload)
    },
    verification: value.verification,
    legacyCompatibility: "current-native"
  } as unknown as ReceizOpenedArtifact;
}

test("bearer ownership submits only the SDK-opened sealed artifact and reopens the claimed result", async () => {
  const original = await sealed(originalBytes, "former.receiz.id");
  const claimed = await sealed(claimedBytes, "keeper.receiz.id");
  let claimInput: ReceizOpenedArtifact["sealedArtifact"] | null = null;
  const result = await claimWildzBearerArtifact(original.artifact, original.filename, {
    artifacts: {
      async verifyAndOpen(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return opened(bytes.byteLength === originalBytes.byteLength ? original : claimed);
      },
      async download(artifact) {
        return {
          ok: true,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          size: artifact.artifact.size,
          artifactSha256: artifact.artifactSha256
        };
      }
    },
    ownership: {
      async claimBearerAsset(input) {
        claimInput = input.artifact;
        return claimed;
      }
    }
  });

  assert.equal(claimInput, original);
  assert.equal(result.ownerReceizId, "keeper.receiz.id");
  assert.equal(result.artifactSha256, claimed.artifactSha256);
  assert.equal(result.ownershipWitness?.previousOwnerReceizId, "former.receiz.id");
  assert.equal(result.ownershipWitness?.witnessedKaiPulse, "13661156000000");
  assert.equal(result.ownershipWitness?.witnessedAt, "2026-08-16T04:24:45.768Z");
  assert.deepEqual(result.artifactBytes, claimedBytes);
});

test("an otherwise verified response must append the exact opened predecessor bytes and head", async () => {
  const original = await sealed(originalBytes, "former.receiz.id");
  for (const [priorSha, priorHead] of [["f".repeat(64), original.continuity.claimId], [original.artifactSha256, "another-head"]]) {
    const claimed = await sealed(claimedBytes, "keeper.receiz.id", priorSha, priorHead);
    await assert.rejects(claimWildzBearerArtifact(original.artifact, original.filename, {
      artifacts: {
        async verifyAndOpen(file) { return opened(file.size === originalBytes.byteLength ? original : claimed); },
        async download(artifact) { return {ok: true, filename: artifact.filename, mimeType: artifact.mimeType, size: artifact.artifact.size, artifactSha256: artifact.artifactSha256}; }
      },
      ownership: {claimBearerAsset: async () => claimed}
    }), /wildz_bearer_claim_binding_mismatch/);
  }
});

test("the SDK ownership append changes the document while preserving the exact carried card", async () => {
  const { appendReceizPortableAssetOwnership, serializeReceizPortableAssetDocument } = await import("@receiz/sdk");
  const { prepareWildsPortableDocumentV128 } = await import("../src/lib/receiz/wilds-portable-document-v128");
  const { readWildzArtifactCardPayload } = await import("../src/lib/receiz/wildz-artifact-custody");
  const { extractVerifiedWildzCards } = await import("../src/lib/receiz/wildz-cross-platform-cards");
  const { sealCollectedCard } = await import("../src/features/play/portable-card");
  const { embedPortableCardInPng } = await import("../src/features/play/card-export");
  const card = sealCollectedCard({formId: "mintcub-1", ownerReceizId: "former", encounterId: "generic-claim", capturedAt: "2026-08-16T12:00:00.000Z"});
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const media = embedPortableCardInPng(png, card);
  const prior = await sealed(originalBytes, "former.receiz.id");
  const next = await sealed(claimedBytes, "keeper.receiz.id");
  const document = await prepareWildsPortableDocumentV128({assetType: "proof_object", payload: {bytes: media, mimeType: "image/png"},
    ownership: {ownerReceizId: prior.continuity.ownerReceizId, custody: "bearer", proofRef: "genesis"},
    provenance: {root: "wildz:generic-test", appends: []}, settlement: {state: "none"}});
  const appended = await appendReceizPortableAssetOwnership(document, {ownerReceizId: next.continuity.ownerReceizId,
    sourceArtifactSha256: prior.artifactSha256, priorHeadReference: prior.continuity.claimId});
  const before = serializeReceizPortableAssetDocument(document), after = serializeReceizPortableAssetDocument(appended);
  const source = {...prior, payloadSha256: await digest(before)};
  const accepted = {...next, payloadSha256: await digest(after)};
  const result = await claimWildzBearerArtifact(source.artifact, source.filename, {
    artifacts: {
      async verifyAndOpen(file) {
        const [artifact, content] = file.size === originalBytes.byteLength ? [source, before] as const : [accepted, after] as const;
        const openedArtifact = await opened(artifact);
        return {...openedArtifact, verifiedPayload: {...openedArtifact.verifiedPayload, bytes: content, sha256: artifact.payloadSha256}};
      },
      async download(artifact) { return {ok: true, filename: artifact.filename, mimeType: artifact.mimeType, size: artifact.artifact.size, artifactSha256: artifact.artifactSha256}; }
    }, ownership: {claimBearerAsset: async () => accepted}
  });
  assert.notEqual(result.payloadSha256, source.payloadSha256);
  assert.deepEqual(result.payloadBytes, after);
  const content = await readWildzArtifactCardPayload(result);
  assert.deepEqual(content, {bytes: media, mimeType: "image/png"});
  assert.deepEqual(extractVerifiedWildzCards({pngBasis: null, verifiedPortableSnapshot: null, restoredVaultFiles: [], proofObjectPayload: content}).assets, [card]);
});

test("bearer claim rejects a claimed artifact with a different verified payload", async () => {
  const original = await sealed(originalBytes, "former.receiz.id");
  const claimed = await sealed(claimedBytes, "keeper.receiz.id");
  await assert.rejects(claimWildzBearerArtifact(original.artifact, original.filename, {
    artifacts: {
      async verifyAndOpen(file) {
        const value = new Uint8Array(await file.arrayBuffer());
        const result = await opened(value.byteLength === originalBytes.byteLength ? original : claimed);
        if (value.byteLength === claimedBytes.byteLength) {
          const other = new TextEncoder().encode("other-payload");
          return {
            ...result,
            verifiedPayload: {
              bytes: other,
              filename: "payload.json",
              mimeType: "application/json",
              sha256: await digest(other)
            },
            sealedArtifact: { ...claimed, payloadSha256: await digest(other) }
          } as unknown as ReceizOpenedArtifact;
        }
        return result;
      },
      async download(artifact) {
        return {
          ok: true,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          size: artifact.artifact.size,
          artifactSha256: artifact.artifactSha256
        };
      }
    },
    ownership: { claimBearerAsset: async () => claimed }
  }), /wildz_artifact_round_trip_failed/);
});

test("bearer claim rejects a server-shaped result without the verified witnessed Kai ownership append", async () => {
  const original = await sealed(originalBytes, "former.receiz.id");
  const claimed = await sealed(claimedBytes, "keeper.receiz.id");
  const unwitnessed = {
    ...claimed,
    verification: { ...claimed.verification, bundle: {}, assetContinuity: undefined }
  } as unknown as ReceizSealedArtifact;

  await assert.rejects(claimWildzBearerArtifact(original.artifact, original.filename, {
    artifacts: {
      async verifyAndOpen(file) {
        const value = new Uint8Array(await file.arrayBuffer());
        return opened(value.byteLength === originalBytes.byteLength ? original : unwitnessed);
      },
      async download(artifact) {
        return {
          ok: true,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          size: artifact.artifact.size,
          artifactSha256: artifact.artifactSha256
        };
      }
    },
    ownership: { claimBearerAsset: async () => unwitnessed }
  }), /wildz_bearer_claim_binding_mismatch/);
});

test("bearer claim rejects an ownership projection that is absent from the signed native seal", async () => {
  const original = await sealed(originalBytes, "former.receiz.id");
  const claimed = await sealed(claimedBytes, "keeper.receiz.id");
  const projectedOnly = {
    ...claimed,
    verification: {
      ...claimed.verification,
      bundle: {
        ...claimed.verification.bundle,
        nativeRecordSeal: {}
      }
    }
  } as unknown as ReceizSealedArtifact;

  await assert.rejects(claimWildzBearerArtifact(original.artifact, original.filename, {
    artifacts: {
      async verifyAndOpen(file) {
        const value = new Uint8Array(await file.arrayBuffer());
        return opened(value.byteLength === originalBytes.byteLength ? original : projectedOnly);
      },
      async download(artifact) {
        return {
          ok: true,
          filename: artifact.filename,
          mimeType: artifact.mimeType,
          size: artifact.artifact.size,
          artifactSha256: artifact.artifactSha256
        };
      }
    },
    ownership: { claimBearerAsset: async () => projectedOnly }
  }), /wildz_bearer_claim_binding_mismatch/);
});
