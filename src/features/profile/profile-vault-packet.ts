import { Gunzip, gzipSync } from "fflate";
import type { PortableCardAsset } from "../play/portable-card";

/** Exact public card bytes, compressed once rather than repeated in the SDK
 * envelope or downloaded again for local display math and card inspection. */
export type WildzProfileVaultPacket = Readonly<{
  schema: "wildz.public-vault.gzip.v1";
  bytes: number;
  data: string;
}>;
const MAX_BYTES = 32 * 1024 * 1024, MAX_DATA = 700_000;
const invalid = () => new Error("wildz_public_profile_card_packet_invalid");

export function parseWildzProfileVaultPacket(value: unknown): WildzProfileVaultPacket {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const packet = value as WildzProfileVaultPacket;
  if (Object.keys(packet).sort().join(",") !== "bytes,data,schema" || packet.schema !== "wildz.public-vault.gzip.v1"
    || !Number.isSafeInteger(packet.bytes) || packet.bytes < 2 || packet.bytes > MAX_BYTES
    || typeof packet.data !== "string" || !packet.data.length || packet.data.length > MAX_DATA
    || packet.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(packet.data)) throw invalid();
  return { schema: packet.schema, bytes: packet.bytes, data: packet.data };
}

function compressedBytes(packet: WildzProfileVaultPacket) {
  return Uint8Array.from(atob(parseWildzProfileVaultPacket(packet).data), char => char.charCodeAt(0));
}

/** Large Originals keep their existing independent recovery path. Never make
 * a profile publication fail because a transport optimization exceeds budget. */
export function createWildzProfileVaultPacket(cards: readonly PortableCardAsset[]): WildzProfileVaultPacket | null {
  if (!cards.length) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(cards));
  if (bytes.length > MAX_BYTES) return null;
  const compressed = gzipSync(bytes, { level: 6, mtime: 0 });
  if (Math.ceil(compressed.length / 3) * 4 > MAX_DATA) return null;
  const chunks: string[] = [];
  for (let index = 0; index < compressed.length; index += 8192) chunks.push(String.fromCharCode(...compressed.subarray(index, index + 8192)));
  return { schema: "wildz.public-vault.gzip.v1", bytes: bytes.length, data: btoa(chunks.join("")) };
}

export function readWildzProfileVaultPacket(packet: WildzProfileVaultPacket): unknown {
  const input = compressedBytes(packet), parts: Uint8Array[] = [];
  let size = 0;
  const stream = new Gunzip(chunk => {
    size += chunk.length;
    if (size > packet.bytes) throw invalid();
    parts.push(chunk);
  });
  for (let index = 0; index < input.length; index += 1024) stream.push(input.subarray(index, index + 1024), index + 1024 >= input.length);
  if (size !== packet.bytes) throw invalid();
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(output));
}

/** Native decompression yields while the already complete profile stays painted. */
export async function readWildzProfileVaultPacketAsync(packet: WildzProfileVaultPacket): Promise<unknown> {
  if (typeof DecompressionStream === "undefined") return readWildzProfileVaultPacket(packet);
  const input = compressedBytes(packet), reader = new Blob([input]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > packet.bytes) throw invalid();
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (size !== packet.bytes) throw invalid();
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return JSON.parse(new TextDecoder().decode(output));
}
