/** Standard PNG CRC-32, shared by export and import. Accepts separate chunks to
 * avoid copying entire image payloads just to validate their checksum. */
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
export function pngCrc32(...parts: readonly Uint8Array[]): number {
  let crc = 0xffffffff;
  for (const bytes of parts) for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]!) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}
