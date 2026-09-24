import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng, createReceizIdentityKeyFile,
  readReceizIdentityArtifact, verifyReceizArtifact
} from "@receiz/sdk";
import { signedLocalCardFixture } from "./support/local-seal-fixture";
import { sealWildzCardLocally, openCanonicalWildzCard } from "../src/lib/receiz/local-seal/seal-card";
import { createReceizOfflineSealer, createReceizMemorySealStore } from "@receiz/sdk/offline";
import { createReceizNodeOfflineSealer } from "@receiz/sdk/offline/node";
import { withWildzPngPayloadChunk } from "../src/features/play/card-export";
import { embedWildsMapInPng, readWildsMapFromPng } from "../src/features/play/wilds-map-image";
import { verifyWildzSealedCard } from "../src/lib/receiz/wildz-sealed-card";
import { createWildzArtifactCodec } from "../src/lib/receiz/wildz-artifact-codec";
import { openWildzArtifactSameOrigin } from "../src/lib/receiz/wildz-same-origin-verifier";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));

test("an inner signature cannot replace a canonical proof bundle", async () => {
  await assert.rejects(openCanonicalWildzCard(await signedLocalCardFixture()), /verification_failed/);
});

test("local sealing requires enrolled canonical signing authority", async () => {
  const sealer = createReceizOfflineSealer({ store: createReceizMemorySealStore(),
    resources: { wasm: new Uint8Array(), zkey: new Uint8Array() } });
  await assert.rejects(sealer.seal({ bytes: png, filename: "card.png" }), /enrollment_required/);
});

// Supply an already-enrolled disposable test device. No keys/certificates are
// committed and this test never enrolls a device or contacts a seal server.
test("v127 seals cards, Vaults, identities and maps offline with exact payload continuity", {
  skip: !process.env.WILDZ_TEST_SEAL_DIRECTORY
}, async t => {
  const sealer = await createReceizNodeOfflineSealer({ directory: process.env.WILDZ_TEST_SEAL_DIRECTORY! });
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw new Error("network_disabled"); };
    const identity = await createReceizIdentityKeyFile({ owner: { uid: "offline-fixture", username: "keeper" } });
    const atlas = { version: 1 as const, rows: [{ z: 0, ranges: [{ minX: 0, maxX: 4 }] }], siteKeys: [] };
    const rows = [
      { kind: "card" as const, payload: await signedLocalCardFixture() },
      { kind: "vault" as const, payload: await signedLocalCardFixture() },
      { kind: "identity" as const, payload: appendReceizIdentityArtifactTrailerToPng(png, identity.keyFile) },
      { kind: "map" as const, payload: embedWildsMapInPng(png, atlas) }
    ];
    for (const row of rows) {
      const start = performance.now();
      const artifact = await sealWildzCardLocally({ ...row, filename: `${row.kind}.png`, sealer, mapOwner: "keeper" });
      const result = await verifyReceizArtifact(artifact.bytes);
      assert.equal(result.status, "verified-artifact", row.kind);
      const opened = await verifyWildzSealedCard(artifact.bytes, row.payload);
      assert.deepEqual(opened.payloadBytes, row.payload);
      assert.equal(opened.ownerReceizId, null, "a document seal does not mint native ownership");
      if (row.kind === "map") assert.deepEqual(readWildsMapFromPng(opened.payloadBytes), atlas);
      else {
        assert.equal((await readReceizIdentityArtifact(artifact.bytes)).keyId,
          (await readReceizIdentityArtifact(opened.payloadBytes)).keyId,
          "cross-platform SDK reads the identity directly from the sealed PNG");
      }
      if (row.kind !== "map") {
        const codec = createWildzArtifactCodec({ artifactOpener: { open: openWildzArtifactSameOrigin },
          identityRepository: createWildzIdentityRepository({ database: createMemoryWildzContinuityDatabase() }),
          commerceVaultReader: { inspect: async () => null } });
        const imported = await codec.inspect({ bytes: artifact.bytes, mimeType: artifact.mimeType, name: artifact.filename });
        assert.equal(imported.kind, row.kind === "identity" ? "identity-seal" : "card-vault");
        if (imported.kind === "card-vault") assert.equal(imported.assets.length, 1);
      }
      await assert.rejects(openCanonicalWildzCard(withWildzPngPayloadChunk(artifact.bytes, "another.application", "forged")));
      await assert.rejects(sealWildzCardLocally({ ...row, payload: artifact.bytes, filename: artifact.filename, sealer, mapOwner: "keeper" }), /existing_proof_must_be_reused/);
      t.diagnostic(`${row.kind}: canonical pass, exact payload, tamper rejected, ${Math.round(performance.now() - start)}ms including repeated verification`);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
