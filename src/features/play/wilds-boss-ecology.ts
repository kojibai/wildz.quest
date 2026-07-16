import { sha256PortableBasis } from "./portable-card";
import { WILDS_BOSS_FAMILIES, type WildsBossFamilyId } from "./wilds-v3-contracts";

export { WILDS_BOSS_FAMILIES, type WildsBossFamilyId } from "./wilds-v3-contracts";


export type WildsBossPhase = "rumored" | "tracked" | "emerged" | "contested" | "transforming" | "vulnerable" | "defeated" | "memorialized" | "withdrawn";

export type WildsBossModuleSet = {
  silhouette: string;
  anatomy: string;
  opener: string;
  escalation: string;
  finale: string;
  hazard: string;
  weakness: string;
  supportObjective: string;
  transformation: string;
  aftermath: string;
};

type BossFamilyDefinition = {
  title: string;
  names: readonly string[];
  modules: { [Key in keyof WildsBossModuleSet]: readonly string[] };
  affinities: readonly ["guard" | "speed" | "bond", "guard" | "speed" | "bond"];
  health: readonly [number, number];
  successors: readonly WildsBossFamilyId[];
};

export type WildsBossDefinition = {
  id: string;
  familyId: WildsBossFamilyId;
  name: string;
  siteId: string;
  position: { x: number; z: number };
  territoryRadius: number;
  regionId: string;
  modules: WildsBossModuleSet;
  affinities: readonly ["guard" | "speed" | "bond", "guard" | "speed" | "bond"];
  maxHealth: number;
  health: number;
  phase: WildsBossPhase;
  emergedAt: string;
  defeatedAt: string | null;
  parentBossId: string | null;
  causeEventId: string | null;
  seedDigest: string;
};

export type WildsBossSite = {
  id: string;
  phase: string;
  position: { x: number; z: number };
  radius: number;
};

const familyDefinitions: Record<WildsBossFamilyId, BossFamilyDefinition> = {
  "crystal-burrower": {
    title: "Crystal Burrower",
    names: ["Auralith", "Vesperclast", "Thornprism", "Oricalyx", "Lumenvault", "Kairadon"],
    modules: {
      silhouette: ["faceted-tunneler", "prism-backed-behemoth"], anatomy: ["basalt-shard-tunneler", "jade-halo-crusher"],
      opener: ["burrow", "shard-rain"], escalation: ["fracture", "swarm"], finale: ["last-light"],
      hazard: ["crystal-faults", "resonant-spires"], weakness: ["prism-heart"], supportObjective: ["stabilize-faults"],
      transformation: ["crown-unfurls"], aftermath: ["singing-crater"]
    }, affinities: ["guard", "speed"], health: [180_000, 260_000], successors: ["skycoil-tempest", "mirecrown-colossus"]
  },
  "skycoil-tempest": {
    title: "Skycoil Tempest", names: ["Vaelstorm", "Cirrus Rex", "Orothunder"],
    modules: {
      silhouette: ["ring-wing-serpent", "storm-manta"], anatomy: ["ion-coil", "thunder-keel"], opener: ["lightning-dive", "crosswind"],
      escalation: ["cyclone-wall", "chain-bolt"], finale: ["eye-of-silence"], hazard: ["charged-clouds"], weakness: ["grounded-coil"],
      supportObjective: ["raise-conductors"], transformation: ["storm-sheds-skin"], aftermath: ["permanent-aurora"]
    }, affinities: ["speed", "bond"], health: [210_000, 300_000], successors: ["tidal-prism-leviathan", "lumen-moth-sovereign"]
  },
  "mirecrown-colossus": {
    title: "Mirecrown Colossus", names: ["Old Mossking", "Virdigrave", "Fen Regent"],
    modules: {
      silhouette: ["walking-island", "rooted-titan"], anatomy: ["bogstone-heart", "mangrove-crown"], opener: ["mire-stomp"],
      escalation: ["root-cage", "spore-tide"], finale: ["last-grove"], hazard: ["sinking-ground"], weakness: ["sunlit-bark"],
      supportObjective: ["drain-the-basin"], transformation: ["forest-awakens"], aftermath: ["colossus-garden"]
    }, affinities: ["guard", "bond"], health: [260_000, 350_000], successors: ["embermane-siegebeast", "echo-antler-warden"]
  },
  "embermane-siegebeast": {
    title: "Embermane Siegebeast", names: ["Cindervault", "Ashen Roar", "Pyreclaw"],
    modules: {
      silhouette: ["furnace-lion", "six-legged-ram"], anatomy: ["magma-mane", "siege-horns"], opener: ["furnace-charge"],
      escalation: ["cinder-barrage", "wall-breaker"], finale: ["white-flame"], hazard: ["lava-trenches"], weakness: ["cooling-vents"],
      supportObjective: ["open-aqueducts"], transformation: ["armor-melts"], aftermath: ["glass-steppe"]
    }, affinities: ["speed", "guard"], health: [230_000, 320_000], successors: ["voidroot-devourer", "crystal-burrower"]
  },
  "tidal-prism-leviathan": {
    title: "Tidal Prism Leviathan", names: ["Pelaglass", "Nacreon", "Blue Meridian"],
    modules: {
      silhouette: ["reef-whale", "prism-eel"], anatomy: ["tideglass-ribs", "pearl-reactor"], opener: ["surge-breach"],
      escalation: ["undertow", "mirror-wave"], finale: ["deepwater-crown"], hazard: ["flood-rings"], weakness: ["exposed-gill-prisms"],
      supportObjective: ["anchor-pontoons"], transformation: ["reef-shell-opens"], aftermath: ["leviathan-lagoon"]
    }, affinities: ["bond", "guard"], health: [240_000, 340_000], successors: ["skycoil-tempest", "echo-antler-warden"]
  },
  "echo-antler-warden": {
    title: "Echo Antler Warden", names: ["Reveriel", "Hushhorn", "Canticle Hart"],
    modules: {
      silhouette: ["cathedral-stag", "many-antlered-guardian"], anatomy: ["echo-ribcage", "bell-antlers"], opener: ["resonant-charge"],
      escalation: ["memory-maze", "chorus-stampede"], finale: ["perfect-silence"], hazard: ["echo-fields"], weakness: ["quiet-beat"],
      supportObjective: ["tune-waystones"], transformation: ["antlers-become-gates"], aftermath: ["memory-grove"]
    }, affinities: ["bond", "speed"], health: [200_000, 290_000], successors: ["lumen-moth-sovereign", "mirecrown-colossus"]
  },
  "lumen-moth-sovereign": {
    title: "Lumen Moth Sovereign", names: ["Solivane", "Gildwing", "Noctilume"],
    modules: {
      silhouette: ["moon-moth", "lantern-empress"], anatomy: ["solar-wings", "lantern-thorax"], opener: ["dust-veil"],
      escalation: ["false-dawns", "lumen-swarm"], finale: ["eclipse-bloom"], hazard: ["dreamlight"], weakness: ["shadowed-wing"],
      supportObjective: ["align-mirrors"], transformation: ["second-pair-unfolds"], aftermath: ["everlight-meadow"]
    }, affinities: ["speed", "bond"], health: [190_000, 280_000], successors: ["voidroot-devourer", "tidal-prism-leviathan"]
  },
  "voidroot-devourer": {
    title: "Voidroot Devourer", names: ["Nullbriar", "The Unmaker Below", "Gravethorn"],
    modules: {
      silhouette: ["inverted-tree", "root-maw"], anatomy: ["absence-core", "gravity-roots"], opener: ["world-bite"],
      escalation: ["horizon-pull", "hollow-copies"], finale: ["root-of-night"], hazard: ["missing-ground"], weakness: ["living-seed"],
      supportObjective: ["plant-memory-beacons"], transformation: ["turns-world-inside-out"], aftermath: ["starroot-sanctuary"]
    }, affinities: ["guard", "bond"], health: [300_000, 400_000], successors: ["crystal-burrower", "lumen-moth-sovereign"]
  }
};

function digestNumber(digest: string, offset: number) {
  return Number.parseInt(digest.slice(7 + offset, 15 + offset), 16) >>> 0;
}

function select<T>(values: readonly T[], digest: string, offset: number) {
  return values[digestNumber(digest, offset) % values.length]!;
}

function regionId(position: { x: number; z: number }) {
  return `region:${Math.floor(position.x / 64)}:${Math.floor(position.z / 64)}`;
}

export function generateWildsBoss(input: {
  familyId: WildsBossFamilyId;
  site: WildsBossSite;
  pulse: string;
  ordinal: number;
  existingBosses: readonly WildsBossDefinition[];
  parentBossId?: string | null;
  causeEventId?: string | null;
}): WildsBossDefinition {
  if (!WILDS_BOSS_FAMILIES.includes(input.familyId)) throw new Error("wilds_boss_family_invalid");
  if (!(["emerged", "assaulting", "engaged"] as const).includes(input.site.phase as "emerged")) throw new Error("wilds_boss_site_not_emerged");
  const emergedAtMs = Date.parse(input.pulse);
  if (!Number.isFinite(emergedAtMs)) throw new Error("wilds_boss_pulse_invalid");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) throw new Error("wilds_boss_ordinal_invalid");
  const definition = familyDefinitions[input.familyId];
  const seedDigest = sha256PortableBasis(`wilds:global:v3:boss:${input.familyId}:${input.site.id}:${input.pulse}:${input.ordinal}:${input.parentBossId ?? "origin"}:${input.causeEventId ?? "emergence"}`);
  const modules = Object.fromEntries(Object.entries(definition.modules).map(([key, values], index) => [key, select(values, seedDigest, index * 4)])) as WildsBossModuleSet;
  const [minimumHealth, maximumHealth] = definition.health;
  const maxHealth = minimumHealth + (digestNumber(seedDigest, 40) % (maximumHealth - minimumHealth + 1));
  return {
    id: `boss:${input.familyId}:${seedDigest.slice(7, 31)}`,
    familyId: input.familyId,
    name: `${select(definition.names, seedDigest, 48)}, ${definition.title}`,
    siteId: input.site.id,
    position: { ...input.site.position },
    territoryRadius: Math.max(18, input.site.radius * 2),
    regionId: regionId(input.site.position),
    modules,
    affinities: definition.affinities,
    maxHealth,
    health: maxHealth,
    phase: "emerged",
    emergedAt: new Date(emergedAtMs).toISOString(),
    defeatedAt: null,
    parentBossId: input.parentBossId ?? null,
    causeEventId: input.causeEventId ?? null,
    seedDigest
  };
}

export function validateWildsBossModules(boss: WildsBossDefinition): { ok: boolean; errors: string[] } {
  const definition = familyDefinitions[boss.familyId];
  if (!definition) return { ok: false, errors: ["wilds_boss_family_invalid"] };
  const errors: string[] = [];
  for (const key of Object.keys(definition.modules) as (keyof WildsBossModuleSet)[]) {
    if (!definition.modules[key].includes(boss.modules[key])) errors.push(`wilds_boss_${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_incompatible`);
  }
  return { ok: errors.length === 0, errors };
}

export function deriveWildsBossSuccessor(input: {
  parent: WildsBossDefinition;
  causeEventId: string;
  pulse: string;
  ordinal: number;
  existingBosses: readonly WildsBossDefinition[];
}): WildsBossDefinition | null {
  if (input.parent.phase !== "defeated" && input.parent.phase !== "memorialized") throw new Error("wilds_boss_parent_not_defeated");
  if (input.existingBosses.some((boss) => boss.parentBossId === input.parent.id || boss.causeEventId === input.causeEventId)) return null;
  const successors = familyDefinitions[input.parent.familyId].successors;
  const digest = sha256PortableBasis(`wilds:global:v3:successor:${input.parent.id}:${input.causeEventId}`);
  const familyId = select(successors, digest, 0);
  return generateWildsBoss({
    familyId,
    site: {
      id: `site:successor:${input.parent.id}`,
      phase: "emerged",
      position: input.parent.position,
      radius: Math.max(9, input.parent.territoryRadius / 2)
    },
    pulse: input.pulse,
    ordinal: input.ordinal,
    existingBosses: input.existingBosses,
    parentBossId: input.parent.id,
    causeEventId: input.causeEventId
  });
}

export function wildsBossFamilyDefinition(familyId: WildsBossFamilyId) {
  return familyDefinitions[familyId];
}
