import { generateCrystalBurrower, type WildsBoss } from "./wilds-boss-generator";
import { advanceDynamicSite, generateCrystalBurrow, type WildsDynamicSite } from "./wilds-dynamic-sites";
import { admitRaidPlayer, applyRaidContribution, createWildsRaid, type WildsRaid } from "./wilds-raid-core";
import { createWildsTeam, joinWildsTeam, scoreWildsLeague } from "./wilds-team-league";
import { createWildsWorldEvent, type WildsWorldEvent, type WildsWorldEventKind } from "./wilds-world-event";
import {
  checkpointWildsWorld,
  initialWildsWorldProjection,
  replayWildsWorld,
  reduceWildsWorldEvent,
  type WildsWorldCheckpoint,
  type WildsWorldProjection
} from "./wilds-world-state";

export type WildsWorldCommand =
  | { type: "raid.join"; bossId: string; preferredSquad?: number; commandId: string }
  | { type: "raid.contribute"; bossId: string; damage: number; support: number; cardProofDigest: string; commandId: string }
  | { type: "team.create"; name: string; commandId: string }
  | { type: "team.join"; teamId: string; commandId: string };

export type WildsWorldAuthority = {
  actorId: string;
  canonical: boolean;
  pulse: string;
  occurredAt: string;
};

function commandIdValid(value: string) {
  return value.length >= 6 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

export class WildsWorldService {
  private projection: WildsWorldProjection;
  private eventTail: WildsWorldEvent[];

  constructor(input?: { checkpoint?: WildsWorldCheckpoint; events?: WildsWorldEvent[] }) {
    this.projection = input?.checkpoint ? replayWildsWorld([], input.checkpoint) : initialWildsWorldProjection();
    this.eventTail = [];
    for (const event of input?.events ?? []) this.appendExisting(event);
  }

  snapshot() {
    return this.projection;
  }

  checkpoint() {
    return checkpointWildsWorld(this.projection);
  }

  events() {
    return [...this.eventTail];
  }

  private appendExisting(event: WildsWorldEvent) {
    this.projection = reduceWildsWorldEvent(this.projection, event);
    this.eventTail = [...this.eventTail, event].slice(-2_048);
  }

  private append(kind: WildsWorldEventKind, payload: unknown, authority: Pick<WildsWorldAuthority, "actorId" | "pulse" | "occurredAt">, causeId: string) {
    const kaiKlok = this.projection.cursor?.pulse === authority.pulse ? this.projection.cursor.kaiKlok + 1 : 1;
    const event = createWildsWorldEvent({
      kind,
      actorId: authority.actorId,
      causeId,
      pulse: authority.pulse,
      kaiKlok,
      occurredAt: authority.occurredAt,
      previousEventId: this.projection.cursor?.eventId ?? null,
      payload
    });
    this.appendExisting(event);
    return event;
  }

  tick(input: { pulse: string; occurredAt: string; systemActorId: "receiz:pulse" }) {
    if (input.systemActorId !== "receiz:pulse") throw new Error("wilds_world_pulse_authority_invalid");
    const causeId = `pulse:${input.pulse}`;
    if (this.eventTail.some((event) => event.causeId === causeId)) return { events: [], projection: this.projection };
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt };
    const activeSites = Object.values(this.projection.sites).filter((site): site is WildsDynamicSite => site.familyId === "crystal-burrow") as WildsDynamicSite[];
    const site = generateCrystalBurrow({ pulse: input.pulse, ordinal: activeSites.length + 1, activeSites });
    const events: WildsWorldEvent[] = [];
    events.push(this.append("site.spawned", { site }, authority, causeId));
    const tracked = advanceDynamicSite(site, "tracked");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: tracked.phase }, authority, causeId));
    const emerged = advanceDynamicSite(tracked, "emerged");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: emerged.phase }, authority, causeId));
    const boss = generateCrystalBurrower({ site: emerged, pulse: input.pulse, ordinal: 1 });
    const raid = createWildsRaid({ boss, openedAt: input.occurredAt });
    events.push(this.append("boss.emerged", { boss, raid }, authority, causeId));
    return { events, projection: this.projection };
  }

  execute(command: WildsWorldCommand, authority: WildsWorldAuthority) {
    if (!authority.canonical) throw new Error("wilds_world_canonical_authority_required");
    if (!commandIdValid(command.commandId)) throw new Error("wilds_world_command_id_invalid");
    if (this.eventTail.some((event) => event.causeId === command.commandId)) return { events: [], projection: this.projection };
    const events: WildsWorldEvent[] = [];

    if (command.type === "raid.join") {
      const raid = Object.values(this.projection.raids).find((item) => item.bossId === command.bossId) as WildsRaid | undefined;
      if (!raid) throw new Error("wilds_world_raid_missing");
      const admitted = admitRaidPlayer(raid, authority.actorId, command.preferredSquad);
      events.push(this.append("raid.joined", { raid: admitted.raid, playerId: authority.actorId, role: admitted.role, squad: admitted.squad }, authority, command.commandId));
    } else if (command.type === "raid.contribute") {
      if (!/^sha256:[a-f0-9]{64}$/.test(command.cardProofDigest)) throw new Error("wilds_world_card_proof_invalid");
      const raid = Object.values(this.projection.raids).find((item) => item.bossId === command.bossId) as WildsRaid | undefined;
      const boss = this.projection.bosses[command.bossId] as WildsBoss | undefined;
      if (!raid || !boss) throw new Error("wilds_world_raid_missing");
      const contributionId = `contribution:${command.commandId}`;
      const result = applyRaidContribution({ ...command, raid, boss, playerId: authority.actorId, eventId: contributionId, occurredAt: authority.occurredAt });
      events.push(this.append("raid.contributed", { raid: result.raid, boss: result.boss, playerId: authority.actorId, cardProofDigest: command.cardProofDigest }, authority, command.commandId));
      const team = Object.values(this.projection.teams).find((item) => item.memberIds.includes(authority.actorId));
      if (team) {
        const league = scoreWildsLeague({ league: this.projection.league, teamId: team.id, eventId: contributionId, raidContribution: command.damage + command.support });
        events.push(this.append("league.scored", { league, teamId: team.id, contributionId }, authority, command.commandId));
      }
      if (result.defeated) {
        events.push(this.append("boss.defeated", { bossId: boss.id, defeatedAt: result.boss.defeatedAt }, authority, command.commandId));
        events.push(this.append("site.phase_changed", { siteId: boss.siteId, phase: "defeated" }, authority, command.commandId));
        events.push(this.append("site.memorialized", { siteId: boss.siteId, bossId: boss.id }, authority, command.commandId));
      }
    } else if (command.type === "team.create") {
      if (Object.values(this.projection.teams).some((team) => team.memberIds.includes(authority.actorId))) throw new Error("wilds_team_membership_exists");
      const team = createWildsTeam({ captainId: authority.actorId, name: command.name, occurredAt: authority.occurredAt, existingTeams: Object.values(this.projection.teams) });
      events.push(this.append("team.created", { team }, authority, command.commandId));
    } else {
      if (Object.values(this.projection.teams).some((team) => team.memberIds.includes(authority.actorId))) throw new Error("wilds_team_membership_exists");
      const team = this.projection.teams[command.teamId];
      if (!team) throw new Error("wilds_team_missing");
      events.push(this.append("team.joined", { team: joinWildsTeam(team, authority.actorId) }, authority, command.commandId));
    }
    return { events, projection: this.projection };
  }
}
