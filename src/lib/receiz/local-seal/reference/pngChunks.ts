import { inflateSync } from "fflate";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textDecoder = new TextDecoder("utf-8");
const textEncoder = new TextEncoder();

export type PngTextChunk = Readonly<{
  keyword: string;
  text: string;
}>;

export type PngTextReadOptions = Readonly<{
  keyword?: string;
  maxCompressedBytes?: number;
  maxTextBytes?: number;
}>;

function assertPngSignature(bytes: Uint8Array): void {
  if (bytes.length < PNG_SIGNATURE.length) {
    throw new Error("Invalid PNG: missing signature");
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("Invalid PNG: bad signature");
    }
  }
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
}

function indexOfNull(bytes: Uint8Array, start: number): number {
  for (let i = start; i < bytes.length; i += 1) {
    if (bytes[i] === 0) return i;
  }
  return -1;
}

function parseITXtData(data: Uint8Array): PngTextChunk | null {
  const keywordEnd = indexOfNull(data, 0);
  if (keywordEnd <= 0) return null;
  const keyword = textDecoder.decode(data.slice(0, keywordEnd));
  let cursor = keywordEnd + 1;
  if (cursor + 2 > data.length) return null;
  const compressionFlag = data[cursor] ?? 0;
  const compressionMethod = data[cursor + 1] ?? 0;
  cursor += 2;
  if (compressionFlag !== 0 || compressionMethod !== 0) return null;
  const langEnd = indexOfNull(data, cursor);
  if (langEnd < 0) return null;
  cursor = langEnd + 1;
  const translatedEnd = indexOfNull(data, cursor);
  if (translatedEnd < 0) return null;
  cursor = translatedEnd + 1;
  if (cursor > data.length) return null;
  const text = textDecoder.decode(data.slice(cursor));
  return { keyword, text };
}

function parseTextData(data: Uint8Array): PngTextChunk | null {
  const keywordEnd = indexOfNull(data, 0);
  if (keywordEnd <= 0) return null;
  const keyword = textDecoder.decode(data.slice(0, keywordEnd));
  const text = textDecoder.decode(data.slice(keywordEnd + 1));
  return { keyword, text };
}

function parseZTxtData(data: Uint8Array, options?: PngTextReadOptions): PngTextChunk | null {
  const keywordEnd = indexOfNull(data, 0);
  if (keywordEnd <= 0) return null;
  const keyword = textDecoder.decode(data.slice(0, keywordEnd));
  if (options?.keyword && keyword !== options.keyword) return null;
  const compressionMethod = data[keywordEnd + 1] ?? 255;
  if (compressionMethod !== 0) return null;
  const compressed = data.slice(keywordEnd + 2);
  if (options?.maxCompressedBytes !== undefined && compressed.byteLength > options.maxCompressedBytes) {
    return null;
  }
  let inflated: Uint8Array;
  try {
    inflated = options?.maxTextBytes !== undefined
      ? inflateSync(compressed, { out: new Uint8Array(options.maxTextBytes + 1) })
      : inflateSync(compressed);
  } catch {
    return null;
  }
  if (options?.maxTextBytes !== undefined && inflated.byteLength > options.maxTextBytes) return null;
  const text = textDecoder.decode(inflated);
  return { keyword, text };
}

function buildITXtData(entry: PngTextChunk): Uint8Array {
  const keywordBytes = textEncoder.encode(entry.keyword);
  if (keywordBytes.length === 0 || keywordBytes.length > 79) {
    throw new Error("Invalid iTXt keyword length");
  }
  for (const byte of keywordBytes) {
    if (byte === 0) throw new Error("Invalid iTXt keyword");
  }
  const textBytes = textEncoder.encode(entry.text);
  const out = new Uint8Array(keywordBytes.length + 5 + textBytes.length);
  out.set(keywordBytes, 0);
  let cursor = keywordBytes.length;
  out[cursor] = 0;
  out[cursor + 1] = 0;
  out[cursor + 2] = 0;
  out[cursor + 3] = 0;
  out[cursor + 4] = 0;
  cursor += 5;
  out.set(textBytes, cursor);
  return out;
}

let crcTable: Uint32Array | null = null;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildITXtChunk(entry: PngTextChunk): Uint8Array {
  const typeBytes = new Uint8Array([105, 84, 88, 116]);
  const data = buildITXtData(entry);
  const length = data.length;
  const chunk = new Uint8Array(12 + length);
  writeUint32BE(chunk, 0, length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crc = crc32(crcInput);
  writeUint32BE(chunk, 8 + length, crc);
  return chunk;
}

export function readPngTextChunks(pngBytes: Uint8Array, options?: PngTextReadOptions): PngTextChunk[] {
  assertPngSignature(pngBytes);
  const chunks: PngTextChunk[] = [];
  let offset = 8;
  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const type = chunkType(pngBytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > pngBytes.length) break;
    const data = pngBytes.slice(dataStart, dataEnd);
    const parsed =
      type === "iTXt" ? parseITXtData(data) : type === "tEXt" ? parseTextData(data) : type === "zTXt" ? parseZTxtData(data, options) : null;
    if (parsed && (!options?.keyword || parsed.keyword === options.keyword)) chunks.push(parsed);
    offset = dataEnd + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

export function readPngTextChunk(pngBytes: Uint8Array, keyword: string): string | null {
  const chunks = readPngTextChunks(pngBytes);
  for (const chunk of chunks) {
    if (chunk.keyword === keyword) return chunk.text;
  }
  return null;
}

export function insertPngTextChunks(pngBytes: Uint8Array, entries: PngTextChunk[]): Uint8Array {
  if (entries.length === 0) return pngBytes;
  assertPngSignature(pngBytes);
  let offset = 8;
  let iendOffset = -1;
  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const type = chunkType(pngBytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > pngBytes.length) break;
    if (type === "IEND") {
      iendOffset = offset;
      break;
    }
    offset = dataEnd + 4;
  }
  if (iendOffset < 0) {
    throw new Error("Invalid PNG: missing IEND");
  }

  const prefix = pngBytes.slice(0, iendOffset);
  const suffix = pngBytes.slice(iendOffset);
  const chunks = entries.map(buildITXtChunk);
  const totalLength = prefix.length + suffix.length + chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLength);
  let cursor = 0;
  out.set(prefix, cursor);
  cursor += prefix.length;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  out.set(suffix, cursor);
  return out;
}

export function countPngTextChunksByKeyword(pngBytes: Uint8Array, keyword: string): number {
  return readPngTextChunks(pngBytes).filter((chunk) => chunk.keyword === keyword).length;
}

export function stripPngTextChunksByKeyword(
  pngBytes: Uint8Array,
  keyword: string,
): { pngBytes: Uint8Array; removedCount: number } {
  assertPngSignature(pngBytes);

  const retainedChunks: Uint8Array[] = [];
  retainedChunks.push(pngBytes.slice(0, PNG_SIGNATURE.length));

  let offset = PNG_SIGNATURE.length;
  let removedCount = 0;

  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const type = chunkType(pngBytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > pngBytes.length) break;

    let shouldRemove = false;
    if (type === "iTXt" || type === "tEXt" || type === "zTXt") {
      const data = pngBytes.slice(dataStart, dataEnd);
      const parsed =
        type === "iTXt" ? parseITXtData(data) : type === "tEXt" ? parseTextData(data) : parseZTxtData(data);
      if (parsed?.keyword === keyword) shouldRemove = true;
    }

    if (shouldRemove) {
      removedCount += 1;
    } else {
      retainedChunks.push(pngBytes.slice(offset, chunkEnd));
    }

    offset = chunkEnd;
    if (type === "IEND") break;
  }

  const totalLength = retainedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of retainedChunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }

  return { pngBytes: out, removedCount };
}
