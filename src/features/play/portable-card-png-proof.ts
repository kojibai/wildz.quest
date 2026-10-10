import { pngCrc32 as crc32 } from "../../lib/png-crc32";
import { sha256PortableBasis, verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
export const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export const PROOF_CHUNK_TYPE = "rzCd";
export type PortableCardPngProof = {
  schema: "receiz.wilds_png_proof.v1" | "receiz.wilds_png_proof.v2";
  imageDigest: string;
  asset: PortableCardAsset;
};

export type PngChunk = { type: string; data: Uint8Array };

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

export function uint32Bytes(value: number) {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

export function concatBytes(parts: readonly Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function parsePng(bytes: Uint8Array): PngChunk[] {
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) throw new Error("png_signature_invalid");
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("png_chunk_truncated");
    const length = uint32(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("png_chunk_truncated");
    const typeBytes = bytes.slice(offset + 4, offset + 8);
    const type = new TextDecoder().decode(typeBytes);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("png_chunk_type_invalid");
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const expectedCrc = uint32(bytes, offset + 8 + length);
    if (crc32(typeBytes, data) !== expectedCrc) throw new Error(`png_crc_invalid:${type}`);
    chunks.push({ type, data });
    offset = end;
    if (type === "IEND") {
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length) throw new Error("png_end_invalid");
  if (!chunks.some((chunk) => chunk.type === "IHDR") || !chunks.some((chunk) => chunk.type === "IDAT")) throw new Error("png_critical_chunks_missing");
  return chunks;
}

export function imageDigest(chunks: readonly PngChunk[]) {
  const basis = chunks
    .filter((chunk) => chunk.type === "IHDR" || chunk.type === "PLTE" || chunk.type === "IDAT")
    .map((chunk) => `${chunk.type}:${Array.from(chunk.data, (byte) => byte.toString(16).padStart(2, "0")).join("")}`)
    .join("|");
  return sha256PortableBasis(basis);
}

export function readPortableCardFromPng(source: Uint8Array): PortableCardPngProof {
  const chunks = parsePng(source);
  const proofs = chunks.filter((chunk) => chunk.type === PROOF_CHUNK_TYPE);
  if (proofs.length !== 1) throw new Error(proofs.length ? "wilds_png_proof_duplicate" : "wilds_png_proof_missing");
  const decoded = JSON.parse(new TextDecoder().decode(proofs[0]!.data)) as Partial<PortableCardPngProof>;
  if ((decoded.schema !== "receiz.wilds_png_proof.v1" && decoded.schema !== "receiz.wilds_png_proof.v2") || typeof decoded.imageDigest !== "string" || !decoded.asset || typeof decoded.asset !== "object") throw new Error("wilds_png_proof_invalid");
  return decoded as PortableCardPngProof;
}

export function verifyPortableCardPng(source: Uint8Array): { ok: boolean; errors: string[]; asset: PortableCardAsset | null } {
  try {
    const chunks = parsePng(source);
    const proof = readPortableCardFromPng(source);
    const errors = [...verifyAnyWildsCard(proof.asset).errors];
    if (proof.imageDigest !== imageDigest(chunks)) errors.push("png_image_digest_mismatch");
    return { ok: errors.length === 0, errors, asset: errors.length ? null : proof.asset };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : "wilds_png_proof_invalid"], asset: null };
  }
}

