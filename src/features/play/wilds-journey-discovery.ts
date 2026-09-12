import type { WildsDiscoverySiteProjection, WildsDiscoverySiteFamily } from "./wilds-discovery-sites";

const impressions: Record<WildsDiscoverySiteFamily, string> = {
  cave: "A sheltered passage leads beneath the trail. Look for another way through.",
  "mountain-pass": "The ridge divides the landscape. Higher routes may need a climbing companion.",
  "hidden-valley": "A fold in the land opens into a quiet valley. Scan its habitat for a new companion.",
  canyon: "The ground drops into a canyon. Find the safe route before committing to the descent.",
  "submerged-grotto": "An entrance lies beneath the surface. A swimming companion can help you explore it.",
  reef: "The reef offers a different habitat. Explore the shallows with a swimming companion.",
  trench: "Deep water conceals the route ahead. Check your companion's traversal abilities before descending.",
  ruin: "Old stone interrupts the wilderness. Explore its routes and scan for the life that settled here.",
  "canopy-route": "A route runs above the forest floor. A climbing companion opens a different perspective.",
  spring: "Water gathers at this spring. Scan the habitat before continuing your trail.",
  cavern: "The passage opens into a cavern. Keep track of the entrance as you explore.",
  "sky-island": "An island rises above the ground. Flight can turn this distant landmark into a destination."
};
export function wildsDiscoveryImpression(site: Pick<WildsDiscoverySiteProjection, "family">): string {
  return impressions[site.family];
}
export function wildsTrailDirection(from: {x:number;z:number}, to: {x:number;z:number}) {
  const distance = Math.round(Math.hypot(to.x - from.x, to.z - from.z));
  if (distance < 6) return "right here";
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const index = Math.round(Math.atan2(to.x - from.x, from.z - to.z) / (Math.PI / 4));
  return `${distance} m ${directions[(index + 8) % 8]}`;
}
export function nearestUnvisitedWildsSite(sites: readonly WildsDiscoverySiteProjection[], visited: readonly string[], position: {x:number;z:number}) {
  const known = new Set(visited);
  return sites.reduce<WildsDiscoverySiteProjection | null>((nearest, site) => {
    if (known.has(site.key)) return nearest;
    return !nearest || Math.hypot(site.entrance.x-position.x,site.entrance.z-position.z) < Math.hypot(nearest.entrance.x-position.x,nearest.entrance.z-position.z) ? site : nearest;
  }, null);
}
