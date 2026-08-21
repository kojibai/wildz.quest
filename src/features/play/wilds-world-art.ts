import type { WildsQualityTier } from "./wilds-quality-profile";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES } from "./wilds-world-geography";

type WorldPoint = Readonly<{ x: number; z: number }>;

export type WildsHorizonAnchor = Readonly<{
  id: string;
  world: WorldPoint;
  relative: WorldPoint;
  elevation: number;
  scale: number;
  yaw: number;
  variant: 0 | 1 | 2;
}>;

export type WildsRouteGuide = Readonly<{
  id: string;
  routeId: (typeof WILDS_MAJOR_ROUTES)[number]["id"];
  world: WorldPoint;
  relative: WorldPoint;
  elevation: number;
  distance: number;
  heading: number;
  variant: 0 | 1;
}>;

const HORIZON_COUNTS: Readonly<Record<WildsQualityTier, number>> = Object.freeze({
  low: 10,
  medium: 14,
  high: 18
});

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function stableUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function horizonSeed(player: WorldPoint) {
  return Math.floor(player.x / 12) * 9_973 + Math.floor(player.z / 12) * 7_919;
}

export function projectWildsHorizonAnchors(player: WorldPoint, tier: WildsQualityTier): readonly WildsHorizonAnchor[] {
  const count = HORIZON_COUNTS[tier];
  const seed = horizonSeed(player);
  return Array.from({ length: count }, (_, index): WildsHorizonAnchor => {
    const angle = index / count * Math.PI * 2 + (stableUnit(seed, index + 11) - .5) * .14;
    const radius = 28 + stableUnit(seed, index + 97) * 7;
    const world = {
      x: quantize(player.x + Math.cos(angle) * radius),
      z: quantize(player.z + Math.sin(angle) * radius)
    };
    const scale = quantize(3.4 + stableUnit(seed, index + 211) * 3.1);
    return {
      id: `horizon:${Math.floor(player.x / 12)}:${Math.floor(player.z / 12)}:${index}`,
      world,
      relative: { x: quantize(world.x - player.x), z: quantize(world.z - player.z) },
      elevation: sampleWildsTerrain(world.x, world.z).elevation,
      scale,
      yaw: quantize(angle + stableUnit(seed, index + 307) * Math.PI),
      variant: (index % 3) as 0 | 1 | 2
    };
  });
}

const ROUTE_GUIDES = WILDS_MAJOR_ROUTES.flatMap((route, routeIndex) => route.points.slice(0, -1).flatMap((start, segmentIndex) => {
  const end = route.points[segmentIndex + 1];
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / 11));
  return Array.from({ length: steps }, (_, stepIndex) => {
    const t = stepIndex / steps;
    return {
      id: `route-guide:${route.id}:${segmentIndex}:${stepIndex}`,
      routeId: route.id,
      world: { x: quantize(start.x + dx * t), z: quantize(start.z + dz * t) },
      heading: quantize(Math.atan2(dx, dz)),
      variant: (routeIndex % 2) as 0 | 1
    };
  });
}));

export function projectWildsRouteGuides(player: WorldPoint, radius = 30): readonly WildsRouteGuide[] {
  const boundedRadius = Number.isFinite(radius) ? Math.max(0, Math.min(42, radius)) : 0;
  return ROUTE_GUIDES.map((guide): WildsRouteGuide => {
    const relative = { x: quantize(guide.world.x - player.x), z: quantize(guide.world.z - player.z) };
    return {
      ...guide,
      relative,
      elevation: sampleWildsTerrain(guide.world.x, guide.world.z).elevation,
      distance: quantize(Math.hypot(relative.x, relative.z))
    };
  })
    .filter((guide) => guide.distance <= boundedRadius)
    .sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id))
    .slice(0, 18);
}
