import { zlibSync, unzlibSync, strToU8, strFromU8 } from "fflate";

const MAX_RECORD_BYTES = 32 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;

export function compressPublicCardRecord(json: string) {
  const bytes = strToU8(json);
  if (bytes.length > MAX_RECORD_BYTES) throw new Error("wildz_public_card_record_too_large");
  const compressed = zlibSync(bytes, { level: 6 });
  if (compressed.length > MAX_COMPRESSED_BYTES) throw new Error("wildz_public_card_record_too_large");
  let binary = "";
  for (let index = 0; index < compressed.length; index += 8192) binary += String.fromCharCode(...compressed.subarray(index, index + 8192));
  return { recordDeflateB64: btoa(binary), recordByteLength: bytes.length };
}

/** Allocate a bounded output buffer before decoding untrusted public transport. */
export function decompressPublicCardRecord(encoded: unknown, byteLength: unknown): string {
  if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_COMPRESSED_BYTES / 3) * 4
    || !Number.isSafeInteger(byteLength) || Number(byteLength) < 1 || Number(byteLength) > MAX_RECORD_BYTES) throw new Error("wildz_public_card_transport_invalid");
  const binary = atob(encoded);
  const compressed = Uint8Array.from(binary, character => character.charCodeAt(0));
  const output = new Uint8Array(Number(byteLength));
  const restored = unzlibSync(compressed, { out: output });
  if (restored.length !== byteLength) throw new Error("wildz_public_card_transport_invalid");
  return strFromU8(restored);
}
