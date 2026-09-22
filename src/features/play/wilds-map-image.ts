import { pngCrc32 } from "../../lib/png-crc32";
import { splitWildzPngEnvelope } from "../../lib/receiz/wildz-png-envelope";
import { isWildsExplorationCoordinate, mergeWildsExplorationAtlases, type WildsExplorationAtlas, type WildsExplorationRow } from "./wilds-exploration-atlas";
import { WILDS_TERRAIN_VERSION } from "./wilds-terrain-authority";

// Segment the carrier, never the territory. A PNG chunk has a finite wire length.
const MAP_CHUNK_BYTES = 1024 * 1024;
const MAP_CHUNK = "waMp";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const empty: WildsExplorationAtlas = { version: 1, rows: [], siteKeys: [] };

function validateTerritory(value: unknown): WildsExplorationAtlas {
  if (!value || typeof value !== "object") throw new Error("This image has invalid map data.");
  const atlas = value as Partial<WildsExplorationAtlas>;
  if (atlas.version !== 1 || !Array.isArray(atlas.rows) || !atlas.rows.length) throw new Error("This map version is not supported.");
  const coordinate = isWildsExplorationCoordinate;
  for (const row of atlas.rows) {
    if (!row || !coordinate(row.z) || !Array.isArray(row.ranges) || !row.ranges.length) throw new Error("This image has invalid territory coordinates.");
    for (const range of row.ranges) {
      if (!range || !coordinate(range.minX) || !coordinate(range.maxX) || range.minX > range.maxX) throw new Error("This image has invalid territory coordinates.");
    }
  }
  return mergeWildsExplorationAtlases(empty, { version: 1, rows: atlas.rows as WildsExplorationRow[], siteKeys: [] });
}

function chunks(source: Uint8Array) {
  const { pngBasis, trailer } = splitWildzPngEnvelope(source);
  if (trailer.length) throw new Error("Choose an original Wildz map PNG.");
  const view = new DataView(pngBasis.buffer, pngBasis.byteOffset, pngBasis.byteLength);
  const result: Array<{ type: string; offset: number; data: Uint8Array }> = [];
  for (let offset = 8; offset < pngBasis.length;) {
    const length = view.getUint32(offset);
    result.push({ type: decoder.decode(pngBasis.subarray(offset + 4, offset + 8)), offset, data: pngBasis.subarray(offset + 8, offset + 8 + length) });
    offset += length + 12;
  }
  return result;
}

export function embedWildsMapInPng(source: Uint8Array, atlas: WildsExplorationAtlas): Uint8Array {
  const territory = validateTerritory(atlas);
  const parsed = chunks(source);
  if (parsed.some(chunk => chunk.type === MAP_CHUNK)) throw new Error("This image already contains a map.");
  const data = encoder.encode(JSON.stringify({ schema: "wildz.map.v1", terrain: WILDS_TERRAIN_VERSION, atlas: territory }));
  const chunkCount = Math.ceil(data.length / MAP_CHUNK_BYTES);
  const end = parsed.at(-1)!.offset;
  const result = new Uint8Array(source.length + data.length + chunkCount * 12);
  result.set(source.subarray(0, end));
  const view = new DataView(result.buffer);
  const type = encoder.encode(MAP_CHUNK);
  let outputOffset = end;
  for (let offset = 0; offset < data.length; offset += MAP_CHUNK_BYTES) {
    const part = data.subarray(offset, offset + MAP_CHUNK_BYTES);
    view.setUint32(outputOffset, part.length);
    result.set(type, outputOffset + 4); result.set(part, outputOffset + 8);
    view.setUint32(outputOffset + part.length + 8, pngCrc32(type, part));
    outputOffset += part.length + 12;
  }
  result.set(source.subarray(end), outputOffset);
  return result;
}

export function readWildsMapFromPng(source: Uint8Array): WildsExplorationAtlas {
  let parsed: ReturnType<typeof chunks>;
  try { parsed = chunks(source); } catch { throw new Error("Could not read this map. Choose an intact original Wildz map PNG."); }
  const maps = parsed.filter(chunk => chunk.type === MAP_CHUNK);
  if (maps.length === 0) throw new Error("This image has no readable Wildz map. Ask for the original saved PNG.");
  let payload;
  try {
    const reader = new TextDecoder("utf-8", { fatal: true });
    const parts = maps.map(chunk => reader.decode(chunk.data, { stream: true }));
    parts.push(reader.decode());
    payload = JSON.parse(parts.join(""));
  } catch { throw new Error("This image has damaged map data."); }
  if (!payload || payload.schema !== "wildz.map.v1" || payload.terrain !== WILDS_TERRAIN_VERSION) throw new Error("This image is for a different map version.");
  return validateTerritory(payload.atlas);
}

/** Share geographic knowledge only: site visits may trigger personal quest rewards. */
export function mergeWildsMapDiscovery(local: WildsExplorationAtlas, incoming: WildsExplorationAtlas): WildsExplorationAtlas {
  const merged = mergeWildsExplorationAtlases(local, validateTerritory(incoming));
  return { ...merged, siteKeys: local.siteKeys };
}
