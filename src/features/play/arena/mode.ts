export type ArenaMode = "practice" | "adventure" | "ranked" | "mortal";
export type ArenaAuthorityKind = "local" | "offline-pending" | "global";

export type ArenaModePolicy = Readonly<{
  id: string;
  mortality: "knockout" | "retirement";
  progression: "none" | "living-card" | "rating-only";
  authority: "local" | "offline-pending" | "global-required";
  covenantRequired: boolean;
  aiOpponentAllowed: boolean;
  timeScale: "configurable" | "fixed";
}>;

export const ARENA_MODE_POLICIES: Readonly<Record<ArenaMode, ArenaModePolicy>> = Object.freeze({
  practice: Object.freeze({
    id: "wilds.arena.mode.practice.v1",
    mortality: "knockout",
    progression: "none",
    authority: "local",
    covenantRequired: false,
    aiOpponentAllowed: true,
    timeScale: "configurable",
  }),
  adventure: Object.freeze({
    id: "wilds.arena.mode.adventure.v1",
    mortality: "knockout",
    progression: "living-card",
    authority: "offline-pending",
    covenantRequired: false,
    aiOpponentAllowed: true,
    timeScale: "fixed",
  }),
  ranked: Object.freeze({
    id: "wilds.arena.mode.ranked.v1",
    mortality: "knockout",
    progression: "rating-only",
    authority: "global-required",
    covenantRequired: false,
    aiOpponentAllowed: false,
    timeScale: "fixed",
  }),
  mortal: Object.freeze({
    id: "wilds.arena.mode.mortal.v1",
    mortality: "retirement",
    progression: "living-card",
    authority: "offline-pending",
    covenantRequired: true,
    aiOpponentAllowed: true,
    timeScale: "fixed",
  }),
});

export function arenaModePolicy(mode: ArenaMode): ArenaModePolicy {
  const policy = ARENA_MODE_POLICIES[mode];
  if (!policy) throw new Error("arena_mode_invalid");
  return policy;
}

export function assertArenaAuthority(mode: ArenaMode, authority: ArenaAuthorityKind) {
  const policy = arenaModePolicy(mode);
  if (policy.authority === "global-required" && authority !== "global") {
    throw new Error("arena_mode_global_authority_required");
  }
  if (policy.authority === "offline-pending" && authority === "local") {
    throw new Error("arena_mode_receipt_authority_required");
  }
  return authority;
}
