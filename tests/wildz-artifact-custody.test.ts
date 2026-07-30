import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizOpenedArtifact, ReceizSealedArtifact } from "@receiz/sdk";
import {
  downloadAndReopenWildzArtifact,
  openWildzArtifact,
  type WildzArtifactPort
} from "../src/lib/receiz/wildz-artifact-custody";
import { createReceizCommerceAdapter } from "../src/lib/receiz/adapter";

const encoder = new TextEncoder();
const ARTIFACT_BYTES = encoder.encode("v108-native-record-seal");
const PAYLOAD_BYTES = encoder.encode("wildz-payload");

async function digest(bytes: Uint8Array) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes.slice().buffer)).toString("hex");
}

async function fixture(overrides: { artifactBytes?: Uint8Array; artifactSha256?: string } = {}) {
  const artifactBytes = overrides.artifactBytes ?? ARTIFACT_BYTES;
  const artifactSha256 = overrides.artifactSha256 ?? await digest(artifactBytes);
  const payloadSha256 = await digest(PAYLOAD_BYTES);
  const sealedArtifact = {
    kind: "receiz.native-record-seal",
    artifact: new Blob([artifactBytes.slice().buffer], { type: "application/vnd.receiz.artifact" }),
    filename: "card.receiz",
    mimeType: "application/vnd.receiz.artifact",
    artifactSha256,
    payloadSha256,
    continuity: {
      carrier: "native-record-seal",
      ownerReceizId: "keeper.receiz.id",
      recordId: "record:v108:one",
      claimId: "claim:v108:one",
      verifyPath: "/v/claim-v108-one",
      signatureVersion: 4
    },
    verification: { ok: true, integrity: { ok: true, errors: [] }, kind: "bundle", errors: [], warnings: [], bundle: {} }
  } as unknown as ReceizSealedArtifact;
  const opened = {
    sealedArtifact,
    verifiedPayload: {
      bytes: PAYLOAD_BYTES.slice(),
      filename: "card.png",
      mimeType: "image/png",
      sha256: payloadSha256
    },
    verification: sealedArtifact.verification,
    legacyCompatibility: "current-native"
  } as unknown as ReceizOpenedArtifact;
  return { artifactBytes, artifactSha256, payloadSha256, sealedArtifact, opened };
}

test("opens the complete artifact before exposing its verified payload", async () => {
  const value = await fixture();
  const port: WildzArtifactPort = {
    async verifyAndOpen() { return value.opened; },
    async download() { throw new Error("not_used"); }
  };
  const admitted = await openWildzArtifact(
    new Blob([value.artifactBytes.slice().buffer]),
    "card.receiz",
    port
  );
  assert.deepEqual(admitted.artifactBytes, value.artifactBytes);
  assert.deepEqual(admitted.payloadBytes, PAYLOAD_BYTES);
  assert.equal(admitted.artifactSha256, value.artifactSha256);
  assert.equal(admitted.compatibility, "current-native");
  assert.equal(admitted.recordId, "record:v108:one");
});

test("rejects a one-byte substitution before exposing payload", async () => {
  const value = await fixture({ artifactSha256: await digest(ARTIFACT_BYTES) });
  const changed = ARTIFACT_BYTES.slice();
  changed[changed.length - 1] ^= 1;
  let exposed = false;
  const port: WildzArtifactPort = {
    async verifyAndOpen() { exposed = true; return value.opened; },
    async download() { throw new Error("not_used"); }
  };
  await assert.rejects(
    openWildzArtifact(new Blob([changed.slice().buffer]), "card.receiz", port),
    /wildz_artifact_digest_mismatch/
  );
  assert.equal(exposed, true);
});

test("rejects truncated and concatenated enclosing artifacts", async () => {
  const value = await fixture();
  const port: WildzArtifactPort = {
    async verifyAndOpen() { return value.opened; },
    async download() { throw new Error("not_used"); }
  };
  await assert.rejects(
    openWildzArtifact(new Blob([value.artifactBytes.slice(0, -1).buffer]), "card.receiz", port),
    /wildz_artifact_digest_mismatch/
  );
  const concatenated = new Uint8Array(value.artifactBytes.byteLength + 1);
  concatenated.set(value.artifactBytes);
  concatenated[concatenated.length - 1] = 0xff;
  await assert.rejects(
    openWildzArtifact(new Blob([concatenated.buffer]), "card.receiz", port),
    /wildz_artifact_digest_mismatch/
  );
});

test("download requires exact bytes and a successful reopen", async () => {
  const value = await fixture();
  let reopened = 0;
  const port: WildzArtifactPort = {
    async verifyAndOpen() { reopened += 1; return value.opened; },
    async download() {
      return { ok: true, filename: "card.receiz", mimeType: value.sealedArtifact.mimeType, size: value.artifactBytes.byteLength, artifactSha256: value.artifactSha256 };
    }
  };
  const admitted = await downloadAndReopenWildzArtifact(value.sealedArtifact, port);
  assert.equal(admitted.artifactSha256, value.artifactSha256);
  assert.equal(reopened, 1);

  const bad = await fixture({ artifactSha256: "0".repeat(64) });
  await assert.rejects(
    downloadAndReopenWildzArtifact(bad.sealedArtifact, port),
    /wildz_artifact_download_digest_mismatch/
  );
});

test("the production adapter exposes only current v116 artifact custody operations", () => {
  const adapter = createReceizCommerceAdapter();
  const artifactOperations = adapter as unknown as Record<string, unknown>;
  assert.equal(typeof adapter.verifyAndOpenArtifact, "function");
  assert.equal(typeof adapter.downloadArtifact, "function");
  assert.equal(typeof artifactOperations.admitArtifact, "function");
  assert.equal(typeof artifactOperations.planArtifactRecovery, "function");
  assert.equal(typeof artifactOperations.admitAndRecoverArtifact, "function");
  assert.equal(typeof artifactOperations.commitArtifactRecovery, "function");
  assert.equal(typeof adapter.claimBearerArtifact, "function");
});
