import type { WildsBossFamilyId } from "./wilds-boss-ecology";
import type { WildsWorldBossProjection } from "./wilds-world-state";

export const WILDS_BOSS_FAMILY_ART: Record<WildsBossFamilyId, { shell: string; core: string; signal: string; scale: number }> = {
  "crystal-burrower": { shell: "#25313c", core: "#aef7ff", signal: "#76dfff", scale: 1.15 },
  "skycoil-tempest": { shell: "#344968", core: "#f8fbff", signal: "#8ec8ff", scale: 1.05 },
  "mirecrown-colossus": { shell: "#334a37", core: "#d9f29b", signal: "#82cf75", scale: 1.28 },
  "embermane-siegebeast": { shell: "#552f27", core: "#fff0a6", signal: "#ff7448", scale: 1.16 },
  "tidal-prism-leviathan": { shell: "#17445b", core: "#b8fff2", signal: "#45d6cc", scale: 1.2 },
  "echo-antler-warden": { shell: "#473d5b", core: "#f2d8ff", signal: "#cb91ff", scale: 1.06 },
  "lumen-moth-sovereign": { shell: "#493f68", core: "#fff8c7", signal: "#ffe780", scale: 1.02 },
  "voidroot-devourer": { shell: "#17131f", core: "#e1a8ff", signal: "#9d5cff", scale: 1.25 }
};

const FAMILY_LOCAL_TOP: Record<WildsBossFamilyId, number> = {
  "crystal-burrower": 2.33,
  "skycoil-tempest": 2.64,
  "mirecrown-colossus": 2.33,
  "embermane-siegebeast": 2.33,
  "tidal-prism-leviathan": 2.33,
  "echo-antler-warden": 2.72,
  "lumen-moth-sovereign": 2.78,
  "voidroot-devourer": 2.33
};

export function wildsBossPhaseScale(phase: WildsWorldBossProjection["phase"]) {
  return phase === "transforming" ? 1.22 : phase === "vulnerable" ? .94 : 1;
}

export function wildsBossPhysicalEnvelope(familyId: WildsBossFamilyId, phase: WildsWorldBossProjection["phase"]) {
  const family = WILDS_BOSS_FAMILY_ART[familyId] ?? WILDS_BOSS_FAMILY_ART["crystal-burrower"];
  const scale = family.scale * wildsBossPhaseScale(phase);
  return {
    radius: Math.round(2.94 * scale * 1_000_000) / 1_000_000,
    topY: Math.round((FAMILY_LOCAL_TOP[familyId] * scale + .06) * 1_000_000) / 1_000_000,
    scale
  };
}
