import { sha256PortableBasis } from "./portable-card";
import type { WildsBoss } from "./wilds-boss-generator";

export const WILDS_RAID_SQUADS = 6;
export const WILDS_RAID_FIGHTERS_PER_SQUAD = 6;

export type WildsRaidRole = "fighter" | "support";
export type WildsRaidSquads = [string[], string[], string[], string[], string[], string[]];

export type WildsRaid = {
  id: string;
  bossId: string;
  phase: "forming" | "active" | "settled";
  squads: WildsRaidSquads;
  supportPlayerIds: string[];
  contributions: Record<string, { damage: number; support: number; eventIds: string[] }>;
  openedAt: string;
  settledAt: string | null;
  winningEventId: string | null;
};

function playerIdValid(playerId: string) {
  return playerId.length >= 3 && playerId.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(playerId);
}

function emptySquads(): WildsRaidSquads {
  return [[], [], [], [], [], []];
}

export function createWildsRaid(input: { boss: WildsBoss; openedAt: string }): WildsRaid {
  if (input.boss.phase === "defeated") throw new Error("wilds_raid_boss_defeated");
  if (!Number.isFinite(Date.parse(input.openedAt))) throw new Error("wilds_raid_time_invalid");
  const digest = sha256PortableBasis(`wilds:global:v3:raid:${input.boss.id}:${input.openedAt}`);
  return {
    id: `raid:${digest.slice("sha256:".length, "sha256:".length + 24)}`,
    bossId: input.boss.id,
    phase: "forming",
    squads: emptySquads(),
    supportPlayerIds: [],
    contributions: {},
    openedAt: new Date(Date.parse(input.openedAt)).toISOString(),
    settledAt: null,
    winningEventId: null
  };
}

function existingAdmission(raid: WildsRaid, playerId: string): { role: WildsRaidRole; squad: number | null } | null {
  const squad = raid.squads.findIndex((players) => players.includes(playerId));
  if (squad >= 0) return { role: "fighter", squad };
  if (raid.supportPlayerIds.includes(playerId)) return { role: "support", squad: null };
  return null;
}

export function admitRaidPlayer(raid: WildsRaid, playerId: string, preferredSquad?: number) {
  if (raid.phase === "settled") throw new Error("wilds_raid_settled");
  if (!playerIdValid(playerId)) throw new Error("wilds_raid_player_invalid");
  const existing = existingAdmission(raid, playerId);
  if (existing) return { raid, ...existing };

  const preferred = preferredSquad !== undefined && Number.isInteger(preferredSquad) && preferredSquad >= 0 && preferredSquad < WILDS_RAID_SQUADS
    && raid.squads[preferredSquad]!.length < WILDS_RAID_FIGHTERS_PER_SQUAD
    ? preferredSquad
    : null;
  const lowestFill = Math.min(...raid.squads.map((squad) => squad.length));
  const available = lowestFill < WILDS_RAID_FIGHTERS_PER_SQUAD ? raid.squads.findIndex((squad) => squad.length === lowestFill) : -1;
  const squadIndex = preferred ?? available;
  if (squadIndex >= 0) {
    const squads = raid.squads.map((squad) => [...squad]) as WildsRaidSquads;
    squads[squadIndex]!.push(playerId);
    return { raid: { ...raid, squads }, role: "fighter" as const, squad: squadIndex };
  }
  return {
    raid: { ...raid, supportPlayerIds: [...raid.supportPlayerIds, playerId] },
    role: "support" as const,
    squad: null
  };
}

function boundedInteger(value: number, maximum: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

export function applyRaidContribution(input: {
  raid: WildsRaid;
  boss: WildsBoss;
  playerId: string;
  eventId: string;
  damage: number;
  support: number;
  occurredAt?: string;
}) {
  if (input.raid.phase === "settled" || input.boss.phase === "defeated") throw new Error("wilds_raid_settled");
  if (input.raid.bossId !== input.boss.id) throw new Error("wilds_raid_boss_invalid");
  const admission = existingAdmission(input.raid, input.playerId);
  if (!admission) throw new Error("wilds_raid_player_not_admitted");
  if (!playerIdValid(input.eventId)) throw new Error("wilds_raid_event_invalid");
  if (Object.values(input.raid.contributions).some((entry) => entry.eventIds.includes(input.eventId))) {
    return { raid: input.raid, boss: input.boss, defeated: false };
  }

  const damage = admission.role === "fighter" ? boundedInteger(input.damage, 2_500) : 0;
  const support = boundedInteger(input.support, 1_000);
  if (damage === 0 && support === 0) throw new Error("wilds_raid_contribution_empty");
  const previous = input.raid.contributions[input.playerId] ?? { damage: 0, support: 0, eventIds: [] };
  const contributions = {
    ...input.raid.contributions,
    [input.playerId]: {
      damage: previous.damage + damage,
      support: previous.support + support,
      eventIds: [...previous.eventIds, input.eventId]
    }
  };
  const health = Math.max(0, input.boss.health - damage);
  const defeated = health === 0;
  const occurredAt = input.occurredAt ?? input.boss.emergedAt;
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("wilds_raid_time_invalid");
  const boss: WildsBoss = defeated
    ? { ...input.boss, health: 0, phase: "defeated", defeatedAt: new Date(Date.parse(occurredAt)).toISOString() }
    : { ...input.boss, health, phase: "engaged" };
  const raid: WildsRaid = defeated
    ? { ...input.raid, phase: "settled", contributions, settledAt: boss.defeatedAt, winningEventId: input.eventId }
    : { ...input.raid, phase: "active", contributions };
  return { raid, boss, defeated };
}
