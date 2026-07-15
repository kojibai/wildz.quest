import JSZip from "jszip";

// Receiz Commerce v1 proof-block packages are restored locally. Every byte
// admitted below is covered by the root, chunk, leaf, Merkle and backlink
// proofs; projected manifest rows are never substituted for restored files.

type MerkleSibling = { side: "left" | "right"; sha256: string };
type KaiCoordinate = {
  pulse: number;
  label: string;
  beat: number;
  stepIndex: number;
  weekday: string;
  chakraDay: string;
  uri: string;
};
type ShardRef = {
  index: number;
  leafIndex: number;
  path: string;
  offset: number;
  size: number;
  chunkSha256: string;
  leafSha256: string;
};
type VaultFile = {
  fileId: string;
  path: string;
  name: string;
  mime: string;
  size: number;
  chunkBytes: number;
  chunkCount: number;
  chunkRootSha256: string;
  shards: ShardRef[];
};
type VaultRoot = {
  kind: "receiz.vault.root.v1";
  version: 1;
  format: "receiz-vault/self-contained-proof-block-graph";
  vaultId: string;
  createdAt: string;
  kai: KaiCoordinate;
  chunkBytes: number;
  totals: { files: number; bytes: number; chunks: number };
  merkle: { algorithm: "sha256/jcs/paired-duplicate-last"; rootSha256: string; leafCount: number };
  fibonacci: {
    basis: "deterministic-backlinks";
    leafOrder: "path-ascending/chunk-index";
    distances: number[];
  };
  restore: {
    method: "concatenate-file-blocks-by-index";
    encoding: "base64url.raw";
    fileOrder: string[];
  };
  files: VaultFile[];
  integrity: { canonicalSha256: string };
  [key: string]: unknown;
};
type VaultShard = {
  kind: "receiz.vault.shard.v1";
  version: 1;
  vaultId: string;
  fileId: string;
  path: string;
  coordinate: KaiCoordinate & { leafIndex: number };
  chunk: {
    index: number;
    total: number;
    offset: number;
    size: number;
    sha256: string;
    encoding: "base64url.raw";
    dataB64u: string;
  };
  leafSha256: string;
  merkle: { algorithm: "sha256/jcs/paired-duplicate-last"; rootSha256: string; path: MerkleSibling[] };
  fibonacci: {
    basis: "deterministic-backlinks";
    links: Array<{
      distance: number;
      leafIndex: number;
      leafSha256: string;
      path: string;
      chunkIndex: number;
    }>;
  };
};

export type RestoredReceizVaultPackageFile = {
  fileId: string;
  path: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

const MAX_VAULT_BYTES = 64 * 1024 * 1024;
const MAX_VAULT_FILES = 1_000;
const MAX_VAULT_CHUNKS = 10_000;
const HEX_64 = /^[a-f0-9]{64}$/;
const BASE64_URL = /^[A-Za-z0-9_-]*$/;

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  return "null";
}

function strictBuffer(value: Uint8Array) {
  return value.slice().buffer;
}

async function sha256Hex(value: Uint8Array | string) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", strictBuffer(input));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function base64UrlDecode(value: string) {
  if (!BASE64_URL.test(value)) throw new Error("Vault key contains invalid base64url bytes.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function canonicalHash(value: unknown) {
  return sha256Hex(canonicalize(value));
}

async function merkleParent(left: string, right: string) {
  return canonicalHash({ kind: "receiz.vault.merkle.parent.v1", left, right });
}

async function merkleRootFromProof(leaf: string, proof: MerkleSibling[]) {
  let current = leaf;
  for (const sibling of proof) {
    if ((sibling.side !== "left" && sibling.side !== "right") || !HEX_64.test(sibling.sha256)) {
      throw new Error("Vault key has an invalid Merkle path.");
    }
    current = sibling.side === "left"
      ? await merkleParent(sibling.sha256, current)
      : await merkleParent(current, sibling.sha256);
  }
  return current;
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

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is not a JSON object.`);
  return value as Record<string, unknown>;
}

function parseRecord(value: string, label: string) {
  return record(JSON.parse(value) as unknown, label);
}

function safeInteger(value: unknown, minimum = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function validateKai(value: unknown, label: string): KaiCoordinate {
  const kai = record(value, label);
  if (!safeInteger(kai.pulse)
    || !safeInteger(kai.beat)
    || !safeInteger(kai.stepIndex)
    || !stringValue(kai.label)
    || !stringValue(kai.weekday)
    || !stringValue(kai.chakraDay)
    || !stringValue(kai.uri)) throw new Error(`${label} is malformed.`);
  return kai as unknown as KaiCoordinate;
}

function uncompressedSize(entry: JSZip.JSZipObject) {
  const internal = entry as unknown as { _data?: { uncompressedSize?: unknown } };
  return typeof internal._data?.uncompressedSize === "number" ? internal._data.uncompressedSize : null;
}

async function entryText(entry: JSZip.JSZipObject, limit: number, label: string) {
  const declared = uncompressedSize(entry);
  if (declared !== null && (!Number.isSafeInteger(declared) || declared < 0 || declared > limit)) {
    throw new Error(`${label} exceeds the bounded restore size.`);
  }
  const text = await entry.async("string");
  if (new TextEncoder().encode(text).byteLength > limit) throw new Error(`${label} exceeds the bounded restore size.`);
  return text;
}

function validateRoot(value: Record<string, unknown>): VaultRoot {
  if (value.kind !== "receiz.vault.root.v1"
    || value.version !== 1
    || value.format !== "receiz-vault/self-contained-proof-block-graph") {
    throw new Error("Vault root record has an unsupported kind or version.");
  }
  const totals = record(value.totals, "Vault root totals");
  const merkle = record(value.merkle, "Vault root Merkle record");
  const fibonacci = record(value.fibonacci, "Vault root Fibonacci record");
  const restore = record(value.restore, "Vault root restore record");
  const integrity = record(value.integrity, "Vault root integrity record");
  const kai = validateKai(value.kai, "Vault root Kai coordinate");
  if (!Array.isArray(value.files)
    || !HEX_64.test(stringValue(value.vaultId))
    || !Number.isFinite(Date.parse(stringValue(value.createdAt)))
    || !safeInteger(value.chunkBytes, 1)
    || value.chunkBytes as number > 16 * 1024 * 1024
    || !safeInteger(totals.files)
    || !safeInteger(totals.bytes)
    || !safeInteger(totals.chunks)
    || totals.files as number > MAX_VAULT_FILES
    || totals.bytes as number > MAX_VAULT_BYTES
    || totals.chunks as number > MAX_VAULT_CHUNKS
    || !safeInteger(merkle.leafCount)
    || merkle.algorithm !== "sha256/jcs/paired-duplicate-last"
    || !HEX_64.test(stringValue(merkle.rootSha256))
    || fibonacci.basis !== "deterministic-backlinks"
    || fibonacci.leafOrder !== "path-ascending/chunk-index"
    || !Array.isArray(fibonacci.distances)
    || fibonacci.distances.some((distance) => !safeInteger(distance, 1))
    || restore.method !== "concatenate-file-blocks-by-index"
    || restore.encoding !== "base64url.raw"
    || !Array.isArray(restore.fileOrder)
    || restore.fileOrder.some((fileId) => !HEX_64.test(stringValue(fileId)))
    || !HEX_64.test(stringValue(integrity.canonicalSha256))) {
    throw new Error("Vault root record is malformed or exceeds restore bounds.");
  }
  if (kai.label !== `☤KAI:${kai.pulse}` || !kai.uri.endsWith(`/${stringValue(value.vaultId).slice(0, 16)}`)) {
    throw new Error("Vault root Kai coordinate is not bound to the Vault identity.");
  }
  return value as VaultRoot;
}

function validateFile(value: unknown, label: string): VaultFile {
  const file = record(value, label);
  if (!HEX_64.test(stringValue(file.fileId))
    || !stringValue(file.path)
    || !stringValue(file.name)
    || !stringValue(file.mime)
    || !safeInteger(file.size)
    || file.size as number > MAX_VAULT_BYTES
    || !safeInteger(file.chunkBytes, 1)
    || file.chunkBytes as number > 16 * 1024 * 1024
    || !safeInteger(file.chunkCount, 1)
    || file.chunkCount as number > MAX_VAULT_CHUNKS
    || !HEX_64.test(stringValue(file.chunkRootSha256))
    || !Array.isArray(file.shards)) {
    throw new Error(`${label} is malformed.`);
  }
  return file as unknown as VaultFile;
}

function validateRef(value: unknown, label: string): ShardRef {
  const ref = record(value, label);
  if (!safeInteger(ref.index)
    || !safeInteger(ref.leafIndex)
    || !stringValue(ref.path)
    || !safeInteger(ref.offset)
    || !safeInteger(ref.size)
    || !HEX_64.test(stringValue(ref.chunkSha256))
    || !HEX_64.test(stringValue(ref.leafSha256))) throw new Error(`${label} is malformed.`);
  return ref as unknown as ShardRef;
}

function validateShard(value: Record<string, unknown>, label: string): VaultShard {
  if (value.kind !== "receiz.vault.shard.v1" || value.version !== 1) {
    throw new Error(`${label} has an unsupported vault key kind or version.`);
  }
  const coordinate = record(value.coordinate, `${label} coordinate`);
  const chunk = record(value.chunk, `${label} chunk`);
  const merkle = record(value.merkle, `${label} Merkle proof`);
  const fibonacci = record(value.fibonacci, `${label} Fibonacci proof`);
  validateKai(coordinate, `${label} coordinate`);
  if (!safeInteger(coordinate.leafIndex)
    || !safeInteger(chunk.index)
    || !safeInteger(chunk.total, 1)
    || !safeInteger(chunk.offset)
    || !safeInteger(chunk.size)
    || !HEX_64.test(stringValue(chunk.sha256))
    || chunk.encoding !== "base64url.raw"
    || typeof chunk.dataB64u !== "string"
    || !HEX_64.test(stringValue(value.leafSha256))
    || !HEX_64.test(stringValue(merkle.rootSha256))
    || merkle.algorithm !== "sha256/jcs/paired-duplicate-last"
    || !Array.isArray(merkle.path)
    || merkle.path.length > 64
    || !Array.isArray(fibonacci.links)
    || fibonacci.basis !== "deterministic-backlinks"
    || fibonacci.links.length > 64) throw new Error(`${label} is malformed.`);
  for (const link of fibonacci.links) {
    const item = record(link, `${label} Fibonacci link`);
    if (!safeInteger(item.distance, 1)
      || !safeInteger(item.leafIndex)
      || !stringValue(item.path)
      || !safeInteger(item.chunkIndex)
      || !HEX_64.test(stringValue(item.leafSha256))) throw new Error(`${label} Fibonacci link is malformed.`);
  }
  return value as unknown as VaultShard;
}

async function inspectPackage(bytesValue: Uint8Array) {
  if (bytesValue.byteLength > MAX_VAULT_BYTES) throw new Error("Receiz Vault package exceeds the bounded restore size.");
  const zip = await JSZip.loadAsync(strictBuffer(bytesValue));
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_VAULT_CHUNKS + MAX_VAULT_FILES + 8) throw new Error("Receiz Vault package has too many entries.");
  const rootEntry = zip.file("root.receizvault.json");
  if (!rootEntry) throw new Error("Missing root.receizvault.json.");
  const root = validateRoot(parseRecord(await entryText(rootEntry, 8 * 1024 * 1024, "root.receizvault.json"), "root.receizvault.json"));
  const errors: string[] = [];
  const unsignedRoot = { ...root } as Partial<VaultRoot>;
  delete unsignedRoot.integrity;
  if (await canonicalHash(unsignedRoot) !== root.integrity.canonicalSha256) {
    errors.push("Root record canonical hash does not match its integrity seal.");
  }
  if (root.files.length !== root.totals.files || root.files.length > MAX_VAULT_FILES) {
    errors.push("Root file count does not match file entries.");
  }

  const files = root.files.map((file, index) => validateFile(file, `Vault file ${index}`));
  const orderedPaths = files.map((file) => file.path);
  if (orderedPaths.some((path, index) => path !== [...orderedPaths].sort().at(index))) {
    errors.push("Vault files are not in canonical path order.");
  }
  if (root.restore.fileOrder.length !== files.length
    || root.restore.fileOrder.some((fileId, index) => fileId !== files[index]?.fileId)) {
    errors.push("Vault restore file order does not match canonical file order.");
  }
  const fileIds = new Set<string>();
  const filePaths = new Set<string>();
  const shardPaths = new Set<string>();
  const allRefs: Array<{ file: VaultFile; ref: ShardRef }> = [];
  let declaredBytes = 0;
  for (const file of files) {
    if (fileIds.has(file.fileId) || filePaths.has(file.path)) errors.push(`Duplicate Vault file identity for ${file.path}.`);
    fileIds.add(file.fileId);
    filePaths.add(file.path);
    declaredBytes += file.size;
    if (file.chunkBytes !== root.chunkBytes) errors.push(`Chunk size policy mismatch for ${file.path}.`);
    const originalRefs = file.shards.map((ref, index) => validateRef(ref, `${file.path} shard ${index}`));
    if (originalRefs.some((ref, index) => ref.index !== index)) errors.push(`Chunk order is not canonical for ${file.path}.`);
    const refs = originalRefs.slice().sort((left, right) => left.index - right.index);
    if (refs.length !== file.chunkCount) errors.push(`Chunk count mismatch for ${file.path}.`);
    let cursor = 0;
    refs.forEach((ref, index) => {
      if (ref.index !== index || ref.offset !== cursor || ref.size > file.chunkBytes) {
        errors.push(`Chunk coordinates are not contiguous for ${file.path}.`);
      }
      cursor += ref.size;
      if (shardPaths.has(ref.path)) errors.push(`Duplicate Vault key path ${ref.path}.`);
      shardPaths.add(ref.path);
      allRefs.push({ file, ref });
    });
    if (cursor !== file.size) errors.push(`Declared file size does not match chunks for ${file.path}.`);
    const chunkRootSha256 = await canonicalHash({
      kind: "receiz.vault.file.chunk-root.v1",
      path: file.path,
      size: file.size,
      mime: file.mime,
      chunkBytes: file.chunkBytes,
      chunks: refs.map((ref) => ref.chunkSha256)
    });
    const fileId = await canonicalHash({
      kind: "receiz.vault.file.id.v1",
      path: file.path,
      size: file.size,
      mime: file.mime,
      chunkRootSha256
    });
    if (chunkRootSha256 !== file.chunkRootSha256 || fileId !== file.fileId) {
      errors.push(`File identity mismatch for ${file.path}.`);
    }
  }
  if (declaredBytes !== root.totals.bytes || declaredBytes > MAX_VAULT_BYTES) errors.push("Root byte total does not match file entries.");
  if (allRefs.length !== root.totals.chunks
    || allRefs.length !== root.merkle.leafCount
    || allRefs.length > MAX_VAULT_CHUNKS) errors.push("Root vault key references do not match chunk total.");
  const byLeaf = new Map<number, { file: VaultFile; ref: ShardRef }>();
  for (const pair of allRefs) {
    if (byLeaf.has(pair.ref.leafIndex)) errors.push(`Duplicate leaf index ${pair.ref.leafIndex}.`);
    byLeaf.set(pair.ref.leafIndex, pair);
  }
  for (let index = 0; index < allRefs.length; index += 1) {
    if (!byLeaf.has(index)) errors.push(`Missing leaf index ${index}.`);
    if (allRefs[index]?.ref.leafIndex !== index) errors.push(`Leaf order is not canonical at index ${index}.`);
  }
  const expectedDistances = fibonacciBacklinks(Math.max(0, allRefs.length - 1)).map((link) => link.distance);
  if (root.fibonacci.distances.length !== expectedDistances.length
    || root.fibonacci.distances.some((distance, index) => distance !== expectedDistances[index])) {
    errors.push("Vault Fibonacci distance basis is not canonical.");
  }
  const expectedVaultId = await canonicalHash({
    kind: "receiz.vault.id.seed.v1",
    version: 1,
    createdAt: root.createdAt,
    kai: {
      pulse: root.kai.pulse,
      beat: root.kai.beat,
      stepIndex: root.kai.stepIndex,
      weekday: root.kai.weekday,
      chakraDay: root.kai.chakraDay
    },
    chunkBytes: root.chunkBytes,
    totals: root.totals,
    merkleRootSha256: root.merkle.rootSha256,
    files: files.map((file) => ({
      path: file.path,
      size: file.size,
      mime: file.mime,
      chunkRootSha256: file.chunkRootSha256
    }))
  });
  if (expectedVaultId !== root.vaultId) errors.push("Vault identity does not match its files and Merkle root.");
  if (errors.length) throw new Error(errors[0]);

  const restoredFiles: RestoredReceizVaultPackageFile[] = [];
  let restoredBytes = 0;
  for (const file of files) {
    const refs = file.shards.slice().sort((left, right) => left.index - right.index);
    const output = new Uint8Array(file.size);
    let cursor = 0;
    const fileErrorStart = errors.length;
    for (const ref of refs) {
      const entry = zip.file(ref.path);
      if (!entry) {
        errors.push(`Missing vault key ${ref.path}.`);
        continue;
      }
      const shard = validateShard(parseRecord(
        await entryText(entry, Math.min(MAX_VAULT_BYTES, Math.max(1_048_576, ref.size * 2 + 65_536)), ref.path),
        ref.path
      ), ref.path);
      if (shard.vaultId !== root.vaultId || shard.fileId !== file.fileId || shard.path !== file.path) {
        errors.push(`Vault key ${ref.path} identity mismatch.`);
      }
      if (shard.chunk.index !== ref.index
        || shard.chunk.total !== file.chunkCount
        || shard.chunk.offset !== ref.offset
        || shard.coordinate.leafIndex !== ref.leafIndex) errors.push(`Vault key ${ref.path} coordinate mismatch.`);
      if (shard.coordinate.pulse !== root.kai.pulse
        || shard.coordinate.label !== root.kai.label
        || shard.coordinate.beat !== root.kai.beat
        || shard.coordinate.stepIndex !== root.kai.stepIndex
        || shard.coordinate.weekday !== root.kai.weekday
        || shard.coordinate.chakraDay !== root.kai.chakraDay
        || shard.coordinate.uri !== `${root.kai.uri}/${ref.leafIndex}`) errors.push(`Vault key ${ref.path} Kai coordinate mismatch.`);
      if (shard.chunk.encoding !== root.restore.encoding
        || shard.leafSha256 !== ref.leafSha256
        || shard.merkle.algorithm !== root.merkle.algorithm
        || shard.merkle.rootSha256 !== root.merkle.rootSha256
        || shard.fibonacci.basis !== root.fibonacci.basis) errors.push(`Vault key ${ref.path} proof metadata mismatch.`);
      let chunk = new Uint8Array();
      try {
        chunk = base64UrlDecode(shard.chunk.dataB64u);
      } catch {
        errors.push(`Vault key ${ref.path} byte encoding mismatch.`);
      }
      const chunkHash = await sha256Hex(chunk);
      if (chunk.byteLength !== ref.size
        || chunk.byteLength !== shard.chunk.size
        || chunkHash !== ref.chunkSha256
        || chunkHash !== shard.chunk.sha256) errors.push(`Vault key ${ref.path} byte hash mismatch.`);
      const leaf = await canonicalHash({
        kind: "receiz.vault.leaf.v1",
        fileId: file.fileId,
        path: file.path,
        chunkIndex: ref.index,
        chunkSha256: chunkHash
      });
      if (leaf !== ref.leafSha256
        || leaf !== shard.leafSha256
        || await merkleRootFromProof(leaf, shard.merkle.path) !== root.merkle.rootSha256) {
        errors.push(`Vault key ${ref.path} Merkle proof mismatch.`);
      }
      const expectedLinks = fibonacciBacklinks(ref.leafIndex);
      if (expectedLinks.length !== shard.fibonacci.links.length || expectedLinks.some((expected, index) => {
        const actual = shard.fibonacci.links[index];
        const target = byLeaf.get(expected.leafIndex);
        return !actual
          || actual.distance !== expected.distance
          || actual.leafIndex !== expected.leafIndex
          || actual.leafSha256 !== target?.ref.leafSha256
          || actual.path !== target?.file.path
          || actual.chunkIndex !== target?.ref.index;
      })) errors.push(`Vault key ${ref.path} Fibonacci backlinks mismatch.`);
      if (cursor !== ref.offset || cursor + chunk.byteLength > output.byteLength) {
        errors.push(`Restored bytes exceed expected size for ${file.path}.`);
      } else {
        output.set(chunk, cursor);
        cursor += chunk.byteLength;
      }
    }
    if (cursor !== file.size) errors.push(`Restored size mismatch for ${file.path}.`);
    restoredBytes += output.byteLength;
    if (errors.length === fileErrorStart) {
      restoredFiles.push({
        fileId: file.fileId,
        path: file.path,
        name: file.name,
        mimeType: file.mime,
        bytes: output
      });
    }
  }
  if (restoredBytes !== root.totals.bytes || restoredBytes > MAX_VAULT_BYTES) errors.push("Restored Vault bytes do not match the declared total.");
  if (errors.length) throw new Error(errors[0]);
  return { root, restoredFiles };
}

export async function verifyReceizVaultPackage(bytesValue: Uint8Array) {
  return (await inspectPackage(bytesValue)).root;
}

export async function restoreVerifiedReceizVaultPackage(bytesValue: Uint8Array) {
  return (await inspectPackage(bytesValue)).restoredFiles;
}
