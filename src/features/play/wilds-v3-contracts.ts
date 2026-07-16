export const WILDS_ECOLOGY_FAMILIES = [
  "wandering-market",
  "echo-ruin",
  "unstable-portal",
  "convergence-festival",
  "creature-migration",
  "resource-bloom",
  "stormfront",
  "settlement-distress"
] as const;

export type WildsEcologyFamilyId = typeof WILDS_ECOLOGY_FAMILIES[number];

export const WILDS_BOSS_FAMILIES = [
  "crystal-burrower",
  "skycoil-tempest",
  "mirecrown-colossus",
  "embermane-siegebeast",
  "tidal-prism-leviathan",
  "echo-antler-warden",
  "lumen-moth-sovereign",
  "voidroot-devourer"
] as const;

export type WildsBossFamilyId = typeof WILDS_BOSS_FAMILIES[number];

export const WILDS_RAID_CARD_ROLES = [
  "vanguard",
  "striker",
  "warden",
  "resonator",
  "wayfinder",
  "steward"
] as const;

export type WildsRaidCardRole = typeof WILDS_RAID_CARD_ROLES[number];

export type WildsSupportAssetIds = readonly [string | null, string | null];

export const EMPTY_WILDS_SUPPORT_ASSET_IDS: WildsSupportAssetIds = [null, null];
