import { sha256PortableBasis } from "./portable-card";
import type { WildsBossDefinition } from "./wilds-boss-ecology";
import { WILDS_RAID_FIGHTERS_PER_SQUAD, WILDS_RAID_SQUADS, type WildsRaidSquads } from "./wilds-raid-core";

export const WILDS_RAID_SUPPORT_CAPACITY = 144;
export const WILDS_RAID_LEASE_MS = 90_000;

export type WildsRaidRoundPhase = "forming" | "active" | "transformation_lock" | "resolving" | "settled" | "expired";
export type WildsRaidLease = { playerId: string; status: "connected" | "disconnected"; renewedAt: string; expiresAt: string | null };
export type WildsRaidQueueEntry = { playerId: string; eventOrdinal: number; admittedAt: string };
export type WildsRaidRound = {
  id: string;
  bossId: string;
  ordinal: number;
  phase: WildsRaidRoundPhase;
  squads: WildsRaidSquads;
  supportPlayerIds: string[];
  supportQueue: WildsRaidQueueEntry[];
  leases: Record<string, WildsRaidLease>;
  openedAt: string;
  startsAt: string;
  closesAt: string;
  settledAt: string | null;
  winningEventId: string | null;
};

function iso(value: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error("wilds_raid_time_invalid");
  return new Date(time).toISOString();
}

function playerIdValid(playerId: string) {
  return playerId.length >= 3 && playerId.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(playerId);
}

function emptySquads(): WildsRaidSquads {
  return [[], [], [], [], [], []];
}

function participantRole(round: WildsRaidRound, playerId: string) {
  const squad = round.squads.findIndex((players) => players.includes(playerId));
  if (squad >= 0) return { role: "fighter" as const, squad };
  if (round.supportPlayerIds.includes(playerId)) return { role: "support" as const, squad: null };
  return null;
}

export function createWildsRaidRound(input: { boss: WildsBossDefinition; ordinal: number; openedAt: string }): WildsRaidRound {
  if (["defeated", "memorialized", "withdrawn"].includes(input.boss.phase)) throw new Error("wilds_raid_boss_defeated");
  if (!Number.isSafeInteger(input.ordinal) || input.ordinal < 1) throw new Error("wilds_raid_ordinal_invalid");
  const openedAt = iso(input.openedAt);
  const digest = sha256PortableBasis(`wilds:global:v3:raid-round:${input.boss.id}:${openedAt}:${input.ordinal}`);
  const durationMinutes = 10 + (Number.parseInt(digest.slice(7, 15), 16) % 6);
  return {
    id: `raid-round:${digest.slice(7, 31)}`,
    bossId: input.boss.id,
    ordinal: input.ordinal,
    phase: "forming",
    squads: emptySquads(),
    supportPlayerIds: [],
    supportQueue: [],
    leases: {},
    openedAt,
    startsAt: new Date(Date.parse(openedAt) + 20_000).toISOString(),
    closesAt: new Date(Date.parse(openedAt) + durationMinutes * 60_000).toISOString(),
    settledAt: null,
    winningEventId: null
  };
}

export function admitWildsRaidParticipant(round: WildsRaidRound, input: { playerId: string; occurredAt: string; eventOrdinal: number; preferredSquad?: number }) {
  if (["settled", "expired"].includes(round.phase)) throw new Error("wilds_raid_round_closed");
  if (!playerIdValid(input.playerId)) throw new Error("wilds_raid_player_invalid");
  if (!Number.isSafeInteger(input.eventOrdinal) || input.eventOrdinal < 1) throw new Error("wilds_raid_event_ordinal_invalid");
  const existing = participantRole(round, input.playerId);
  if (existing) return { round, ...existing };
  if (round.squads.flat().length + round.supportPlayerIds.length >= WILDS_RAID_SQUADS * WILDS_RAID_FIGHTERS_PER_SQUAD + WILDS_RAID_SUPPORT_CAPACITY) {
    throw new Error("wilds_raid_capacity_full");
  }
  const occurredAt = iso(input.occurredAt);
  const lowestFill = Math.min(...round.squads.map((squad) => squad.length));
  const preferred = input.preferredSquad !== undefined && Number.isInteger(input.preferredSquad)
    && input.preferredSquad >= 0 && input.preferredSquad < WILDS_RAID_SQUADS
    && round.squads[input.preferredSquad]!.length < WILDS_RAID_FIGHTERS_PER_SQUAD ? input.preferredSquad : null;
  const available = lowestFill < WILDS_RAID_FIGHTERS_PER_SQUAD ? round.squads.findIndex((squad) => squad.length === lowestFill) : -1;
  const squad = preferred ?? available;
  const lease: WildsRaidLease = { playerId: input.playerId, status: "connected", renewedAt: occurredAt, expiresAt: null };
  if (squad >= 0) {
    const squads = round.squads.map((players) => [...players]) as WildsRaidSquads;
    squads[squad]!.push(input.playerId);
    return { round: { ...round, squads, leases: { ...round.leases, [input.playerId]: lease } }, role: "fighter" as const, squad };
  }
  const entry = { playerId: input.playerId, eventOrdinal: input.eventOrdinal, admittedAt: occurredAt };
  return {
    round: {
      ...round,
      supportPlayerIds: [...round.supportPlayerIds, input.playerId],
      supportQueue: [...round.supportQueue, entry].sort((a, b) => a.eventOrdinal - b.eventOrdinal || a.playerId.localeCompare(b.playerId)),
      leases: { ...round.leases, [input.playerId]: lease }
    },
    role: "support" as const,
    squad: null
  };
}

export function renewWildsRaidLease(round: WildsRaidRound, input: { playerId: string; status: "connected" | "disconnected"; occurredAt: string }) {
  if (!participantRole(round, input.playerId)) throw new Error("wilds_raid_player_not_admitted");
  const renewedAt = iso(input.occurredAt);
  const lease: WildsRaidLease = {
    playerId: input.playerId,
    status: input.status,
    renewedAt,
    expiresAt: input.status === "disconnected" ? new Date(Date.parse(renewedAt) + WILDS_RAID_LEASE_MS).toISOString() : null
  };
  return { ...round, leases: { ...round.leases, [input.playerId]: lease } };
}

function promoteOldestSupport(round: WildsRaidRound, squadIndex: number) {
  const candidate = round.supportQueue.find((entry) => round.supportPlayerIds.includes(entry.playerId));
  if (!candidate) return round;
  const squads = round.squads.map((players) => [...players]) as WildsRaidSquads;
  squads[squadIndex]!.push(candidate.playerId);
  return {
    ...round,
    squads,
    supportPlayerIds: round.supportPlayerIds.filter((id) => id !== candidate.playerId),
    supportQueue: round.supportQueue.filter((entry) => entry.playerId !== candidate.playerId)
  };
}

export function rotateExpiredWildsRaidSlots(round: WildsRaidRound, now: string) {
  const nowMs = Date.parse(iso(now));
  let next = round;
  for (let squadIndex = 0; squadIndex < next.squads.length; squadIndex += 1) {
    const expired = next.squads[squadIndex]!.filter((playerId) => {
      const lease = next.leases[playerId];
      return lease?.status === "disconnected" && lease.expiresAt !== null && Date.parse(lease.expiresAt) <= nowMs;
    });
    for (const playerId of expired) {
      const squads = next.squads.map((players) => players.filter((id) => id !== playerId)) as WildsRaidSquads;
      const { [playerId]: _removed, ...leases } = next.leases;
      next = promoteOldestSupport({ ...next, squads, leases }, squadIndex);
    }
  }
  return next;
}

export function retreatWildsRaidParticipant(round: WildsRaidRound, input: { playerId: string; occurredAt: string }) {
  iso(input.occurredAt);
  const role = participantRole(round, input.playerId);
  if (!role) return round;
  const squads = round.squads.map((players) => players.filter((id) => id !== input.playerId)) as WildsRaidSquads;
  const { [input.playerId]: _removed, ...leases } = round.leases;
  let next = {
    ...round,
    squads,
    supportPlayerIds: round.supportPlayerIds.filter((id) => id !== input.playerId),
    supportQueue: round.supportQueue.filter((entry) => entry.playerId !== input.playerId),
    leases
  };
  if (role.role === "fighter" && role.squad !== null) next = promoteOldestSupport(next, role.squad);
  return next;
}

export function settleWildsRaidRound(round: WildsRaidRound, input: { occurredAt: string; winningEventId: string | null }) {
  if (round.phase === "settled") return round;
  if (round.phase === "expired") throw new Error("wilds_raid_round_expired");
  return { ...round, phase: "settled" as const, settledAt: iso(input.occurredAt), winningEventId: input.winningEventId };
}
