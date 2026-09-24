import { pngCrc32 as crc32 } from "../png-crc32";
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function uint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0);
}

export function isWildzPng(bytes: Uint8Array) {
  return bytes.byteLength >= PNG_SIGNATURE.byteLength
    && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function splitWildzPngEnvelope(bytes: Uint8Array): { pngBasis: Uint8Array; trailer: Uint8Array } {
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
    const type = new TextDecoder("ascii", { fatal: true }).decode(typeBytes);
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("png_chunk_type_invalid");
    const data = bytes.subarray(dataStart, dataEnd);
    if (crc32(typeBytes, data) !== uint32(bytes, dataEnd)) {
      throw new Error(`png_crc_invalid:${type}`);
    }
    if (type === "IHDR") sawHeader = true;
    if (type === "IDAT") sawImageData = true;
    offset = chunkEnd;
    if (type === "IEND") {
      if (length !== 0) throw new Error("png_end_invalid");
      endedAt = chunkEnd;
      break;
    }
  }
  if (endedAt < 0) throw new Error("png_end_invalid");
  if (!sawHeader || !sawImageData) throw new Error("png_critical_chunks_missing");
  return { pngBasis: bytes.slice(0, endedAt), trailer: bytes.slice(endedAt) };
}

/** Lossless transport inspection. This never establishes proof authority. */
export function wildzPngTextChunks(bytes: Uint8Array) {
  const { pngBasis, trailer } = splitWildzPngEnvelope(bytes);
  const chunks: { start: number; end: number; keyword: string | null }[] = [];
  for (let start = 8; start < pngBasis.length;) {
    const length = uint32(pngBasis, start);
    const end = start + 12 + length;
    const type = new TextDecoder().decode(pngBasis.subarray(start + 4, start + 8));
    const data = pngBasis.subarray(start + 8, start + 8 + length);
    const zero = data.indexOf(0);
    const keyword = ["tEXt", "iTXt", "zTXt"].includes(type) && zero >= 0
      ? new TextDecoder().decode(data.subarray(0, zero)) : null;
    chunks.push({ start, end, keyword });
    start = end;
  }
  return { pngBasis, trailer, chunks };
}

export function hasWildzCanonicalPngProof(bytes: Uint8Array) {
  return wildzPngTextChunks(bytes).chunks.some(chunk => chunk.keyword === "receiz.proof_bundle");
}

/** Only use after canonical admission; compare the result with its payload digest. */
export function extractWildzSealedPngBasis(bytes: Uint8Array) {
  const { pngBasis, trailer, chunks } = wildzPngTextChunks(bytes);
  if (trailer.length) throw new Error("wildz_card_payload_unbound_trailer");
  const excluded = new Set(["receiz.proof_bundle", "receiz.ownership_provenance"]);
  const parts = [pngBasis.subarray(0, 8), ...chunks.filter(c => !excluded.has(c.keyword ?? ""))
    .map(c => pngBasis.subarray(c.start, c.end))];
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
