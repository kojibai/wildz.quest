import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  createReceizIdentityKeyFile,
  createReceizProofMemory,
  createReceizProofRegister,
  parseReceizIdentityArtifactText,
  projectReceizIdentityAccount,
  projectReceizAssetManifest,
  projectReceizSportsCardManifest,
  serializeReceizIdentityArtifact,
  type ReceizProofRegisterSnapshot
} from "@receiz/sdk";
import {
  createLegacyReceizPortableAssetDocument,
  parseLegacyReceizPortableAssetDocument,
  serializeLegacyReceizPortableAssetDocument
} from "../src/lib/receiz/legacy-receiz-portable-asset";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

// v102 compatibility includes deliberate readback of earlier proof-memory
// snapshots; those fixtures remain named for their original source version.

function runtimeSourceText(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return runtimeSourceText(path);
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
    })
    .join("\n");
}

test("SDK identity serialization keeps key continuity and underscores through Wildz persistence", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const created = await createReceizIdentityKeyFile({
    owner: {
      uid: "receiz_v100_compatibility",
      username: "trail__keeper_101",
      displayName: "Trail Keeper"
    },
    portableState: {
      schema: "receiz.account.state.v3",
      snapshot: {
        schema: "receiz.account.state.v3",
        proofObject: {
          schema: "receiz.wildz.compatibility_proof.v1",
          digestSha256Hex: "a".repeat(64)
        }
      }
    }
  });
  const serialized = serializeReceizIdentityArtifact(created.keyFile);
  const parsed = parseReceizIdentityArtifactText(serialized);
  const projection = await projectReceizIdentityAccount(parsed);

  assert.equal(parsed.schema, "receiz.key.v1");
  assert.equal(parsed.version, 1);
  assert.equal(projection.keyId, created.keyId);
  assert.equal(projection.owner.username, "trail__keeper_101");
  assert.equal(projection.portableStateStatus, "verified");
  assert.deepEqual(projection.snapshot, created.keyFile.portableState?.snapshot);

  const prepared = await repository.prepare(parsed);
  await database.transaction(["identities", "ownerStates", "meta"], "readwrite", (tx) =>
    repository.writePrepared(tx, prepared, true)
  );

  const coldRepository = createWildzIdentityRepository({ database });
  const coldSession = await coldRepository.active();
  assert.equal(coldSession?.keyId, created.keyId);
  assert.equal(coldSession?.username, "trail__keeper_101");
  await coldRepository.withKeyFile(created.keyId, async (keyFile) => {
    assert.equal(keyFile.keyId, created.keyId);
    assert.equal(keyFile.owner.username, "trail__keeper_101");
    assert.equal(keyFile.crypto.publicKeyRawB64u, created.keyFile.crypto.publicKeyRawB64u);
    assert.equal(serializeReceizIdentityArtifact(keyFile), serialized);
  });
});

test("a v100 proof-register snapshot stores and reloads without proof-object drift", async () => {
  const timestamp = "2026-07-15T15:00:00.000Z";
  const proofObject = {
    schema: "receiz.wildz.compatibility_proof.v1",
    digestSha256Hex: "b".repeat(64),
    sourceVersion: 100
  };
  const snapshot = {
    schema: "receiz.sdk.proof_register.v1",
    ownerId: "wildz_v100_proof_owner",
    createdAt: timestamp,
    updatedAt: timestamp,
    head: {
      entryId: "wildz-proof-v100",
      kaiUpulse: null,
      createdAt: timestamp,
      count: 1
    },
    entries: [{
      id: "wildz-proof-v100",
      kind: "receiz.app.commerce_event.v1",
      createdAt: timestamp,
      proof: proofObject,
      payload: {
        schema: "receiz.app.commerce_event.v1",
        id: "wildz-proof-v100",
        type: "checkout.settled",
        createdAt: timestamp,
        tenantHost: "wildz.quest",
        merchantReceizId: "wildz_v100_proof_owner",
        data: { orderId: "compatibility-order" }
      },
      projection: null
    }]
  } satisfies ReceizProofRegisterSnapshot;
  let stored: ReceizProofRegisterSnapshot | null = null;
  const storage = {
    read: () => JSON.stringify(snapshot),
    write(value: ReceizProofRegisterSnapshot) {
      stored = structuredClone(value);
    }
  };

  const first = await createReceizProofMemory({
    ownerId: snapshot.ownerId ?? undefined,
    storage,
    autoPersist: false
  });
  const firstSnapshot = first.snapshot();
  assert.equal(firstSnapshot.schema, snapshot.schema);
  assert.equal(firstSnapshot.ownerId, snapshot.ownerId);
  assert.equal(firstSnapshot.head.entryId, snapshot.head.entryId);
  assert.equal(firstSnapshot.head.count, snapshot.head.count);
  assert.deepEqual(firstSnapshot.entries[0]?.payload, snapshot.entries[0]?.payload);
  assert.deepEqual(firstSnapshot.entries[0]?.proof, proofObject);
  await first.persist();
  const persisted = stored as ReceizProofRegisterSnapshot | null;
  assert.ok(persisted);
  assert.deepEqual(persisted.entries[0]?.payload, snapshot.entries[0]?.payload);
  assert.deepEqual(persisted.entries[0]?.proof, proofObject);

  const second = await createReceizProofMemory({
    ownerId: snapshot.ownerId ?? undefined,
    storage: {
      read: () => stored,
      write(value) {
        stored = structuredClone(value);
      }
    },
    autoPersist: false
  });
  const secondSnapshot = second.snapshot();
  assert.equal(secondSnapshot.schema, firstSnapshot.schema);
  assert.equal(secondSnapshot.ownerId, firstSnapshot.ownerId);
  assert.equal(secondSnapshot.head.entryId, firstSnapshot.head.entryId);
  assert.equal(secondSnapshot.head.count, firstSnapshot.head.count);
  assert.deepEqual(secondSnapshot.entries[0]?.payload, firstSnapshot.entries[0]?.payload);
  assert.deepEqual(secondSnapshot.entries[0]?.proof, proofObject);
  assert.deepEqual(second.entries().map((entry) => entry.payload), [snapshot.entries[0]?.payload]);
});

test("v102 portable proof-object serialization retains payload ownership provenance and settlement", async () => {
  const payloadBytes = new TextEncoder().encode(JSON.stringify({
    schema: "receiz.wildz.public_proof_fixture.v1",
    proof: { digestSha256Hex: "d".repeat(64) }
  }));
  const document = await createLegacyReceizPortableAssetDocument({
    assetType: "proof_object",
    payload: { mimeType: "application/json", bytes: payloadBytes },
    ownership: {
      ownerReceizId: "wildz_public_fixture_owner",
      custody: "current",
      proofRef: "wildz-public-fixture-genesis"
    },
    provenance: {
      root: "wildz-public-fixture-genesis",
      appends: [{
        schema: "receiz.wildz.public_append.v1",
        sequence: 1,
        digestSha256Hex: "e".repeat(64)
      }]
    },
    settlement: {
      state: "none",
      primitive: "public-test-fixture"
    }
  });
  const serialized = serializeLegacyReceizPortableAssetDocument(document);
  const parsed = await parseLegacyReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(serialized)));
  assert.deepEqual(parsed, document);
  assert.deepEqual(serializeLegacyReceizPortableAssetDocument(parsed), serialized);

  assert.equal(parsed.assetType, "proof_object");
  assert.equal(parsed.ownership.ownerReceizId, "wildz_public_fixture_owner");
  assert.equal(parsed.provenance.appends.length, 1);
  assert.equal(parsed.settlement.state, "none");
});

test("v102 keeps valid manifests inspection-only instead of admitting incomplete proof truth", async () => {
  const fixtures = [
    {
      value: JSON.parse(readFileSync("node_modules/@receiz/sdk/fixtures/receiz-asset-manifest.example.json", "utf8")),
      project: projectReceizAssetManifest
    },
    {
      value: JSON.parse(readFileSync("node_modules/@receiz/sdk/fixtures/receiz-sports-card-manifest.example.json", "utf8")),
      project: projectReceizSportsCardManifest
    }
  ];

  for (const fixture of fixtures) {
    assert.match(fixture.project(fixture.value).schema, /^receiz\.sdk\..+_manifest_projection\.v1$/);
    const register = createReceizProofRegister();
    assert.throws(
      () => register.admit(fixture.value),
      /complete_sealed_proof_object_required/
    );
    assert.equal(register.snapshot().entries.length, 0);

    const memory = await createReceizProofMemory({ autoPersist: false });
    assert.throws(
      () => memory.admit(fixture.value),
      /complete_sealed_proof_object_required/
    );
    assert.equal(memory.snapshot().entries.length, 0);
  }
});

test("v102 keeps MCP and authenticated proof-object creation out of browser feature modules", () => {
  const browserRuntime = runtimeSourceText("src/features");
  const productionRuntime = `${runtimeSourceText("app")}\n${runtimeSourceText("src")}`;
  const proofObjectRoute = readFileSync("app/api/receiz/proof-object/route.ts", "utf8");
  const compatibilityRoute = readFileSync("app/api/receiz/seal/route.ts", "utf8");
  assert.doesNotMatch(productionRuntime, /@receiz\/mcp-server/);
  assert.doesNotMatch(browserRuntime, /\bcreateProofObject\s*\(/);
  assert.match(proofObjectRoute, /resolveWildzCookieActor/);
  assert.match(proofObjectRoute, /createWildzExportProofObject/);
  assert.match(proofObjectRoute, /content-length/);
  assert.match(proofObjectRoute, /file\.size/);
  assert.doesNotMatch(proofObjectRoute, /wildz_proof_object_length_required/);
  assert.match(proofObjectRoute, /if \(contentLength !== null\)/);
  assert.ok(
    proofObjectRoute.indexOf("content-length") < proofObjectRoute.indexOf("request.formData()"),
    "known oversized multipart bodies must be rejected before form-data parsing while Safari uploads without the optional header continue"
  );
  assert.ok(
    proofObjectRoute.indexOf("file.size") < proofObjectRoute.indexOf("file.arrayBuffer()"),
    "oversized files must be rejected before arrayBuffer materialization"
  );
  assert.doesNotMatch(productionRuntime, /\bsealArtifact\b|\/api\/document-seal/);
  assert.match(compatibilityRoute, /export const dynamic = "force-dynamic"/);
  assert.match(compatibilityRoute, /export const runtime = "nodejs"/);
  assert.match(compatibilityRoute, /export \{ POST \} from "\.\.\/proof-object\/route"/);
  assert.doesNotMatch(compatibilityRoute, /export \{ dynamic, POST, runtime \}/);
});
