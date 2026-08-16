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

async function sealed(bytes: Uint8Array, ownerReceizId: string): Promise<ReceizSealedArtifact> {
  const payloadSha256 = await digest(payload);
  const claimId = `claim-${ownerReceizId}`;
  const ownershipWitness = ownerReceizId === "keeper.receiz.id" ? {
    state: "verified",
    carrier: "portable_asset",
    artifactId: payloadSha256,
    headReference: claimId,
    ownerReceizId,
    namespace: `receiz.native-proof:${payloadSha256}`,
    priorHeadReference: "claim-former.receiz.id",
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
        priorHeadReference: "claim-former.receiz.id",
        sourceArtifactSha256: "a".repeat(64),
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
  const original = await sealed(originalBytes, "bearer");
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

test("bearer claim rejects a claimed artifact with a different verified payload", async () => {
  const original = await sealed(originalBytes, "bearer");
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
  const original = await sealed(originalBytes, "bearer");
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
  const original = await sealed(originalBytes, "bearer");
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
