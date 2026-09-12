import { sanitizeWildsJourney, type WildsJourneyMemory } from "./wilds-journey";

export type WildsCompanionChapter = Readonly<{
  companionName: string;
  sharedPlaces: number;
  firstMeeting?: Readonly<{ text: string; position: { x: number; z: number } }>;
  revisit?: Readonly<{ memoryId: string; text: string }>;
  opportunity?: Readonly<{ siteKey: string; text: string; position: { x: number; z: number } }>;
}>;

const actions = {
  met: "This is near the place where you first met.",
  home: "You have rested together at this shelter before.",
  built: "You completed construction together here.",
  discovered: "You discovered this place together.",
  harvest: "You have gathered resources together here."
} as const;

/** Journal facts and current route capabilities only. No invented feelings or progression. */
export function projectWildsCompanionChapter(input: {
  companion: Readonly<{ id: string; name: string }> | undefined;
  memories: readonly WildsJourneyMemory[];
  position: Readonly<{ x: number; z: number }>;
  inOuterWorld: boolean;
  capabilities: readonly string[];
  discovery?: Readonly<{
    key: string;
    entrance: Readonly<{ x: number; z: number }>;
    routes: readonly Readonly<{ safe: boolean; requirements: readonly string[] }>[];
  }>;
}): WildsCompanionChapter | null {
  if (!input.companion) return null;
  const shared = sanitizeWildsJourney(input.memories).filter(memory => memory.companionId === input.companion?.id);
  const first = shared.find(memory => memory.kind === "met");
  // Existing journal coordinates are outer-world coordinates. Never match an interior at the same X/Z.
  const nearby = input.inOuterWorld ? shared.filter(memory => Math.hypot(memory.position.x-input.position.x, memory.position.z-input.position.z) <= 8) : [];
  const priority = { met: 0, home: 1, built: 2, discovered: 3, harvest: 4 };
  nearby.sort((a,b) => priority[a.kind]-priority[b.kind] || b.timestamp-a.timestamp);
  const revisit = nearby[0];
  const supported = new Set(input.capabilities);
  const routes = input.inOuterWorld ? input.discovery?.routes.filter(route => route.requirements.length > 0 && route.requirements.every(requirement => supported.has(requirement))) ?? [] : [];
  const route = routes.find(route => route.safe) ?? routes[0];
  return {
    companionName: input.companion.name,
    sharedPlaces: new Set(shared.map(memory => `${Math.round(memory.position.x)},${Math.round(memory.position.z)}`)).size,
    ...(first ? { firstMeeting: { text: `Your first meeting is recorded near X ${Math.round(first.position.x)} · Z ${Math.round(first.position.z)}.`, position: first.position } } : {}),
    ...(revisit ? { revisit: { memoryId: revisit.id, text: actions[revisit.kind] } } : {}),
    ...(route && input.discovery ? { opportunity: { siteKey: input.discovery.key, position: input.discovery.entrance,
      text: `${input.companion.name}'s ${[...new Set(route.requirements)].map(value => value.replaceAll("-", " ")).join(" + ")} abilities match a route at your next discovery. Check the route conditions when you arrive.` } } : {})
  };
}
