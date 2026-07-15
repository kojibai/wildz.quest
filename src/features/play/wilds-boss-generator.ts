import { sha256PortableBasis } from "./portable-card";
import type { WildsDynamicSite } from "./wilds-dynamic-sites";

export type CrystalBurrowerAnatomy = {
  core: "prism-heart";
  shell: "basalt" | "jade";
  limbs: "tunneler" | "crusher";
  crown: "shard" | "halo";
};

export type WildsBoss = {
  id: string;
  familyId: "crystal-burrower";
  name: string;
  siteId: string;
  anatomy: CrystalBurrowerAnatomy;
  behavior: {
    opener: "burrow" | "shard-rain";
    escalation: "fracture" | "swarm";
    finale: "last-light";
  };
  affinities: readonly ["guard" | "speed" | "bond", "guard" | "speed" | "bond"];
  maxHealth: number;
  health: number;
  phase: "emerged" | "engaged" | "defeated";
  emergedAt: string;
  defeatedAt: string | null;
  seedDigest: string;
};

const anatomyKits: readonly CrystalBurrowerAnatomy[] = [
  { core: "prism-heart", shell: "basalt", limbs: "tunneler", crown: "shard" },
  { core: "prism-heart", shell: "basalt", limbs: "crusher", crown: "shard" },
  { core: "prism-heart", shell: "jade", limbs: "tunneler", crown: "halo" },
  { core: "prism-heart", shell: "jade", limbs: "crusher", crown: "halo" },
  { core: "prism-heart", shell: "jade", limbs: "tunneler", crown: "shard" }
] as const;

const behaviorKits = [
  { opener: "burrow", escalation: "fracture", finale: "last-light" },
  { opener: "shard-rain", escalation: "swarm", finale: "last-light" },
  { opener: "burrow", escalation: "swarm", finale: "last-light" },
  { opener: "shard-rain", escalation: "fracture", finale: "last-light" }
] as const;

const affinityKits = [
  ["guard", "speed"],
  ["speed", "bond"],
  ["bond", "guard"]
] as const;

const names = ["Auralith", "Vesperclast", "Thornprism", "Oricalyx", "Lumenvault", "Kairadon"] as const;

function hexNumber(digest: string, offset: number) {
  return Number.parseInt(digest.slice("sha256:".length + offset, "sha256:".length + offset + 8), 16) >>> 0;
}

export function isCrystalBurrowerAnatomyCompatible(anatomy: CrystalBurrowerAnatomy) {
  if (anatomy.core !== "prism-heart") return false;
  if (anatomy.shell === "basalt" && anatomy.crown === "halo") return false;
  return anatomyKits.some((kit) => kit.shell === anatomy.shell && kit.limbs === anatomy.limbs && kit.crown === anatomy.crown);
}

export function generateCrystalBurrower(input: { site: WildsDynamicSite; pulse: string; ordinal: number }): WildsBoss {
  if (input.site.phase !== "emerged") throw new Error("wilds_boss_site_not_emerged");
  if (!Number.isFinite(Date.parse(input.pulse))) throw new Error("wilds_boss_pulse_invalid");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) throw new Error("wilds_boss_ordinal_invalid");
  const seedDigest = sha256PortableBasis(`wilds:global:v3:crystal-burrower:${input.site.id}:${input.pulse}:${input.ordinal}`);
  const anatomy = anatomyKits[hexNumber(seedDigest, 0) % anatomyKits.length]!;
  const behavior = behaviorKits[hexNumber(seedDigest, 8) % behaviorKits.length]!;
  const affinities = affinityKits[hexNumber(seedDigest, 16) % affinityKits.length]!;
  const maxHealth = 180_000 + (hexNumber(seedDigest, 24) % 80_001);
  return {
    id: `boss:crystal-burrower:${seedDigest.slice("sha256:".length, "sha256:".length + 24)}`,
    familyId: "crystal-burrower",
    name: `${names[hexNumber(seedDigest, 32) % names.length]}, Crystal Burrower`,
    siteId: input.site.id,
    anatomy,
    behavior,
    affinities,
    maxHealth,
    health: maxHealth,
    phase: "emerged",
    emergedAt: new Date(Date.parse(input.pulse)).toISOString(),
    defeatedAt: null,
    seedDigest
  };
}
