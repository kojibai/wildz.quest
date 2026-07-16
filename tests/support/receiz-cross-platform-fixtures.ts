import JSZip from "jszip";
import {
  appendReceizIdentityArtifactTrailerToPng,
  createReceizIdentityKeyFile,
  serializeReceizIdentityArtifact
} from "@receiz/sdk";
import {
  embedPortableCardInPng,
  embedPortableVaultInPng
} from "../../src/features/play/card-export";
import {
  canonicalPortableCardJson,
  type PortableCardAsset
} from "../../src/features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../src/features/play/wilds-player-vault";

export type ReceizCrossPlatformArtifactFixture = {
  source: "receiz-commerce" | "receiz-app" | "receiz-signal" | "receiz-sealed-card" | "wildz-original" | "sdk-compatible";
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  embeddedUsername: string | null;
  expectedWildzAssetIds: readonly string[];
};

type FixtureFile = { path: string; name: string; mimeType: string; bytes: Uint8Array };
type MerkleSibling = { side: "left" | "right"; sha256: string };

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));
const SIGNAL_MANIFEST_KEY = "receiz.signal_vault_card_manifest";
const SIGNAL_ARCHIVE_SHA_KEY = "receiz.signal_vault_card_archive_sha256";
const SIGNAL_ARCHIVE_COUNT_KEY = "receiz.signal_vault_card_archive_count";
const SIGNAL_ARCHIVE_PREFIX = "receiz.signal_vault_card_archive.";
const FIXTURE_TIME = "2026-07-15T12:00:00.000Z";

function strictBuffer(value: Uint8Array) {
  return value.slice().buffer;
}

function concatBytes(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

function uint32Bytes(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type);
  return concatBytes([uint32Bytes(data.byteLength), typeBytes, data, uint32Bytes(crc32(concatBytes([typeBytes, data])))]);
}

function rewritePngChunk(source: Uint8Array, target: string, transform: (data: Uint8Array) => Uint8Array) {
  const output: Uint8Array[] = [source.slice(0, 8)];
  let offset = 8;
  let found = false;
  while (offset + 12 <= source.byteLength) {
    const length = uint32(source, offset);
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    const data = source.slice(offset + 8, offset + 8 + length);
    output.push(pngChunk(type, type === target ? transform(data) : data));
    if (type === target) found = true;
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!found) throw new Error(`fixture_png_chunk_missing:${target}`);
  return concatBytes(output);
}

function insertPngTextChunks(source: Uint8Array, entries: readonly { keyword: string; text: string }[]) {
  const output: Uint8Array[] = [source.slice(0, 8)];
  let offset = 8;
  while (offset + 12 <= source.byteLength) {
    const length = uint32(source, offset);
    const type = new TextDecoder().decode(source.slice(offset + 4, offset + 8));
    const data = source.slice(offset + 8, offset + 8 + length);
    if (type === "IEND") {
      for (const entry of entries) {
        output.push(pngChunk("tEXt", concatBytes([
          new TextEncoder().encode(entry.keyword),
          new Uint8Array([0]),
          new TextEncoder().encode(entry.text)
        ])));
      }
    }
    output.push(pngChunk(type, data));
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return concatBytes(output);
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  return "null";
}

async function sha256Hex(value: Uint8Array | string) {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", strictBuffer(source));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function canonicalHash(value: unknown) {
  return sha256Hex(canonicalize(value));
}

async function merkleParent(left: string, right: string) {
  return canonicalHash({ kind: "receiz.vault.merkle.parent.v1", left, right });
}

async function merkleProofs(leaves: readonly string[]) {
  if (!leaves.length) throw new Error("fixture_merkle_empty");
  const levels: string[][] = [[...leaves]];
  while (levels.at(-1)!.length > 1) {
    const current = levels.at(-1)!;
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(await merkleParent(current[index]!, current[index + 1] ?? current[index]!));
    }
    levels.push(next);
  }
  const proofs = leaves.map((_, leafIndex) => {
    const path: MerkleSibling[] = [];
    let index = leafIndex;
    for (let level = 0; level < levels.length - 1; level += 1) {
      const values = levels[level]!;
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      path.push({
        side: index % 2 === 0 ? "right" : "left",
        sha256: values[siblingIndex] ?? values[index]!
      });
      index = Math.floor(index / 2);
    }
    return path;
  });
  return { root: levels.at(-1)![0]!, proofs };
}

function fibonacciBacklinks(index: number) {
  const links: Array<{ distance: number; leafIndex: number }> = [];
  let a = 1;
  let b = 2;
  while (a <= index) {
    links.push({ distance: a, leafIndex: index - a });
    [a, b] = [b, a + b];
  }
  return links;
}

async function createReceizVaultPackage(files: readonly FixtureFile[]) {
  const chunkBytes = 16 * 1024;
  const orderedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const prepared: Array<{
    source: FixtureFile;
    chunks: Array<{ index: number; offset: number; bytes: Uint8Array; sha256: string }>;
    chunkRootSha256: string;
    fileId: string;
  }> = [];
  for (const file of orderedFiles) {
    const chunks: Array<{ index: number; offset: number; bytes: Uint8Array; sha256: string }> = [];
    for (let offset = 0, index = 0; offset < file.bytes.byteLength; offset += chunkBytes, index += 1) {
      const bytes = file.bytes.slice(offset, Math.min(file.bytes.byteLength, offset + chunkBytes));
      chunks.push({ index, offset, bytes, sha256: await sha256Hex(bytes) });
    }
    const chunkRootSha256 = await canonicalHash({
      kind: "receiz.vault.file.chunk-root.v1",
      path: file.path,
      size: file.bytes.byteLength,
      mime: file.mimeType,
      chunkBytes,
      chunks: chunks.map((chunk) => chunk.sha256)
    });
    const fileId = await canonicalHash({
      kind: "receiz.vault.file.id.v1",
      path: file.path,
      size: file.bytes.byteLength,
      mime: file.mimeType,
      chunkRootSha256
    });
    prepared.push({ source: file, chunks, chunkRootSha256, fileId });
  }

  const flattened = prepared.flatMap((file) => file.chunks.map((chunk) => ({ file, chunk })));
  const leaves = await Promise.all(flattened.map(({ file, chunk }) => canonicalHash({
    kind: "receiz.vault.leaf.v1",
    fileId: file.fileId,
    path: file.source.path,
    chunkIndex: chunk.index,
    chunkSha256: chunk.sha256
  })));
  const merkle = await merkleProofs(leaves);
  let leafIndex = 0;
  const rootFiles = prepared.map((file) => ({
    fileId: file.fileId,
    path: file.source.path,
    name: file.source.name,
    mime: file.source.mimeType,
    size: file.source.bytes.byteLength,
    chunkBytes,
    chunkCount: file.chunks.length,
    chunkRootSha256: file.chunkRootSha256,
    shards: file.chunks.map((chunk) => {
      const currentLeaf = leafIndex++;
      return {
        index: chunk.index,
        leafIndex: currentLeaf,
        path: `proof-blocks/${file.fileId.slice(0, 24)}/${String(chunk.index).padStart(8, "0")}.receizblock.json`,
        offset: chunk.offset,
        size: chunk.bytes.byteLength,
        chunkSha256: chunk.sha256,
        leafSha256: leaves[currentLeaf]!
      };
    })
  }));
  const totals = {
    files: rootFiles.length,
    bytes: orderedFiles.reduce((total, file) => total + file.bytes.byteLength, 0),
    chunks: flattened.length
  };
  const kaiSeed = {
    pulse: 7_151_200,
    beat: 4,
    stepIndex: 12,
    weekday: "Wednesday",
    chakraDay: "Heart"
  };
  const vaultId = await canonicalHash({
    kind: "receiz.vault.id.seed.v1",
    version: 1,
    createdAt: FIXTURE_TIME,
    kai: kaiSeed,
    chunkBytes,
    totals,
    merkleRootSha256: merkle.root,
    files: rootFiles.map((file) => ({
      path: file.path,
      size: file.size,
      mime: file.mime,
      chunkRootSha256: file.chunkRootSha256
    }))
  });
  const kai = {
    ...kaiSeed,
    label: `☤KAI:${kaiSeed.pulse}`,
    uri: `kai://vault/${kaiSeed.pulse}/${kaiSeed.beat}/${kaiSeed.stepIndex}/${vaultId.slice(0, 16)}`
  };
  const unsignedRoot = {
    kind: "receiz.vault.root.v1",
    version: 1,
    format: "receiz-vault/self-contained-proof-block-graph",
    vaultId,
    createdAt: FIXTURE_TIME,
    kai,
    chunkBytes,
    totals,
    merkle: {
      algorithm: "sha256/jcs/paired-duplicate-last",
      rootSha256: merkle.root,
      leafCount: leaves.length
    },
    fibonacci: {
      basis: "deterministic-backlinks",
      leafOrder: "path-ascending/chunk-index",
      distances: fibonacciBacklinks(Math.max(0, leaves.length - 1)).map((link) => link.distance)
    },
    restore: {
      method: "concatenate-file-blocks-by-index",
      encoding: "base64url.raw",
      fileOrder: rootFiles.map((file) => file.fileId)
    },
    files: rootFiles
  };
  const root = { ...unsignedRoot, integrity: { canonicalSha256: await canonicalHash(unsignedRoot) } };
  const zip = new JSZip();
  zip.file("root.receizvault.json", JSON.stringify(root));
  let globalIndex = 0;
  for (const file of prepared) {
    const rootFile = rootFiles.find((candidate) => candidate.fileId === file.fileId)!;
    for (const chunk of file.chunks) {
      const ref = rootFile.shards[chunk.index]!;
      zip.file(ref.path, JSON.stringify({
        kind: "receiz.vault.shard.v1",
        version: 1,
        vaultId,
        fileId: file.fileId,
        path: file.source.path,
        coordinate: { ...kai, uri: `${kai.uri}/${ref.leafIndex}`, leafIndex: ref.leafIndex },
        chunk: {
          index: chunk.index,
          total: file.chunks.length,
          offset: chunk.offset,
          size: chunk.bytes.byteLength,
          sha256: chunk.sha256,
          encoding: "base64url.raw",
          dataB64u: base64Url(chunk.bytes)
        },
        leafSha256: ref.leafSha256,
        merkle: {
          algorithm: "sha256/jcs/paired-duplicate-last",
          rootSha256: merkle.root,
          path: merkle.proofs[globalIndex]!
        },
        fibonacci: {
          basis: "deterministic-backlinks",
          links: fibonacciBacklinks(globalIndex).map((link) => ({
            ...link,
            path: flattened[link.leafIndex]!.file.source.path,
            chunkIndex: flattened[link.leafIndex]!.chunk.index,
            leafSha256: leaves[link.leafIndex]!
          }))
        }
      }));
      globalIndex += 1;
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

function portableBundle(assets: readonly PortableCardAsset[]) {
  return {
    schema: "receiz.app.portable_bundle.v1",
    objects: [
      ...assets,
      structuredClone(assets[1]!),
      {
        schema: "receiz.wallet.note.v1",
        id: "wallet-note-cross-platform-fixture",
        amountMinor: 700,
        proof: { schema: "receiz.wallet.note_proof.v1", digest: "sha256:not-a-wildz-card" }
      }
    ]
  };
}

function asV1Vault(source: Uint8Array) {
  return rewritePngChunk(source, "rzVt", (data) => {
    const value = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>;
    value.schema = "receiz.wilds_vault_png_proof.v1";
    return new TextEncoder().encode(canonicalPortableCardJson(value));
  });
}

function signalVault(packageBytes: Uint8Array, expectedIds: readonly string[]) {
  return sha256Hex(packageBytes).then((archiveSha256) => {
    const encoded = base64Url(packageBytes);
    const parts = encoded.match(/.{1,48000}/g) ?? [];
    const manifest = {
      schema: "receiz.signal.vault_card.v1",
      vaultCardId: "signal-cross-platform-fixture",
      ownerLabel: "Signal Fixture",
      archive: { sha256Hex: archiveSha256 },
      cards: [{
        collectibleId: "projection-only-card",
        name: "Projection only",
        kind: "signal-projection",
        rarity: "Projection",
        claimHash: "sha256:projection-only",
        expectedHiddenCount: expectedIds.length
      }]
    };
    return insertPngTextChunks(BASE_PNG, [
      { keyword: SIGNAL_MANIFEST_KEY, text: JSON.stringify(manifest) },
      { keyword: SIGNAL_ARCHIVE_SHA_KEY, text: archiveSha256 },
      { keyword: SIGNAL_ARCHIVE_COUNT_KEY, text: String(parts.length) },
      ...parts.map((text, index) => ({ keyword: `${SIGNAL_ARCHIVE_PREFIX}${index}`, text }))
    ]);
  });
}

export async function createReceizCrossPlatformArtifactFixtures(
  assets: readonly PortableCardAsset[]
): Promise<readonly ReceizCrossPlatformArtifactFixture[]> {
  if (assets.length < 6) throw new Error("cross_platform_fixture_requires_six_assets");
  const expectedWildzAssetIds = [...new Set(assets.map((asset) => asset.id))].sort();
  const bundleBytes = new TextEncoder().encode(canonicalPortableCardJson(portableBundle(assets)));
  const packageBytes = await createReceizVaultPackage([{
    path: "portable/wildz-assets.json",
    name: "wildz-assets.json",
    mimeType: "application/json",
    bytes: bundleBytes
  }]);
  const appIdentity = await createReceizIdentityKeyFile({
    owner: { uid: "receiz_app_fixture", username: "receiz_app__keeper", displayName: "Receiz App Keeper" },
    issuedAt: FIXTURE_TIME,
    portableState: { schema: "receiz.account.state.v3", snapshot: portableBundle(assets) }
  });
  const sdkIdentity = await createReceizIdentityKeyFile({
    owner: { uid: "receiz_sdk_fixture", username: "sdk__vault_keeper", displayName: "SDK Vault Keeper" },
    issuedAt: FIXTURE_TIME,
    portableState: { schema: "receiz.account.state.v3", snapshot: portableBundle(assets) }
  });
  const vaultV2 = embedPortableVaultInPng(BASE_PNG, [...assets]);
  const dualCardVault = embedPortableCardInPng(vaultV2, assets[1]!);

  return [
    {
      source: "receiz-commerce",
      bytes: packageBytes,
      mimeType: "application/vnd.receiz.vault+zip",
      filename: "cross-platform.receizvault",
      embeddedUsername: null,
      expectedWildzAssetIds
    },
    {
      source: "receiz-app",
      bytes: new TextEncoder().encode(serializeReceizIdentityArtifact(appIdentity.keyFile)),
      mimeType: "application/json",
      filename: "receiz-app-identity.json",
      embeddedUsername: "receiz_app__keeper",
      expectedWildzAssetIds
    },
    {
      source: "receiz-signal",
      bytes: await signalVault(packageBytes, expectedWildzAssetIds),
      mimeType: "image/png",
      filename: "signal-vault.png",
      embeddedUsername: null,
      expectedWildzAssetIds
    },
    {
      source: "receiz-sealed-card",
      bytes: dualCardVault,
      mimeType: "image/png",
      filename: "sealed-card-and-vault.receized.png",
      embeddedUsername: null,
      expectedWildzAssetIds
    },
    {
      source: "wildz-original",
      bytes: asV1Vault(vaultV2),
      mimeType: "image/png",
      filename: "wildz-original-vault.png",
      embeddedUsername: null,
      expectedWildzAssetIds
    },
    {
      source: "sdk-compatible",
      bytes: appendReceizIdentityArtifactTrailerToPng(vaultV2, sdkIdentity.keyFile),
      mimeType: "image/png",
      filename: "sdk-compatible-vault.png",
      embeddedUsername: "sdk__vault_keeper",
      expectedWildzAssetIds
    }
  ];
}

export async function createReceizCommercePlayerVaultFixture(
  assets: readonly PortableCardAsset[],
  player: WildsPlayerVaultPayload
) {
  const bytes = new TextEncoder().encode(canonicalPortableCardJson({
    schema: "receiz.app.portable_bundle.v1",
    objects: [
      player,
      { schema: "receiz.wallet.note.v1", id: "unrelated-player-vault-note", expectedCards: assets.length }
    ]
  }));
  return createReceizVaultPackage([{
    path: "portable/wildz-player-vault.json",
    name: "wildz-player-vault.json",
    mimeType: "application/json",
    bytes
  }]);
}
