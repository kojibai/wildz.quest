import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { WildsEcologyFamilyId } from "./wilds-ecology";

export type NarrativeCharacter = { id: string; name: string; role: "archivist" | "wayfinder" | "caretaker"; voice: string };
export type RegionalStory = { regionId: string; seasonSeed: string; title: string; chapters: readonly { id: string; title: string; premise: string; characterId: string }[]; characters: readonly NarrativeCharacter[]; audioMotif: string };
export type NarrativeMemoryKind = "celebration" | "memorial" | "aftermath";
export type NarrativeMemoryRecord = { memoryId: string; kind: NarrativeMemoryKind; regionId: string; title: string; summary: string; occurredAt: string; sourceEventId: string; digest: string };

const CHARACTERS: readonly NarrativeCharacter[] = [
  { id: "character:sola-reed", name: "Sola Reed", role: "archivist", voice: "patient witness" },
  { id: "character:mira-vale", name: "Mira Vale", role: "wayfinder", voice: "bright invitation" },
  { id: "character:oren-moss", name: "Oren Moss", role: "caretaker", voice: "grounded warmth" }
];
const CHAPTER_TITLES = ["The first light", "A road remembers", "The promise beyond the tide", "What we leave glowing"] as const;
const PREMISES = ["A small signal asks the region to listen.", "Old routes reveal the people who protected them.", "A shared choice changes what the horizon can hold.", "The world keeps the kindness that players return."] as const;

function safePart(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9:_-]{1,80}$/.test(normalized)) throw new Error("wilds_narrative_input_invalid");
  return normalized;
}

export function projectRegionalStory(input: { regionId: string; seasonSeed: string }): RegionalStory {
  const regionId = safePart(input.regionId);
  const seasonSeed = safePart(input.seasonSeed);
  const digest = sha256PortableBasis(canonicalPortableCardJson({ regionId, seasonSeed }));
  const offset = Number.parseInt(digest.slice(-2), 16) % CHARACTERS.length;
  const characters = CHARACTERS.map((_, index) => CHARACTERS[(index + offset) % CHARACTERS.length]!);
  const chapters = CHAPTER_TITLES.map((title, index) => ({ id: `chapter:${digest.slice(7, 19)}:${index + 1}`, title, premise: PREMISES[index]!, characterId: characters[index % characters.length]!.id }));
  return { regionId, seasonSeed, title: `${regionId.replace(/[-_]/g, " ")} — living season`, chapters, characters, audioMotif: `regional:${digest.slice(7, 19)}` };
}

export function projectHistoricalAtlas(records: readonly NarrativeMemoryRecord[]) {
  const byId = new Map<string, NarrativeMemoryRecord>();
  for (const record of records) {
    if (!record.memoryId || !record.regionId || !record.sourceEventId || !Number.isFinite(Date.parse(record.occurredAt))) continue;
    if (!byId.has(record.memoryId)) byId.set(record.memoryId, record);
  }
  const layers = [...byId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.memoryId.localeCompare(b.memoryId)).slice(-2048);
  const regions: Record<string, number> = {};
  for (const layer of layers) regions[layer.regionId] = (regions[layer.regionId] ?? 0) + 1;
  return { layers, regions };
}

const AFTERMATH: Record<WildsEcologyFamilyId, { module: string; visualKit: string; feeling: string }> = {
  "wandering-market": { module: "merchant-trail", visualKit: "warm-lanterns", feeling: "welcome" },
  "echo-ruin": { module: "excavated-archive", visualKit: "remembering-stones", feeling: "wonder" },
  "unstable-portal": { module: "rift-scar", visualKit: "quiet-prism", feeling: "possibility" },
  "convergence-festival": { module: "banner-grove", visualKit: "ribbons-in-wind", feeling: "belonging" },
  "creature-migration": { module: "nesting-ground", visualKit: "soft-tracks", feeling: "care" },
  "resource-bloom": { module: "fertile-patch", visualKit: "lumen-meadow", feeling: "renewal" },
  stormfront: { module: "charged-biome", visualKit: "rain-glass", feeling: "resilience" },
  "settlement-distress": { module: "repaired-edge", visualKit: "new-beacons", feeling: "solidarity" }
};

export function projectEnvironmentalAftermath(input: { familyId: WildsEcologyFamilyId; eventId: string }) {
  if (!input.eventId.trim()) throw new Error("wilds_aftermath_event_invalid");
  return { eventId: input.eventId, ...AFTERMATH[input.familyId] };
}

export function projectReturnContinuity(input: { playerName: string; regionId: string; memories: readonly { title: string; occurredAt: string }[] }) {
  const playerName = input.playerName.trim() || "Explorer";
  const recap = input.memories.filter((memory) => memory.title.trim() && Number.isFinite(Date.parse(memory.occurredAt))).slice(-3).map((memory) => memory.title);
  const region = input.regionId.replace(/[-_]/g, " ");
  return { greeting: recap.length ? `Welcome back, ${playerName}. ${region} still remembers.` : `Welcome to ${region}, ${playerName}.`, recap, nextHook: recap.length ? "A new path is waiting where your last memory ends." : "Follow the first light to begin a memory of your own." };
}

function createMemory(kind: NarrativeMemoryKind, input: { sourceEventId: string; regionId: string; title: string; summary: string; occurredAt: string }): NarrativeMemoryRecord {
  if (!input.sourceEventId.trim() || !input.regionId.trim() || !input.title.trim() || !Number.isFinite(Date.parse(input.occurredAt))) throw new Error("wilds_memory_input_invalid");
  const normalized = { kind, ...input, occurredAt: new Date(Date.parse(input.occurredAt)).toISOString() };
  const digest = sha256PortableBasis(canonicalPortableCardJson(normalized));
  return { ...normalized, memoryId: `memory:${digest.slice(7, 31)}`, digest };
}

export function createWorldMemorial(input: { sourceEventId: string; regionId: string; title: string; summary: string; occurredAt: string }) { return createMemory("memorial", input); }
export function createCelebrationMemory(input: { sourceEventId: string; regionId: string; title: string; summary: string; occurredAt: string }) { return createMemory("celebration", input); }
