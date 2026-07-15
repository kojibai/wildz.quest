import JSZip from "jszip";

// This is the Receiz Commerce v1 vault verifier projected into the standalone
// client. The canonical hashes, Merkle proofs, and Fibonacci backlinks mirror
// app/lib/vault/{codec,crypto,graph}.ts in Receiz Commerce.

type MerkleSibling = { side: "left" | "right"; sha256: string };
type ShardRef = { index: number; leafIndex: number; path: string; offset: number; size: number; chunkSha256: string; leafSha256: string };
type VaultFile = { fileId: string; path: string; name: string; mime: string; size: number; chunkBytes: number; chunkCount: number; chunkRootSha256: string; shards: ShardRef[] };
type VaultRoot = {
  kind: "receiz.vault.root.v1";
  version: 1;
  format: "receiz-vault/self-contained-proof-block-graph";
  vaultId: string;
  createdAt: string;
  totals: { files: number; bytes: number; chunks: number };
  merkle: { rootSha256: string; leafCount: number };
  restore: { encoding: "base64url.raw" };
  files: VaultFile[];
  integrity: { canonicalSha256: string };
};
type VaultShard = {
  kind: "receiz.vault.shard.v1";
  version: 1;
  vaultId: string;
  fileId: string;
  path: string;
  coordinate: { leafIndex: number };
  chunk: { index: number; total: number; offset: number; size: number; sha256: string; encoding: string; dataB64u: string };
  leafSha256: string;
  merkle: { rootSha256: string; path: MerkleSibling[] };
  fibonacci: { links: Array<{ distance: number; leafIndex: number; leafSha256: string }> };
};

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

function bytes(value: Uint8Array) {
  return value.slice().buffer;
}

async function sha256Hex(value: Uint8Array | string) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes(input));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function base64UrlDecode(value: string) {
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
  for (const sibling of proof) current = sibling.side === "left" ? await merkleParent(sibling.sha256, current) : await merkleParent(current, sibling.sha256);
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

function parseRecord(value: string, label: string) {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} is not a JSON object.`);
  return parsed as Record<string, unknown>;
}

export async function verifyReceizVaultPackage(bytesValue: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes(bytesValue));
  const rootEntry = zip.file("root.receizvault.json");
  if (!rootEntry) throw new Error("Missing root.receizvault.json.");
  const root = parseRecord(await rootEntry.async("string"), "root.receizvault.json") as unknown as VaultRoot;
  if (root.kind !== "receiz.vault.root.v1" || root.version !== 1 || root.format !== "receiz-vault/self-contained-proof-block-graph") throw new Error("Vault root record has an unsupported kind or version.");
  const errors: string[] = [];
  const unsignedRoot = { ...root } as Partial<VaultRoot>;
  delete unsignedRoot.integrity;
  if (await canonicalHash(unsignedRoot) !== root.integrity?.canonicalSha256) errors.push("Root record canonical hash does not match its integrity seal.");
  if (!Array.isArray(root.files) || root.files.length !== root.totals?.files) errors.push("Root file count does not match file entries.");
  const refs = root.files.flatMap((file) => file.shards.map((ref) => ({ file, ref })));
  if (refs.length !== root.totals?.chunks || root.merkle?.leafCount !== root.totals?.chunks) errors.push("Root vault key references do not match chunk total.");
  const byLeaf = new Map(refs.map(({ ref }) => [ref.leafIndex, ref]));

  for (const file of root.files) {
    const chunkRootSha256 = await canonicalHash({ kind: "receiz.vault.file.chunk-root.v1", path: file.path, size: file.size, mime: file.mime, chunkBytes: file.chunkBytes, chunks: file.shards.map((ref) => ref.chunkSha256) });
    const fileId = await canonicalHash({ kind: "receiz.vault.file.id.v1", path: file.path, size: file.size, mime: file.mime, chunkRootSha256 });
    if (chunkRootSha256 !== file.chunkRootSha256 || fileId !== file.fileId) errors.push(`File identity mismatch for ${file.path}.`);

    for (const ref of file.shards) {
      const entry = zip.file(ref.path);
      if (!entry) { errors.push(`Missing vault key ${ref.path}.`); continue; }
      const shard = parseRecord(await entry.async("string"), ref.path) as unknown as VaultShard;
      if (shard.kind !== "receiz.vault.shard.v1" || shard.version !== 1) { errors.push(`${ref.path} has an unsupported vault key kind or version.`); continue; }
      if (shard.vaultId !== root.vaultId || shard.fileId !== file.fileId || shard.path !== file.path) errors.push(`Vault key ${ref.path} identity mismatch.`);
      if (shard.chunk.index !== ref.index || shard.chunk.total !== file.chunkCount || shard.chunk.offset !== ref.offset || shard.coordinate.leafIndex !== ref.leafIndex) errors.push(`Vault key ${ref.path} coordinate mismatch.`);
      if (shard.chunk.encoding !== root.restore.encoding || shard.leafSha256 !== ref.leafSha256 || shard.merkle.rootSha256 !== root.merkle.rootSha256) errors.push(`Vault key ${ref.path} proof metadata mismatch.`);
      const chunk = base64UrlDecode(shard.chunk.dataB64u);
      const chunkHash = await sha256Hex(chunk);
      if (chunk.byteLength !== ref.size || chunk.byteLength !== shard.chunk.size || chunkHash !== ref.chunkSha256 || chunkHash !== shard.chunk.sha256) errors.push(`Vault key ${ref.path} byte hash mismatch.`);
      const leaf = await canonicalHash({ kind: "receiz.vault.leaf.v1", fileId: file.fileId, path: file.path, chunkIndex: ref.index, chunkSha256: chunkHash });
      if (leaf !== ref.leafSha256 || leaf !== shard.leafSha256 || await merkleRootFromProof(leaf, shard.merkle.path) !== root.merkle.rootSha256) errors.push(`Vault key ${ref.path} Merkle proof mismatch.`);
      const expectedLinks = fibonacciBacklinks(ref.leafIndex);
      if (expectedLinks.length !== shard.fibonacci.links.length || expectedLinks.some((expected, index) => {
        const actual = shard.fibonacci.links[index];
        return !actual || actual.distance !== expected.distance || actual.leafIndex !== expected.leafIndex || actual.leafSha256 !== byLeaf.get(expected.leafIndex)?.leafSha256;
      })) errors.push(`Vault key ${ref.path} Fibonacci backlinks mismatch.`);
    }
  }
  if (errors.length) throw new Error(errors[0]);
  return root;
}
