import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  appendReceizIdentityArtifactTrailerToPng, createReceizIdentityKeyFile,
  readReceizIdentityArtifact, verifyReceizArtifact
} from "@receiz/sdk";
import { signedLocalCardFixture } from "./support/local-seal-fixture";
import { sealWildzCardLocally, openCanonicalWildzCard } from "../src/lib/receiz/local-seal/seal-card";
import { prewarmDocumentSealGroth16Runtime } from "../src/lib/receiz/local-seal/reference/realGroth16ProofClient";
import type { ReceizBundleSignatureV4Signer } from "../src/lib/receiz/local-seal/reference/receizSignatureV4";
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

test("local sealing rejects uncertified signing authority", async () => {
  await assert.rejects(sealWildzCardLocally({ payload: await signedLocalCardFixture(), filename: "card.png", signer: {
    cert: { version: 1, certType: "receiz.device.v1", certId: "invalid", issuerKid: "untrusted", alg: "Ed25519", subjectPublicKeyRawB64u: "invalid", issuedAtMs: 0, expiresAtMs: Date.now() + 10_000, sig: "invalid" },
    sign: async () => { throw new Error("must not sign"); }
  } }), /signer_not_ready/);
});

// Supply an already-enrolled disposable test device. No keys/certificates are
// committed and this test never enrolls a device or contacts a seal server.
test("v126 seals cards, Vaults, identities and maps offline with exact payload continuity", {
  skip: !process.env.WILDZ_TEST_SIGNER_FILE
}, async t => {
  const stored = JSON.parse(await readFile(process.env.WILDZ_TEST_SIGNER_FILE!, "utf8")) as {
    cert: ReceizBundleSignatureV4Signer["cert"]; key: JsonWebKey;
  };
  const key = await crypto.subtle.importKey("jwk", stored.key, "Ed25519", false, ["sign"]);
  const signer: ReceizBundleSignatureV4Signer = {
    cert: stored.cert, sign: async bytes => new Uint8Array(await crypto.subtle.sign("Ed25519", key, bytes.slice().buffer))
  };
  const require = createRequire(import.meta.url);
  const { groth16 } = createRequire(require.resolve("@receiz/sdk"))("snarkjs");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { snarkjs: { groth16: {
    fullProve: (input: unknown, wasm: Uint8Array, zkey: Uint8Array, log: unknown) =>
      groth16.fullProve(input, wasm, zkey, log, undefined, { singleThread: true })
  } } } });
  let calls = 0;
  try {
    // Read pinned resources from disk, then forbid every network request.
    globalThis.fetch = async input => new Response(await readFile(`public${String(input)}`));
    await prewarmDocumentSealGroth16Runtime();
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
      const artifact = await sealWildzCardLocally({ ...row, filename: `${row.kind}.png`, signer, mapOwner: "keeper" });
      const result = await verifyReceizArtifact(artifact.bytes);
      assert.equal(result.status, "verified-artifact", row.kind);
      const opened = await verifyWildzSealedCard(artifact.bytes, row.payload);
      assert.deepEqual(opened.payloadBytes, row.payload);
      assert.equal(opened.ownerReceizId, "keeper.receiz.id");
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
      await assert.rejects(sealWildzCardLocally({ ...row, payload: artifact.bytes, filename: artifact.filename, signer, mapOwner: "keeper" }), /existing_proof_must_be_reused/);
      t.diagnostic(`${row.kind}: canonical pass, exact payload, tamper rejected, ${Math.round(performance.now() - start)}ms including repeated verification`);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
