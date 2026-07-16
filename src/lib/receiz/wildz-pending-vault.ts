import { receizBase64UrlEncode } from "@receiz/sdk";
import type {
  WildzContinuityDatabase,
  WildzContinuityTransaction
} from "../storage/wildz-indexed-db";
import {
  parseWildzPlayerCoordinate,
  type WildzPlayerCoordinate
} from "./wildz-player-coordinate";

export const MAX_WILDZ_PENDING_VAULT_BYTES = 64 * 1024 * 1024;
export const MAX_WILDZ_PENDING_VAULT_RECORDS = 3;
export const MAX_WILDZ_PENDING_VAULT_TOTAL_BYTES = 96 * 1024 * 1024;
export const WILDZ_PENDING_VAULT_TTL_MS = 15 * 60 * 1000;

export type WildzPendingVaultRestore = {
  schema: "receiz.wildz.pending_vault_restore.v1";
  resumeId: string;
  surface: "genesis" | "card-vault";
  bytes: Uint8Array;
  byteDigestSha256: string;
  mimeType: string;
  name: string | null;
  player: WildzPlayerCoordinate;
  proofBasisSha256: string;
  createdAtMs: number;
  expiresAtMs: number;
};

export type WildzPendingVaultStageInput = Pick<
  WildzPendingVaultRestore,
  "surface" | "bytes" | "mimeType" | "name" | "player" | "proofBasisSha256"
>;

export interface WildzPendingVaultRepository {
  stage(input: WildzPendingVaultStageInput): Promise<WildzPendingVaultRestore>;
  load(resumeId: string): Promise<WildzPendingVaultRestore | null>;
  loadPrepared(tx: WildzContinuityTransaction, resumeId: string): Promise<WildzPendingVaultRestore | null>;
  deletePrepared(tx: WildzContinuityTransaction, resumeId: string): Promise<void>;
  purgeExpired(): Promise<number>;
}

const RESUME_ID_PATTERN = /^[A-Za-z0-9_-]{22,}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MIME_PATTERN = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/i;

function strictArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function copyRecord(record: WildzPendingVaultRestore): WildzPendingVaultRestore {
  return { ...record, bytes: record.bytes.slice(), player: { ...record.player } };
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function sameWildzPendingVaultRestore(left: WildzPendingVaultRestore, right: WildzPendingVaultRestore) {
  return left.schema === right.schema
    && left.resumeId === right.resumeId
    && left.surface === right.surface
    && left.byteDigestSha256 === right.byteDigestSha256
    && left.mimeType === right.mimeType
    && left.name === right.name
    && left.player.actorId === right.player.actorId
    && left.player.profileHandle === right.player.profileHandle
    && left.proofBasisSha256 === right.proofBasisSha256
    && left.createdAtMs === right.createdAtMs
    && left.expiresAtMs === right.expiresAtMs
    && sameBytes(left.bytes, right.bytes);
}

function safeFilename(value: string | null) {
  if (value === null) return null;
  const leaf = value.trim().split(/[\\/]+/).at(-1) ?? "";
  const sanitized = leaf.replace(/[^a-z0-9._ -]+/gi, "_").replace(/\s+/g, " ").slice(0, 120);
  return sanitized || null;
}

function validRecord(value: unknown): value is WildzPendingVaultRestore {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<WildzPendingVaultRestore>;
  const coordinate = record.player && typeof record.player === "object"
    ? parseWildzPlayerCoordinate(record.player.profileHandle ?? "")
    : null;
  return record.schema === "receiz.wildz.pending_vault_restore.v1"
    && typeof record.resumeId === "string"
    && RESUME_ID_PATTERN.test(record.resumeId)
    && (record.surface === "genesis" || record.surface === "card-vault")
    && record.bytes instanceof Uint8Array
    && record.bytes.byteLength > 0
    && record.bytes.byteLength <= MAX_WILDZ_PENDING_VAULT_BYTES
    && typeof record.byteDigestSha256 === "string"
    && SHA256_PATTERN.test(record.byteDigestSha256)
    && typeof record.mimeType === "string"
    && MIME_PATTERN.test(record.mimeType)
    && (record.name === null || typeof record.name === "string")
    && Boolean(coordinate)
    && coordinate?.actorId === record.player?.actorId
    && coordinate?.profileHandle === record.player?.profileHandle
    && typeof record.proofBasisSha256 === "string"
    && SHA256_PATTERN.test(record.proofBasisSha256)
    && typeof record.createdAtMs === "number"
    && Number.isSafeInteger(record.createdAtMs)
    && typeof record.expiresAtMs === "number"
    && Number.isSafeInteger(record.expiresAtMs)
    && record.expiresAtMs > record.createdAtMs
    && record.expiresAtMs - record.createdAtMs <= WILDZ_PENDING_VAULT_TTL_MS;
}

async function sha256Hex(webCrypto: Crypto, bytes: Uint8Array) {
  const digest = new Uint8Array(await webCrypto.subtle.digest("SHA-256", strictArrayBuffer(bytes)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createWildzPendingVaultRepository(options: {
  database: WildzContinuityDatabase;
  crypto?: Crypto;
  now?: () => number;
}): WildzPendingVaultRepository {
  const webCrypto = options.crypto ?? globalThis.crypto;
  const now = options.now ?? Date.now;
  if (!webCrypto?.subtle) throw new Error("wildz_pending_vault_crypto_unavailable");

  const admitted = (stored: unknown, resumeId: string) => {
    if (stored === null) return null;
    if (!validRecord(stored) || stored.resumeId !== resumeId) throw new Error("wildz_pending_vault_invalid");
    if (stored.expiresAtMs <= now()) return null;
    return copyRecord(stored);
  };

  return {
    async stage(input) {
      if (!(input.bytes instanceof Uint8Array)
        || input.bytes.byteLength === 0
        || input.bytes.byteLength > MAX_WILDZ_PENDING_VAULT_BYTES) {
        throw new Error("wildz_pending_vault_size_invalid");
      }
      const player = parseWildzPlayerCoordinate(input.player.profileHandle);
      if (!player || player.actorId !== input.player.actorId) throw new Error("wildz_pending_vault_player_invalid");
      const proofBasisSha256 = input.proofBasisSha256.trim().toLowerCase();
      if (!SHA256_PATTERN.test(proofBasisSha256)) throw new Error("wildz_pending_vault_proof_basis_invalid");
      const mimeType = input.mimeType.trim().toLowerCase();
      if (!MIME_PATTERN.test(mimeType)) throw new Error("wildz_pending_vault_mime_invalid");

      const bytes = input.bytes.slice();
      const createdAtMs = Math.floor(now());
      const resumeId = receizBase64UrlEncode(webCrypto.getRandomValues(new Uint8Array(24)));
      const record: WildzPendingVaultRestore = {
        schema: "receiz.wildz.pending_vault_restore.v1",
        resumeId,
        surface: input.surface,
        bytes,
        byteDigestSha256: await sha256Hex(webCrypto, bytes),
        mimeType,
        name: safeFilename(input.name),
        player,
        proofBasisSha256,
        createdAtMs,
        expiresAtMs: createdAtMs + WILDZ_PENDING_VAULT_TTL_MS
      };
      if (!validRecord(record)) throw new Error("wildz_pending_vault_invalid");
      await options.database.transaction(["pendingRestores"], "readwrite", async (tx) => {
        const current = createdAtMs;
        const retained: WildzPendingVaultRestore[] = [];
        for (const value of await tx.getAll<unknown>("pendingRestores")) {
          if (!validRecord(value)) throw new Error("wildz_pending_vault_invalid");
          if (value.expiresAtMs <= current) {
            await tx.delete("pendingRestores", value.resumeId);
          } else {
            retained.push(value);
          }
        }
        retained.sort((left, right) => left.createdAtMs - right.createdAtMs || left.resumeId.localeCompare(right.resumeId));
        let retainedBytes = retained.reduce((total, value) => total + value.bytes.byteLength, 0);
        while (retained.length >= MAX_WILDZ_PENDING_VAULT_RECORDS
          || retainedBytes + record.bytes.byteLength > MAX_WILDZ_PENDING_VAULT_TOTAL_BYTES) {
          const oldest = retained.shift();
          if (!oldest) break;
          retainedBytes -= oldest.bytes.byteLength;
          await tx.delete("pendingRestores", oldest.resumeId);
        }
        await tx.put("pendingRestores", copyRecord(record), record.resumeId);
      });
      return copyRecord(record);
    },
    async load(resumeId) {
      if (!RESUME_ID_PATTERN.test(resumeId)) {
        const malformed = await options.database.read<unknown>("pendingRestores", resumeId);
        if (malformed !== null) throw new Error("wildz_pending_vault_invalid");
        return null;
      }
      return options.database.transaction(["pendingRestores"], "readwrite", async (tx) => {
        const stored = await tx.get<unknown>("pendingRestores", resumeId);
        if (stored === null) return null;
        if (!validRecord(stored) || stored.resumeId !== resumeId) throw new Error("wildz_pending_vault_invalid");
        if (stored.expiresAtMs <= now()) {
          await tx.delete("pendingRestores", resumeId);
          return null;
        }
        return copyRecord(stored);
      });
    },
    async loadPrepared(tx, resumeId) {
      if (!RESUME_ID_PATTERN.test(resumeId)) throw new Error("wildz_pending_vault_resume_id_invalid");
      return admitted(await tx.get<unknown>("pendingRestores", resumeId), resumeId);
    },
    async deletePrepared(tx, resumeId) {
      if (!RESUME_ID_PATTERN.test(resumeId)) throw new Error("wildz_pending_vault_resume_id_invalid");
      await tx.delete("pendingRestores", resumeId);
    },
    async purgeExpired() {
      const current = now();
      return options.database.transaction(["pendingRestores"], "readwrite", async (tx) => {
        const stored = await tx.getAll<unknown>("pendingRestores");
        let deleted = 0;
        for (const value of stored) {
          if (!validRecord(value)) continue;
          if (value.expiresAtMs > current) continue;
          await tx.delete("pendingRestores", value.resumeId);
          deleted += 1;
        }
        return deleted;
      });
    }
  };
}
