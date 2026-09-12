import type { WildsDiscoveryRouteRequirement, WildsDiscoverySiteFamily, WildsDiscoverySiteProjection } from "./wilds-discovery-sites";

const stories: Record<WildsDiscoverySiteFamily, readonly [string, string, string]> = {
  cave: ["The sheltered trail", "A passage disappears under the hillside. Its turns invite you to slow down and remember the way back.", "Follow a safe passage and scan the sheltered habitat."],
  "mountain-pass": ["Beyond the ridge", "The ridge hides the land on its far side. Reaching a new viewpoint changes which trail you can plan next.", "Compare the available routes before attempting the ascent."],
  "hidden-valley": ["A world between hills", "The valley shelters a pocket of wilderness away from the open trail.", "Scan this habitat with a companion at your side."],
  canyon: ["The long way down", "The canyon makes distance deceptive: the opposite edge is close, but a safe crossing takes care.", "Find a safe route before descending."],
  "submerged-grotto": ["Beneath the surface", "The grotto offers a passage through a world that a landbound traveler cannot fully explore.", "Bring a swimming companion and inspect the route requirements."],
  reef: ["Life in the shallows", "The reef turns open water into a patchwork of sheltered habitat.", "Explore the shallows and scan for aquatic life."],
  trench: ["The deeper trail", "The trench draws a dark line through the underwater landscape. Preparation matters more than speed here.", "Check every deep-water requirement before following a route."],
  ruin: ["What the wild kept", "Old stone divides a place the wilderness has reclaimed. Its surviving paths offer a different way through.", "Follow the accessible route, then scan the habitat around the stone."],
  "canopy-route": ["Above the forest floor", "A high route reveals the forest from a companion's perspective.", "Choose a climbing route only when your companion can support it."],
  spring: ["Where trails meet water", "Water gathers here, making this a natural pause between expeditions.", "Scan the habitat before setting off again."],
  cavern: ["A room beneath the world", "The passage widens into a cavern. The entrance becomes your anchor as the underground world opens out.", "Locate a safe route and keep the exit in mind."],
  "sky-island": ["A distant landing", "The island is a destination you can see before you can reach. A capable flying companion changes that promise into a route.", "Check the flight route and your companion's abilities before leaving the ground."]
};

export function projectWildsDiscoveryStory(site: WildsDiscoverySiteProjection, capabilities: readonly WildsDiscoveryRouteRequirement[], visited: boolean) {
  const [title, story, objective] = stories[site.family];
  const supported = new Set(capabilities);
  const available = site.routes.filter(route => route.requirements.every(requirement => supported.has(requirement)));
  const route = available.find(route => route.safe) ?? available[0];
  const missing = [...new Set(site.routes.flatMap(route => route.requirements).filter(requirement => !supported.has(requirement)))];
  return {
    siteKey: site.key, title, story, objective,
    stage: visited ? "discovered" as const : "seek" as const,
    routeId: route?.id,
    routeHint: route ? `${route.safe ? "Safe route" : "Available route"}: ${route.requirements.length ? route.requirements.join(" + ") : "no special ability required"}.`
      : site.routes.length ? `No supported route yet. Check abilities: ${missing.join(", ")}.` : "Explore the entrance and scan its habitat.",
    // A discovered entrance is not proof that its routes were completed.
    progressLabel: visited ? "Entrance discovered · explore the habitat next" : "Find the entrance · then explore its habitat"
  };
}
