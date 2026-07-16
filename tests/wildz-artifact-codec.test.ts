import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  serializeReceizIdentityArtifact
} from "@receiz/sdk";
import { embedPortableVaultInPng } from "../src/features/play/card-export";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { inspectReceizCommerceVault } from "../src/lib/receiz/receiz-commerce-vault";
import {
  createWildzArtifactCodec,
  type ReceizCommerceVaultReader
} from "../src/lib/receiz/wildz-artifact-codec";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { inspectWildzRestore } from "../src/lib/receiz/wildz-identity-adapter";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function assets(count = 7) {
  return Array.from({ length: count }, (_, index) => sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "artifact_codec_owner",
    encounterId: `artifact-codec-${index}`,
    capturedAt: new Date(Date.UTC(2026, 6, 15, 12, index)).toISOString()
  }));
}

function codec() {
  const identityRepository = createWildzIdentityRepository({ database: createMemoryWildzContinuityDatabase() });
  return createWildzArtifactCodec({
    identityRepository,
    commerceVaultReader: { inspect: inspectReceizCommerceVault }
  });
}

test("action labels do not override verified artifact bytes", async () => {
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_identity", username: "codec__identity", displayName: "Codec Identity" },
    portableState: null
  });
  const seal = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);
  const inspected = await codec().inspect({ bytes: seal, mimeType: "image/png", name: "called-a-vault.receizvault" });
  assert.equal(inspected.kind, "identity-seal");
  if (inspected.kind !== "identity-seal") return;
  assert.equal(inspected.identity.session.username, "codec__identity");
  assert.deepEqual(inspected.portableAssets, []);
});

test("legacy card Vault never claims identity authority", async () => {
  const expected = assets();
  const inspected = await codec().inspect({
    bytes: embedPortableVaultInPng(BASE_PNG, expected),
    mimeType: "image/png",
    name: "called-an-identity.png"
  });
  assert.equal(inspected.kind, "card-vault");
  if (inspected.kind !== "card-vault") return;
  assert.equal("identity" in inspected, false);
  assert.deepEqual(inspected.assets.map((asset) => asset.id), expected.map((asset) => asset.id).sort());
});

test("a present but invalid SDK portable state closes the whole inspection", async () => {
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_tamper", username: "codec_tamper", displayName: "Codec Tamper" },
    portableState: { snapshot: { cards: assets(2) } }
  });
  const tampered = structuredClone(identity.keyFile);
  assert.ok(tampered.portableState);
  tampered.portableState.snapshot = { cards: assets(3) };
  const inspected = await codec().inspect({
    bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(tampered)),
    mimeType: "application/json"
  });
  assert.equal(inspected.kind, "invalid");
  if (inspected.kind === "invalid") assert.equal(inspected.code, "wildz_restore_portable_signature_invalid");
});

test("SDK identity Seals ignore verified non-card Wildz boss proof objects", async () => {
  // Canonical output from the V3 issueBossArtifact production path, including
  // every signed basis field and the complete boss-artifact proof shape.
  const bossArtifact = {
    bossId: "boss:ember-wyrm",
    victoryEventId: "evt:raid-42",
    ownerReceizId: "rz:alice",
    issuedAt: "2026-07-15T00:00:00.000Z",
    rewardIndex: 0,
    id: "artifact:7b75778858b435c6bf8b82bb",
    rarity: "rare",
    kind: "boss-relic",
    proof: {
      digest: "sha256:4937053ce7c93cf7ea3c6c670bc47db9ce108d75615cf505fc9849b7bfbc2874",
      kind: "receiz.wilds_boss_artifact.v1"
    }
  } as const;
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_boss", username: "codec__boss", displayName: "Codec Boss" },
    portableState: {
      snapshot: {
        boss: bossArtifact
      }
    }
  });
  const seal = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);

  const inspected = await codec().inspect({ bytes: seal, mimeType: "image/png", name: "boss-identity.receized.png" });

  assert.equal(inspected.kind, "identity-seal");
  if (inspected.kind !== "identity-seal") return;
  assert.equal(inspected.identity.session.username, "codec__boss");
  assert.deepEqual(inspected.portableAssets, []);
});

test("SDK identity Seals reject malformed exact card-proof candidates with the card-proof code", async () => {
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_malformed_card", username: "codec__malformed_card", displayName: "Codec Malformed Card" },
    portableState: {
      snapshot: {
        malformedCard: {
          id: "wilds:malformed-card",
          proof: {
            kind: "receiz.wilds_local_seal.v1",
            digest: "sha256:malformed-card"
          }
        }
      }
    }
  });
  const seal = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);

  const inspected = await codec().inspect({ bytes: seal, mimeType: "image/png", name: "malformed-card.receized.png" });

  assert.equal(inspected.kind, "invalid");
  if (inspected.kind === "invalid") assert.equal(inspected.code, "wildz_restore_card_proof_invalid");
});

test("SDK identity Seals admit cards after more than 10,000 unrelated primitive values", async () => {
  const expected = assets(1)[0]!;
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_scalars", username: "codec__scalars", displayName: "Codec Scalars" },
    portableState: {
      snapshot: {
        unrelated: Array.from({ length: 10_001 }, (_, index) => `value-${index}`),
        cards: [expected]
      }
    }
  });
  const seal = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);

  const inspected = await codec().inspect({ bytes: seal, mimeType: "image/png", name: "scalar-heavy.receized.png" });

  assert.equal(inspected.kind, "identity-seal");
  if (inspected.kind !== "identity-seal") return;
  assert.equal(inspected.identity.session.username, "codec__scalars");
  assert.deepEqual(inspected.portableAssets.map((asset) => asset.id), [expected.id]);
});

test("SDK identity Seals import an exact proof-valid living card", async () => {
  const legacy = assets(1)[0]!;
  const expected = admitLegacyCard(legacy, "2026-07-15T13:00:00.000Z");
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_living", username: "codec__living", displayName: "Codec Living" },
    portableState: { snapshot: { cards: [expected] } }
  });
  const seal = appendReceizIdentityArtifactTrailerToPng(BASE_PNG, identity.keyFile);

  const inspected = await codec().inspect({ bytes: seal, mimeType: "image/png", name: "living-card.receized.png" });

  assert.equal(inspected.kind, "identity-seal");
  if (inspected.kind !== "identity-seal") return;
  assert.equal(inspected.identity.session.username, "codec__living");
  assert.deepEqual(inspected.portableAssets, [expected]);
});

test("PNG signature, unsupported binary, and 64 MiB limits fail closed", async () => {
  const invalidPng = await codec().inspect({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" });
  assert.equal(invalidPng.kind, "invalid");
  const unsupported = await codec().inspect({ bytes: new Uint8Array([1, 2, 3]), mimeType: "application/octet-stream" });
  assert.deepEqual(unsupported, { kind: "unsupported", code: "wildz_artifact_unsupported" });
  const oversized = await codec().inspect({ bytes: new Uint8Array(64 * 1024 * 1024 + 1), mimeType: "application/octet-stream" });
  assert.equal(oversized.kind, "invalid");
  if (oversized.kind === "invalid") assert.equal(oversized.code, "wildz_restore_artifact_too_large");
});

test("Commerce display projections never become playable card assets", async () => {
  const commerceVaultReader: ReceizCommerceVaultReader = {
    async inspect() {
      return {
        projection: {
          id: "projection-vault",
          schema: "receiz.wildz.commerce_vault_projection.v1",
          sourceSchema: "receiz.projection.only.v1",
          filename: "projection.receizvault",
          ownerLabel: null,
          importedAt: "2026-07-15T12:00:00.000Z",
          verification: "receiz-sdk",
          cards: [{
            id: assets(1)[0]!.id,
            name: "Projection row",
            kind: "display-only",
            rarity: "Projection",
            proofHash: assets(1)[0]!.proof.digest,
            imageUrl: null,
            source: "sealed-artifact"
          }]
        },
        restoredFiles: []
      };
    }
  };
  const inspected = await createWildzArtifactCodec({
    identityRepository: createWildzIdentityRepository({ database: createMemoryWildzContinuityDatabase() }),
    commerceVaultReader
  }).inspect({ bytes: new Uint8Array([80, 75, 3, 4]), mimeType: "application/zip", name: "display.receizvault" });
  assert.equal(inspected.kind, "commerce-vault");
  if (inspected.kind === "commerce-vault") assert.deepEqual(inspected.assets, []);
});

test("PNG envelopes preserve full SDK bytes while exposing the strict card basis", async () => {
  const identity = await createReceizIdentityKeyFile({
    owner: { uid: "codec_envelope", username: "codec_envelope", displayName: "Codec Envelope" },
    portableState: null
  });
  const vaultBasis = embedPortableVaultInPng(BASE_PNG, assets(2));
  const combined = appendReceizIdentityArtifactTrailerToPng(vaultBasis, identity.keyFile);
  const split = splitWildzPngEnvelope(combined);
  assert.deepEqual(split.pngBasis, vaultBasis);
  assert.ok(split.trailer.byteLength > 0);
  assert.equal(split.pngBasis.byteLength + split.trailer.byteLength, combined.byteLength);
});

test("the upload adapter reads a File exactly once", async () => {
  const vault = embedPortableVaultInPng(BASE_PNG, assets(3));
  let reads = 0;
  const file = {
    name: "byte-once.receized.png",
    type: "image/png",
    async arrayBuffer() {
      reads += 1;
      return vault.slice().buffer;
    }
  } as File;
  const inspected = await inspectWildzRestore(file, codec());
  assert.equal(inspected.kind, "card-vault");
  assert.equal(reads, 1);
});

test("portable traversal enforces node, depth, and restored-file bounds", () => {
  let deep: unknown = { value: "leaf" };
  for (let index = 0; index < 13; index += 1) deep = { child: deep };
  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: deep,
    restoredVaultFiles: []
  }), /wildz_restore_schema_unsupported/);

  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: Array.from({ length: 10_001 }, () => ({})),
    restoredVaultFiles: []
  }), /wildz_restore_schema_unsupported/);

  assert.throws(() => extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: null,
    restoredVaultFiles: Array.from({ length: 1_001 }, (_, index) => ({
      fileId: `file-${index}`,
      path: `files/${index}.json`,
      name: `${index}.json`,
      mimeType: "application/json",
      bytes: new Uint8Array()
    }))
  }), /wildz_restore_schema_unsupported/);
});
