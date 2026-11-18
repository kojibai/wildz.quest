import { pngCrc32 as crc32 } from "../png-crc32";
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

export function isWildzPng(bytes: Uint8Array) {
  return bytes.byteLength >= PNG_SIGNATURE.byteLength
    && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

type PngChunkLocation = { start: number; end: number; keyword: string | null };
const chunkTypeDecoder = new TextDecoder("ascii", { fatal: true });
const keywordDecoder = new TextDecoder();

function inspectEnvelope(bytes: Uint8Array, visit?: (chunk: PngChunkLocation) => void) {
  if (!isWildzPng(bytes)) throw new Error("png_signature_invalid");
  let offset = PNG_SIGNATURE.byteLength;
  let sawHeader = false;
  let sawImageData = false;
  let endedAt = -1;
  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) throw new Error("png_chunk_truncated");
    const length = uint32(bytes, offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.byteLength) throw new Error("png_chunk_truncated");
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = chunkTypeDecoder.decode(typeBytes);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("png_chunk_type_invalid");
    const data = bytes.subarray(dataStart, dataEnd);
    if (crc32(typeBytes, data) !== uint32(bytes, dataEnd)) {
      throw new Error(`png_crc_invalid:${type}`);
    }
    if (type === "IHDR") sawHeader = true;
    if (type === "IDAT") sawImageData = true;
    if (visit) {
      const zero = type === "tEXt" || type === "iTXt" || type === "zTXt" ? data.indexOf(0) : -1;
      visit({ start: offset, end: chunkEnd, keyword: zero < 0 ? null : keywordDecoder.decode(data.subarray(0, zero)) });
    }
    offset = chunkEnd;
    if (type === "IEND") {
      if (length !== 0) throw new Error("png_end_invalid");
      endedAt = chunkEnd;
      break;
    }
  }
  if (endedAt < 0) throw new Error("png_end_invalid");
  if (!sawHeader || !sawImageData) throw new Error("png_critical_chunks_missing");
  return endedAt;
}

export function splitWildzPngEnvelope(bytes: Uint8Array): { pngBasis: Uint8Array; trailer: Uint8Array } {
  const endedAt = inspectEnvelope(bytes);
  return { pngBasis: bytes.slice(0, endedAt), trailer: bytes.slice(endedAt) };
}

/** Lossless transport inspection. This never establishes proof authority. */
export function wildzPngTextChunks(bytes: Uint8Array) {
  const chunks: PngChunkLocation[] = [];
  const end = inspectEnvelope(bytes, chunk => chunks.push(chunk));
  return { pngBasis: bytes.slice(0, end), trailer: bytes.slice(end), chunks };
}

export function hasWildzCanonicalPngProof(bytes: Uint8Array) {
  let found = false;
  inspectEnvelope(bytes, chunk => { if (chunk.keyword === "receiz.proof_bundle") found = true; });
  return found;
}

/** Only use after canonical admission; compare the result with its payload digest. */
export function extractWildzSealedPngBasis(bytes: Uint8Array) {
  const parts = [bytes.subarray(0, PNG_SIGNATURE.length)];
  const end = inspectEnvelope(bytes, chunk => {
    if (chunk.keyword !== "receiz.proof_bundle" && chunk.keyword !== "receiz.ownership_provenance") {
      parts.push(bytes.subarray(chunk.start, chunk.end));
    }
  });
  if (end !== bytes.byteLength) throw new Error("wildz_card_payload_unbound_trailer");
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
