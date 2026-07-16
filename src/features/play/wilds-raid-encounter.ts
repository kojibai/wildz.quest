import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset } from "./portable-card";
import type { WildsBossDefinition } from "./wilds-boss-ecology";
import { projectWildsRaidRoles, type WildsRaidCardRole } from "./wilds-raid-roles";

export type WildsRaidFighterIntentType = "strike" | "guard" | "focus" | "interrupt" | "ability" | "revive" | "retreat";
export type WildsRaidSupportIntentType = "stabilize" | "scout" | "supply" | "rescue" | "ward" | "rotate_request";
export type WildsRaidIntent = { type: WildsRaidFighterIntentType | WildsRaidSupportIntentType; commandId: string };
export type WildsRaidAuthority = { actorId: string; card: PortableCardAsset; eventOrdinal: number; occurredAt: string };
export type WildsRaidAcceptedAction = {
  actorId: string;
  commandId: string;
  type: WildsRaidIntent["type"];
  role: WildsRaidCardRole;
  impact: number;
  occurredAt: string;
  eventOrdinal: number;
  cardProofDigest: string;
};
export type WildsRaidEncounterState = {
  bossId: string;
  roundId: string;
  bossHealth: number;
  bossMaxHealth: number;
  phase: "active" | "transforming" | "vulnerable" | "defeated";
  hazard: string;
  weakness: string;
  supportObjective: string;
  openedAt: string;
  acceptedImpact: number;
  acceptedIntent: WildsRaidIntent | null;
  actions: WildsRaidAcceptedAction[];
  cooldowns: Record<string, string>;
};

const cooldownMs: Record<WildsRaidIntent["type"], number> = {
  strike: 1_200, guard: 2_000, focus: 4_000, interrupt: 5_000, ability: 8_000, revive: 10_000, retreat: 0,
  stabilize: 2_500, scout: 4_000, supply: 5_000, rescue: 8_000, ward: 5_000, rotate_request: 0
};

export function createWildsRaidEncounter(input: { boss: WildsBossDefinition; roundId: string; openedAt: string }): WildsRaidEncounterState {
  if (!input.roundId.trim()) throw new Error("wilds_raid_round_invalid");
  const openedAt = new Date(Date.parse(input.openedAt)).toISOString();
  if (openedAt === "Invalid Date") throw new Error("wilds_raid_time_invalid");
  return {
    bossId: input.boss.id, roundId: input.roundId, bossHealth: input.boss.health, bossMaxHealth: input.boss.maxHealth,
    phase: input.boss.phase === "defeated" ? "defeated" : "active", hazard: input.boss.modules.hazard,
    weakness: input.boss.modules.weakness, supportObjective: input.boss.modules.supportObjective, openedAt,
    acceptedImpact: 0, acceptedIntent: null, actions: [], cooldowns: {}
  };
}

function impactFor(intent: WildsRaidIntent, authority: WildsRaidAuthority, state: WildsRaidEncounterState) {
  const roles = projectWildsRaidRoles(authority.card);
  const stats = authority.card.manifest.stats;
  const baseByIntent: Record<WildsRaidIntent["type"], number> = {
    strike: stats.power * 18 + stats.speed * 4,
    ability: stats.power * 14 + stats.bond * 10,
    interrupt: stats.speed * 8 + stats.power * 6,
    focus: stats.bond * 5,
    guard: stats.guard * 7,
    revive: stats.bond * 6,
    retreat: 0,
    stabilize: stats.guard * 3 + stats.bond * 5,
    scout: stats.speed * 5,
    supply: stats.bond * 5,
    rescue: stats.speed * 3 + stats.bond * 4,
    ward: stats.guard * 5,
    rotate_request: 0
  };
  const digest = sha256PortableBasis(canonicalPortableCardJson({ state: state.roundId, intent, proof: roles.proofDigest, ordinal: authority.eventOrdinal }));
  const variance = 90 + (Number.parseInt(digest.slice(7, 11), 16) % 21);
  return Math.floor(baseByIntent[intent.type] * variance / 100);
}

export function applyWildsRaidIntent(state: WildsRaidEncounterState, intent: WildsRaidIntent, authority: WildsRaidAuthority): WildsRaidEncounterState {
  if (state.phase === "defeated") throw new Error("wilds_raid_boss_defeated");
  if (!intent.commandId.trim()) throw new Error("wilds_raid_command_invalid");
  if (!Number.isSafeInteger(authority.eventOrdinal) || authority.eventOrdinal < 1) throw new Error("wilds_raid_event_ordinal_invalid");
  const duplicate = state.actions.find((action) => action.commandId === intent.commandId);
  if (duplicate) return state;
  const pin = verifiedPortableCardPin(authority.card);
  if (pin.ownerReceizId !== authority.actorId) throw new Error("wilds_raid_card_owner_mismatch");
  const occurredAtMs = Date.parse(authority.occurredAt);
  if (!Number.isFinite(occurredAtMs)) throw new Error("wilds_raid_time_invalid");
  const cooldownKey = `${authority.actorId}:${intent.type}`;
  const availableAt = state.cooldowns[cooldownKey];
  if (availableAt && occurredAtMs < Date.parse(availableAt)) throw new Error("wilds_raid_action_cooldown");
  const roles = projectWildsRaidRoles(authority.card);
  const impact = impactFor(intent, authority, state);
  const damaging = intent.type === "strike" || intent.type === "ability" || intent.type === "interrupt";
  const bossHealth = damaging ? Math.max(0, state.bossHealth - impact) : state.bossHealth;
  const ratio = bossHealth / state.bossMaxHealth;
  const phase = bossHealth === 0 ? "defeated" : ratio <= 0.2 ? "vulnerable" : ratio <= 0.55 && ratio > 0.5 ? "transforming" : "active";
  const occurredAt = new Date(occurredAtMs).toISOString();
  const action: WildsRaidAcceptedAction = {
    actorId: authority.actorId, commandId: intent.commandId, type: intent.type, role: roles.primary, impact,
    occurredAt, eventOrdinal: authority.eventOrdinal, cardProofDigest: pin.proofDigest
  };
  return {
    ...state,
    bossHealth,
    phase,
    acceptedImpact: impact,
    acceptedIntent: { ...intent },
    actions: [...state.actions, action],
    cooldowns: { ...state.cooldowns, [cooldownKey]: new Date(occurredAtMs + cooldownMs[intent.type]).toISOString() }
  };
}

export function projectWildsRaidTelegraph(state: WildsRaidEncounterState) {
  return {
    hazard: state.hazard,
    weakness: state.phase === "vulnerable" ? state.weakness : null,
    supportObjective: state.supportObjective,
    phase: state.phase
  };
}
