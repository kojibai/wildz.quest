import type { KaiDayPhase } from "./kai-moment-expression";
import type { WildsQualityTier } from "./wilds-quality-profile";

const STAR_COUNTS: Readonly<Record<WildsQualityTier, number>> = { low: 96, medium: 160, high: 240 };
const STAR_RADIUS = 46;

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function seededUnit(state: { value: number }) {
  state.value += 0x6d2b79f5;
  let value = state.value;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 0x1_0000_0000;
}

export type WildsStarField = Readonly<{
  count: number;
  positions: Float32Array;
  brightness: Float32Array;
}>;

export function wildsStarCountForTier(tier: WildsQualityTier) {
  return STAR_COUNTS[tier];
}

export function projectWildsStarField(tier: WildsQualityTier): WildsStarField {
  const count = wildsStarCountForTier(tier);
  const state = { value: hashSeed("receiz-wilds-celestial-field.v1") };
  const positions = new Float32Array(count * 3);
  const brightness = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const azimuth = seededUnit(state) * Math.PI * 2;
    const elevation = 0.04 + seededUnit(state) * (Math.PI / 2 - 0.08);
    const radius = STAR_RADIUS + (seededUnit(state) - 0.5) * 2;
    const horizontal = Math.cos(elevation) * radius;
    positions[index * 3] = Math.cos(azimuth) * horizontal;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(azimuth) * horizontal;
    brightness[index] = 0.56 + seededUnit(state) * 0.44;
  }
  return { count, positions, brightness };
}

const CONSTELLATION_EDGES: Readonly<Record<KaiDayPhase, readonly (readonly [number, number])[]>> = {
  sunrise: [[0, 1], [1, 2], [2, 3], [1, 4]],
  morning: [[0, 2], [2, 4], [4, 5], [5, 1], [1, 3]],
  midday: [[0, 3], [3, 6], [6, 2], [2, 5], [5, 0]],
  afternoon: [[0, 1], [1, 5], [5, 6], [6, 3], [3, 2]],
  twilight: [[0, 4], [4, 2], [2, 6], [6, 1], [1, 5], [5, 3]],
  night: [[0, 2], [2, 5], [5, 7], [7, 4], [4, 1], [1, 6], [6, 3]]
};

const CONSTELLATION_POINTS = [
  [-0.72, 0.22], [-0.48, 0.68], [-0.2, -0.16], [0.08, 0.46],
  [0.32, -0.34], [0.48, 0.7], [0.72, 0.08], [0.84, 0.5]
] as const;

export type WildsConstellation = Readonly<{ segmentCount: number; positions: Float32Array }>;

export function projectWildsConstellation(phase: KaiDayPhase): WildsConstellation {
  const edges = CONSTELLATION_EDGES[phase];
  const positions = new Float32Array(edges.length * 6);
  edges.forEach(([from, to], edgeIndex) => {
    const a = CONSTELLATION_POINTS[from]!;
    const b = CONSTELLATION_POINTS[to]!;
    const values = [a[0] * 8, 15 + a[1] * 6, -42, b[0] * 8, 15 + b[1] * 6, -42];
    positions.set(values, edgeIndex * 6);
  });
  return { segmentCount: edges.length, positions };
}
