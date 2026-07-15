import { sha256PortableBasis } from "./portable-card";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import { landmarkApproachPoint, WILDS_FLAGSHIP_LANDMARKS } from "./wilds-landmarks";
import { WILDS_MAJOR_ROUTES } from "./wilds-world-geography";
import type { WildsDynamicSitePhase, WildsWorldSiteProjection } from "./wilds-world-state";

export type { WildsDynamicSitePhase } from "./wilds-world-state";

export type WildsDynamicSite = WildsWorldSiteProjection & {
  familyId: "crystal-burrow";
  name: "Crystal Burrow";
  radius: 9;
};

const CLEARANCE = 12;
const SITE_LIFETIME_MS = 72 * 60 * 60 * 1_000;

function distanceToSegment(point: { x: number; z: number }, start: { x: number; z: number }, end: { x: number; z: number }) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.z - start.z);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.z - (start.z + dz * t));
}

export function isDynamicSitePositionSafe(position: { x: number; z: number }, activeSites: readonly WildsDynamicSite[]) {
  for (const landmark of WILDS_FLAGSHIP_LANDMARKS) {
    if (Math.hypot(position.x - landmark.position.x, position.z - landmark.position.z) < landmark.radius + CLEARANCE) return false;
    const approach = landmarkApproachPoint(landmark);
    if (Math.hypot(position.x - approach.x, position.z - approach.z) < CLEARANCE) return false;
  }
  for (const route of WILDS_MAJOR_ROUTES) {
    for (let index = 1; index < route.points.length; index += 1) {
      if (distanceToSegment(position, route.points[index - 1]!, route.points[index]!) < CLEARANCE) return false;
    }
  }
  return activeSites.every((site) => Math.hypot(position.x - site.position.x, position.z - site.position.z) >= site.radius + 9 + CLEARANCE);
}

function hexUnit(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 8), 16) / 0xffffffff;
}

function candidatePosition(seed: string, probe: number) {
  const digest = sha256PortableBasis(`${seed}:probe:${probe}`).slice("sha256:".length);
  const directionX = hexUnit(digest, 0) < 0.5 ? -1 : 1;
  const directionZ = hexUnit(digest, 8) < 0.5 ? -1 : 1;
  const regionX = directionX * (2 + Math.floor(hexUnit(digest, 16) * 4));
  const regionZ = directionZ * (2 + Math.floor(hexUnit(digest, 24) * 4));
  const inset = 10;
  return {
    x: regionX * WILDS_REGION_SIZE + inset + Math.floor(hexUnit(digest, 32) * (WILDS_REGION_SIZE - inset * 2)),
    z: regionZ * WILDS_REGION_SIZE + inset + Math.floor(hexUnit(digest, 40) * (WILDS_REGION_SIZE - inset * 2))
  };
}

export function generateCrystalBurrow(input: { pulse: string; ordinal: number; activeSites: readonly WildsDynamicSite[] }): WildsDynamicSite {
  const spawnedAtMs = Date.parse(input.pulse);
  if (!Number.isFinite(spawnedAtMs)) throw new Error("wilds_dynamic_site_pulse_invalid");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) throw new Error("wilds_dynamic_site_ordinal_invalid");
  const basis = `wilds:global:v3:crystal-burrow:${input.pulse}:${input.ordinal}`;
  const seedDigest = sha256PortableBasis(basis);
  let position: { x: number; z: number } | null = null;
  for (let probe = 0; probe < 128; probe += 1) {
    const candidate = candidatePosition(seedDigest, probe);
    if (isDynamicSitePositionSafe(candidate, input.activeSites)) {
      position = candidate;
      break;
    }
  }
  if (!position) throw new Error("wilds_dynamic_site_position_unavailable");
  return {
    id: `site:crystal-burrow:${seedDigest.slice("sha256:".length, "sha256:".length + 24)}`,
    familyId: "crystal-burrow",
    name: "Crystal Burrow",
    position,
    radius: 9,
    phase: "rumored",
    spawnedAt: new Date(spawnedAtMs).toISOString(),
    expiresAt: new Date(spawnedAtMs + SITE_LIFETIME_MS).toISOString(),
    bossId: null,
    seedDigest
  };
}

const transitions: Record<WildsDynamicSitePhase, readonly WildsDynamicSitePhase[]> = {
  rumored: ["tracked", "expired"],
  tracked: ["emerged", "expired"],
  emerged: ["assaulting", "engaged", "expired"],
  assaulting: ["engaged", "expired"],
  engaged: ["defeated"],
  defeated: ["memorialized"],
  memorialized: [],
  expired: []
};

export function advanceDynamicSite(site: WildsDynamicSite, phase: WildsDynamicSitePhase): WildsDynamicSite {
  if (!transitions[site.phase].includes(phase)) throw new Error("wilds_dynamic_site_transition_invalid");
  return { ...site, phase };
}
