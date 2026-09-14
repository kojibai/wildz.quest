import type { WildsCrewExpedition } from "./wilds-crew-expedition";
import { describeWildsPoint } from "./wilds-world-geography";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { wildsTrailDirection } from "./wilds-journey-discovery";

/** Derive readable context only from admitted positions. Planned destinations are
 * described as plans, never as places visited or rewards earned. */
export function describeWildsCrewMemory(row: WildsCrewExpedition, name: string): string {
  const actual = row.actualPosition;
  const visited = row.totalObserved ?? row.visitedPointIds.length;
  if (row.kind === "returned") return `${name} came back with ${visited} recorded trail ${visited === 1 ? "observation" : "observations"}. This journey began near ${describeWildsPoint(row.origin)}.`;
  if (row.kind === "visited" && actual) {
    const place = row.spaceId === "wildz.space.outer.v1" ? describeWildsPoint(actual) : "the interior trail";
    const surface = row.spaceId === "wildz.space.outer.v1" ? sampleWildsTerrain(actual.x, actual.z).surface.replaceAll("-", " ") : "sheltered ground";
    const elevation = Math.round(actual.y - row.origin.y);
    return `${name} stopped on ${surface} near ${place}, ${wildsTrailDirection(row.origin, actual)} from the journey’s starting point.${Math.abs(elevation) >= 2 ? ` The trail was ${Math.abs(elevation)} m ${elevation > 0 ? "higher" : "lower"} than where they set out.` : ""} Observation ${visited} of this journey was recorded here.`;
  }
  if (row.kind === "started") return `${name} set out near ${describeWildsPoint(row.origin)} with ${row.stops.length} reachable stops planned. Only places actually reached become memories.`;
  if (row.kind === "recalled" || row.kind === "return-retargeted") return `${name} received your call home.${actual ? ` Your return point was ${wildsTrailDirection(actual, row.home)} from their last recorded location.` : " Their return route now leads to you."}`;
  if (row.kind === "blocked") return `${name} could not continue along this route.${row.blocker ? ` ${row.blocker}` : " Another clear path is needed."}`;
  if (row.kind === "route-retried") return `${name} checked the route again and resumed the attempt to reach the next stop.`;
  if (row.kind === "itinerary-continued" || row.kind === "continued") return `${name} continued after ${visited} recorded ${visited === 1 ? "observation" : "observations"}.${actual && row.goal ? ` The next planned stop was ${wildsTrailDirection(actual, row.goal)}.` : " A new stretch of trail lay ahead."}`;
  return `${name}’s journey changed here. This entry retains the recorded location and its place in the travel history.`;
}
