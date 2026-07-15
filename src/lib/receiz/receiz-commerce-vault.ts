import { createReceizClient, type DocumentVerifyResponse } from "@receiz/sdk";
import { verifyReceizVaultPackage } from "./receiz-vault-package";

const RECEIZ_VAULT_LIBRARY_KEY = "receiz:wildz:receiz-vault-library:v1";
const SIGNAL_MANIFEST_KEY = "receiz.signal_vault_card_manifest";
const SIGNAL_ARCHIVE_SHA_KEY = "receiz.signal_vault_card_archive_sha256";
const SIGNAL_ARCHIVE_COUNT_KEY = "receiz.signal_vault_card_archive_count";
const SIGNAL_ARCHIVE_PREFIX = "receiz.signal_vault_card_archive.";
const SPORTS_MANIFEST_KEY = "receiz.sports_arena.vault_card_manifest";
const SPORTS_ARCHIVE_SHA_KEY = "receiz.sports_arena.vault_card_archive_sha256";
const SPORTS_ARCHIVE_COUNT_KEY = "receiz.sports_arena.vault_card_archive_count";
const SPORTS_ARCHIVE_PREFIX = "receiz.sports_arena.vault_card_archive.";

export type ReceizCommerceCardProjection = {
  id: string;
  name: string;
  kind: string;
  rarity: string;
  proofHash: string;
  imageUrl: string | null;
  source: "signal" | "sports" | "sealed-artifact";
};

export type ReceizCommerceVaultProjection = {
  id: string;
  schema: "receiz.wildz.commerce_vault_projection.v1";
  sourceSchema: string;
  filename: string;
  ownerLabel: string | null;
  importedAt: string;
  verification: "receiz-sdk" | "receiz-commerce-embedded-vault" | "receiz-commerce-vault-package";
  cards: ReceizCommerceCardProjection[];
};

type PngText = { keyword: string; text: string };

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0;
}

function nullIndex(bytes: Uint8Array, start: number) {
  for (let index = start; index < bytes.length; index += 1) if (bytes[index] === 0) return index;
  return -1;
}

function pngTextChunks(bytes: Uint8Array): PngText[] {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (signature.some((value, index) => bytes[index] !== value)) return [];
  const decoder = new TextDecoder();
  const found: PngText[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = uint32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (offset + 12 + length > bytes.length) break;
    if (type === "iTXt") {
      const keywordEnd = nullIndex(data, 0);
      if (keywordEnd > 0) {
        let cursor = keywordEnd + 3;
        const languageEnd = nullIndex(data, cursor);
        cursor = languageEnd < 0 ? data.length : languageEnd + 1;
        const translatedEnd = nullIndex(data, cursor);
        cursor = translatedEnd < 0 ? data.length : translatedEnd + 1;
        found.push({ keyword: decoder.decode(data.slice(0, keywordEnd)), text: decoder.decode(data.slice(cursor)) });
      }
    } else if (type === "tEXt") {
      const keywordEnd = nullIndex(data, 0);
      if (keywordEnd > 0) found.push({ keyword: decoder.decode(data.slice(0, keywordEnd)), text: decoder.decode(data.slice(keywordEnd + 1)) });
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return found;
}

function first(chunks: readonly PngText[], keyword: string) {
  return chunks.find((chunk) => chunk.keyword === keyword)?.text ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256Hex(bytes: Uint8Array) {
  const source = bytes.slice().buffer;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", source))].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function embeddedVaultProjection(file: File, bytes: Uint8Array): Promise<ReceizCommerceVaultProjection | null> {
  const chunks = pngTextChunks(bytes);
  const signal = first(chunks, SIGNAL_MANIFEST_KEY);
  const sports = first(chunks, SPORTS_MANIFEST_KEY);
  const manifestText = signal ?? sports;
  if (!manifestText) return null;
  const manifest = asRecord(JSON.parse(manifestText));
  const archive = asRecord(manifest?.archive);
  const cards = Array.isArray(manifest?.cards) ? manifest.cards.map(asRecord).filter(Boolean) as Record<string, unknown>[] : [];
  const archiveShaKey = signal ? SIGNAL_ARCHIVE_SHA_KEY : SPORTS_ARCHIVE_SHA_KEY;
  const archiveCountKey = signal ? SIGNAL_ARCHIVE_COUNT_KEY : SPORTS_ARCHIVE_COUNT_KEY;
  const archivePrefix = signal ? SIGNAL_ARCHIVE_PREFIX : SPORTS_ARCHIVE_PREFIX;
  const expectedSha = text(first(chunks, archiveShaKey));
  const count = Number(first(chunks, archiveCountKey));
  if (!manifest || !archive || !expectedSha || !Number.isInteger(count) || count <= 0 || count > 100_000) return null;
  const parts = new Array<string | null>(count).fill(null);
  for (const chunk of chunks) {
    if (!chunk.keyword.startsWith(archivePrefix)) continue;
    const index = Number(chunk.keyword.slice(archivePrefix.length));
    if (Number.isInteger(index) && index >= 0 && index < count) parts[index] = chunk.text;
  }
  if (parts.some((part) => part === null)) throw new Error("receiz_vault_archive_chunk_missing");
  const archiveBytes = decodeBase64Url(parts.join(""));
  const digest = await sha256Hex(archiveBytes);
  if (digest !== expectedSha || digest !== text(archive.sha256Hex)) throw new Error("receiz_vault_archive_hash_mismatch");
  const source = signal ? "signal" as const : "sports" as const;
  return {
    id: text(manifest.vaultCardId) || expectedSha,
    schema: "receiz.wildz.commerce_vault_projection.v1",
    sourceSchema: text(manifest.schema),
    filename: file.name,
    ownerLabel: text(manifest.ownerLabel) || null,
    importedAt: new Date().toISOString(),
    verification: "receiz-commerce-embedded-vault",
    cards: cards.map((card) => {
      const media = asRecord(card.media);
      return {
        id: text(card.collectibleId) || text(card.claimHash),
        name: text(card.name) || text(card.athlete) || "Receiz sealed card",
        kind: text(card.kind) || text(card.sport) || "Receiz card",
        rarity: text(card.rarity) || "Sealed",
        proofHash: text(card.claimHash),
        imageUrl: text(media?.imageUrl) || null,
        source
      };
    })
  };
}

function sdkProjection(file: File, verified: DocumentVerifyResponse): ReceizCommerceVaultProjection {
  const bundle = asRecord(verified.bundle);
  const id = text(bundle?.receizClaimId) || text(bundle?.artifactSha256Basis) || `${file.name}:${file.size}`;
  return {
    id,
    schema: "receiz.wildz.commerce_vault_projection.v1",
    sourceSchema: text(bundle?.kind) || verified.kind,
    filename: file.name,
    ownerLabel: null,
    importedAt: new Date().toISOString(),
    verification: "receiz-sdk",
    cards: [{
      id,
      name: file.name.replace(/\.receized(?:\.png)?$/i, "").replace(/[-_]+/g, " "),
      kind: verified.kind || "Receiz sealed artifact",
      rarity: "Receized",
      proofHash: text(bundle?.artifactSha256Basis) || text(bundle?.groth16ProofDigest),
      imageUrl: null,
      source: "sealed-artifact"
    }]
  };
}

export async function inspectReceizCommerceVault(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const embedded = await embeddedVaultProjection(file, bytes);
  if (embedded) return embedded;
  if (file.name.toLowerCase().endsWith(".receizvault") || file.type === "application/vnd.receiz.vault+zip") {
    const root = await verifyReceizVaultPackage(bytes);
    return {
      id: root.vaultId,
      schema: "receiz.wildz.commerce_vault_projection.v1",
      sourceSchema: root.kind,
      filename: file.name,
      ownerLabel: null,
      importedAt: new Date().toISOString(),
      verification: "receiz-commerce-vault-package",
      cards: root.files.map((entry) => ({
        id: entry.fileId,
        name: entry.name || entry.path.split("/").at(-1) || "Receiz sealed asset",
        kind: entry.mime || "Receiz vault asset",
        rarity: "Receized",
        proofHash: entry.chunkRootSha256,
        imageUrl: null,
        source: "sealed-artifact" as const
      }))
    } satisfies ReceizCommerceVaultProjection;
  }
  const client = typeof window === "undefined"
    ? createReceizClient()
    : createReceizClient({ baseUrl: window.location.origin, fetchImpl: (input, init) => window.fetch(input, init) });
  const verified = await client.verification.verifyArtifact(file);
  if (!verified.ok) throw new Error(verified.errors[0] ?? "receiz_artifact_invalid");
  return sdkProjection(file, verified);
}

export function readReceizCommerceVaultLibrary(storage: Pick<Storage, "getItem"> = window.localStorage): ReceizCommerceVaultProjection[] {
  try {
    const parsed = JSON.parse(storage.getItem(RECEIZ_VAULT_LIBRARY_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is ReceizCommerceVaultProjection => asRecord(item)?.schema === "receiz.wildz.commerce_vault_projection.v1") : [];
  } catch {
    return [];
  }
}

export function saveReceizCommerceVault(projection: ReceizCommerceVaultProjection, storage: Pick<Storage, "getItem" | "setItem"> = window.localStorage) {
  const existing = readReceizCommerceVaultLibrary(storage);
  storage.setItem(RECEIZ_VAULT_LIBRARY_KEY, JSON.stringify([projection, ...existing.filter((item) => item.id !== projection.id)].slice(0, 24)));
}
