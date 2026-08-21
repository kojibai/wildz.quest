import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { WILDS_MAJOR_ROUTES } from "./wilds-world-geography";

type WorldPoint = Readonly<{ x: number; z: number }>;

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

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
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
