import { generateCrystalBurrower, type WildsBoss } from "./wilds-boss-generator";
import { deriveWildsBossSuccessor, generateWildsBoss, WILDS_BOSS_FAMILIES, type WildsBossDefinition } from "./wilds-boss-ecology";
import { advanceDynamicSite, generateCrystalBurrow, type WildsDynamicSite } from "./wilds-dynamic-sites";
import { advanceWildsEcologySite, deriveWildsEcologyChild, generateWildsEcologyEnsemble, type WildsEcologyPhase, type WildsEcologySite } from "./wilds-ecology";
import { admitRaidPlayer, applyRaidContribution, createWildsRaid, type WildsRaid } from "./wilds-raid-core";
import { applyWildsRaidIntent, createWildsRaidEncounter, type WildsRaidIntent } from "./wilds-raid-encounter";
import { admitWildsRaidParticipant, createWildsRaidRound, renewWildsRaidLease, retreatWildsRaidParticipant, settleWildsRaidRound, type WildsRaidRound } from "./wilds-raid-round";
import type { PortableCardAsset } from "./portable-card";
import { createWildsTeam, joinWildsTeam, scoreWildsLeague } from "./wilds-team-league";
import { acceptWildsInvite, assembleWildsSquad, changeWildsRole, inviteWildsPlayer, reportWildsAbuse, scheduleWildsTeamEvent, type WildsSocialTeam } from "./wilds-social-core";
import { createWildsWorldEvent, type WildsWorldEvent, type WildsWorldEventKind } from "./wilds-world-event";
import { verifyWildsWorldCommandCard } from "./wilds-world-authority";
import {
  checkpointWildsWorld,
  initialWildsWorldProjection,
  replayWildsWorld,
  reduceWildsWorldEvent,
  type WildsWorldCheckpoint,
  type WildsWorldEcologyProjection,
  type WildsWorldProjection
} from "./wilds-world-state";

export type WildsWorldCommand =
  | { type: "boss.track"; bossId: string; position: { x: number; z: number }; commandId: string }
  | { type: "raid.enter"; bossId: string; roundId: string; position: { x: number; z: number }; preferredSquad?: number; commandId: string }
  | { type: "raid.act"; bossId: string; roundId: string; intent: WildsRaidIntent["type"]; commandId: string }
  | { type: "raid.lease"; bossId: string; roundId: string; status: "connected" | "disconnected"; commandId: string }
  | { type: "raid.retreat"; bossId: string; roundId: string; commandId: string }
  | { type: "raid.join"; bossId: string; preferredSquad?: number; commandId: string }
  | { type: "raid.contribute"; bossId: string; damage: number; support: number; cardProofDigest: string; commandId: string }
  | { type: "team.create"; name: string; commandId: string }
  | { type: "team.join"; teamId: string; commandId: string }
  | { type: "team.invite"; teamId: string; inviteeId: string; expiresAt: string; inviteeAccountAgeDays?: number; commandId: string }
  | { type: "team.invite.accept"; teamId: string; inviteId: string; commandId: string }
  | { type: "team.role"; teamId: string; playerId: string; role: "captain" | "officer" | "member"; commandId: string }
  | { type: "team.role.change"; teamId: string; playerId: string; role: "captain" | "officer" | "member"; commandId: string }
  | { type: "team.event.schedule"; teamId: string; startsAt: string; endsAt: string; commandId: string }
  | { type: "team.squad.assemble"; teamId: string; eventId: string; playerIds: string[]; commandId: string }
  | { type: "social.report"; subjectId: string; reason: string; commandId: string }
  | { type: "ecology.discover"; siteId: string; position: { x: number; z: number }; commandId: string }
  | { type: "ecology.contribute"; siteId: string; position: { x: number; z: number }; amount: number; cardProofDigest: string; commandId: string };

export type WildsWorldAuthority = {
  actorId: string;
  canonical: boolean;
  pulse: string;
  occurredAt: string;
  card?: PortableCardAsset;
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
    const checkpointCursor = input?.checkpoint?.projection.cursor ?? null;
    for (const event of input?.events ?? []) {
      if (checkpointCursor && (event.pulse < checkpointCursor.pulse || (event.pulse === checkpointCursor.pulse && event.kaiKlok <= checkpointCursor.kaiKlok))) continue;
      this.appendExisting(event);
    }
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
    // A scheduler retry may arrive after a newer pulse has already been
    // committed (for example after a process restart).  Reject that stale
    // tick before generating any deterministic sites so it can never append
    // an out-of-order event or accidentally fork the world timeline.
    if (this.projection.cursor && input.pulse < this.projection.cursor.pulse) {
      throw new Error("wilds_world_pulse_order_invalid");
    }
    const causeId = `pulse:${input.pulse}`;
    if (this.eventTail.some((event) => event.causeId === causeId)) return { events: [], projection: this.projection };
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt };
    const existingBosses = Object.values(this.projection.bosses) as WildsBossDefinition[];
    const undefeated = existingBosses.filter((boss) => !["defeated", "memorialized", "withdrawn"].includes(boss.phase));
    if (undefeated.length >= 3) return { events: [], projection: this.projection };
    const events: WildsWorldEvent[] = [];

    const defeatedParent = existingBosses.find((boss) => (boss.phase === "defeated" || boss.phase === "memorialized") && !existingBosses.some((candidate) => candidate.parentBossId === boss.id));
    if (defeatedParent) {
      const successor = deriveWildsBossSuccessor({
        parent: defeatedParent,
        causeEventId: `defeat:${defeatedParent.id}`,
        pulse: input.pulse,
        ordinal: existingBosses.length + 1,
        existingBosses
      });
      if (successor && !undefeated.some((boss) => boss.regionId === successor.regionId)) {
        const site: WildsDynamicSite = {
          id: successor.siteId,
          familyId: "crystal-burrow",
          name: "Crystal Burrow",
          position: { ...successor.position },
          radius: 9,
          phase: "emerged",
          spawnedAt: successor.emergedAt,
          expiresAt: new Date(Date.parse(successor.emergedAt) + 30 * 24 * 60 * 60 * 1_000).toISOString(),
          bossId: null,
          seedDigest: successor.seedDigest
        };
        events.push(this.append("site.spawned", { site }, authority, causeId));
        const raid = createWildsRaidRound({ boss: successor, ordinal: 1, openedAt: input.occurredAt });
        events.push(this.append("boss.emerged", { boss: successor, raid }, authority, causeId));
        return { events, projection: this.projection };
      }
    }

    const activeSites = Object.values(this.projection.sites).filter((site): site is WildsDynamicSite => site.familyId === "crystal-burrow") as WildsDynamicSite[];
    const occupiedRegions = new Set(undefeated.map((boss) => boss.regionId));
    let site: WildsDynamicSite | null = null;
    for (let probe = 0; probe < 128; probe += 1) {
      const candidate = generateCrystalBurrow({ pulse: input.pulse, ordinal: activeSites.length + probe + 1, activeSites });
      const candidateRegion = `region:${Math.floor(candidate.position.x / 64)}:${Math.floor(candidate.position.z / 64)}`;
      if (!occupiedRegions.has(candidateRegion)) { site = candidate; break; }
    }
    if (!site) return { events, projection: this.projection };
    events.push(this.append("site.spawned", { site }, authority, causeId));
    const tracked = advanceDynamicSite(site, "tracked");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: tracked.phase }, authority, causeId));
    const emerged = advanceDynamicSite(tracked, "emerged");
    events.push(this.append("site.phase_changed", { siteId: site.id, phase: emerged.phase }, authority, causeId));
    const familyId = WILDS_BOSS_FAMILIES[existingBosses.length % WILDS_BOSS_FAMILIES.length]!;
    const boss = generateWildsBoss({ familyId, site: emerged, pulse: input.pulse, ordinal: existingBosses.filter((candidate) => candidate.familyId === familyId).length + 1, existingBosses });
    const raid = createWildsRaidRound({ boss, ordinal: 1, openedAt: input.occurredAt });
    events.push(this.append("boss.emerged", { boss, raid }, authority, causeId));
    return { events, projection: this.projection };
  }

  tickEcology(input: { pulse: string; occurredAt: string; systemActorId: "receiz:pulse" }) {
    if (input.systemActorId !== "receiz:pulse") throw new Error("wilds_world_pulse_authority_invalid");
    if (this.projection.cursor && input.pulse < this.projection.cursor.pulse) {
      throw new Error("wilds_world_pulse_order_invalid");
    }
    const causeId = `ecology-pulse:${input.pulse}`;
    if (this.eventTail.some((event) => event.causeId === causeId)) return { events: [], projection: this.projection };
    const authority = { actorId: input.systemActorId, pulse: input.pulse, occurredAt: input.occurredAt };
    const events: WildsWorldEvent[] = [];
    const pulseMs = Date.parse(input.pulse);
    const orderedSites = () => Object.values(this.projection.ecologySites)
      .sort((left, right) => left.spawnedAt.localeCompare(right.spawnedAt) || left.id.localeCompare(right.id));
    const due = (at: string) => pulseMs >= Date.parse(at);
    const changePhase = (site: WildsWorldEcologyProjection, phase: WildsEcologyPhase) => {
      const advanced = advanceWildsEcologySite(site, phase);
      events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: advanced.phase }, authority, causeId));
      return this.projection.ecologySites[site.id]!;
    };
    const resolve = (site: WildsWorldEcologyProjection) => {
      const resolving = site.phase === "resolving" ? site : changePhase(site, "resolving");
      const aftermath = advanceWildsEcologySite(resolving, "aftermath");
      const resolved: WildsWorldEcologyProjection = { ...resolving, phase: aftermath.phase, resolvedAt: resolving.resolvesAt };
      events.push(this.append("ecology.resolved", { site: resolved }, authority, causeId));
    };

    // Resolve an admitted site when resolution and expiry share a deadline;
    // untouched foreshadowed sites expire and release capacity instead.
    for (const candidate of orderedSites()) {
      let site = this.projection.ecologySites[candidate.id];
      if (!site || site.phase === "aftermath" || site.phase === "historical" || site.phase === "expired") continue;
      const resolvesBeforeExpiry = Date.parse(site.resolvesAt) <= Date.parse(site.expiresAt);
      const expiresBeforeActivation = Date.parse(site.expiresAt) < Date.parse(site.activatesAt);

      if (site.phase === "foreshadowed") {
        if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "discovered" && due(site.expiresAt) && expiresBeforeActivation) {
        changePhase(site, "expired");
        continue;
      }
      if (site.phase === "discovered" && due(site.activatesAt)) site = changePhase(site, "active");
      if (site.phase === "discovered") {
        if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "active") {
        if (due(site.resolvesAt) && resolvesBeforeExpiry) resolve(site);
        else if (due(site.expiresAt)) changePhase(site, "expired");
        continue;
      }
      if (site.phase === "resolving" && due(site.resolvesAt)) resolve(site);
    }

    const aftermath = orderedSites()
      .filter((site) => site.phase === "aftermath")
      .filter((site) => !Object.values(this.projection.ecologySites).some((candidate) => candidate.parentSiteId === site.id));
    for (const site of orderedSites().filter((candidate) => candidate.phase === "aftermath" && due(candidate.historicizesAt))) {
      const historical = advanceWildsEcologySite(site, "historical");
      events.push(this.append("ecology.historicized", { site: { ...site, phase: historical.phase } }, authority, causeId));
    }
    for (const parent of aftermath) {
      const existingSites = Object.values(this.projection.ecologySites) as WildsEcologySite[];
      if (existingSites.some((candidate) => candidate.parentSiteId === parent.id)) continue;
      const child = deriveWildsEcologyChild({ parent, ordinal: existingSites.length + 1, existingSites });
      if (child) events.push(this.append("ecology.spawned", { site: ecologyProjection(child) }, authority, causeId));
    }
    const existingSites = Object.values(this.projection.ecologySites) as WildsEcologySite[];
    const ensemble = generateWildsEcologyEnsemble({ pulse: input.pulse, existingSites, ordinalStart: existingSites.length + 1 });
    for (const site of ensemble) events.push(this.append("ecology.spawned", { site: ecologyProjection(site) }, authority, causeId));
    return { events, projection: this.projection };
  }

  execute(command: WildsWorldCommand, authority: WildsWorldAuthority) {
    if (!authority.canonical) throw new Error("wilds_world_canonical_authority_required");
    if (!commandIdValid(command.commandId)) throw new Error("wilds_world_command_id_invalid");
    if (this.eventTail.some((event) => event.causeId === command.commandId)) return { events: [], projection: this.projection };
    authority = { ...authority, card: verifyWildsWorldCommandCard({ command, card: authority.card }) };
    const events: WildsWorldEvent[] = [];

    if (command.type === "boss.track") {
      const boss = this.projection.bosses[command.bossId];
      if (!boss) throw new Error("wilds_world_boss_missing");
      const position = boss.position as { x: number; z: number } | undefined;
      const radius = Number(boss.territoryRadius ?? 18);
      if (!position || !positionNear(command.position, position, radius * 2)) throw new Error("wilds_boss_tracking_location_invalid");
      events.push(this.append("site.phase_changed", { siteId: boss.siteId, phase: "tracked", bossId: boss.id, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "raid.enter") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const position = boss.position as { x: number; z: number } | undefined;
      if (!position || !positionNear(command.position, position, Number(boss.territoryRadius ?? 18))) throw new Error("wilds_raid_location_invalid");
      const admitted = admitWildsRaidParticipant(raid, { playerId: authority.actorId, occurredAt: authority.occurredAt, eventOrdinal: this.projection.revision + 1, preferredSquad: command.preferredSquad });
      events.push(this.append("raid.entered", { raid: admitted.round, boss, playerId: authority.actorId, role: admitted.role, squad: admitted.squad }, authority, command.commandId));
    } else if (command.type === "raid.lease") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const nextRound = renewWildsRaidLease(raid, { playerId: authority.actorId, status: command.status, occurredAt: authority.occurredAt });
      events.push(this.append("raid.lease_changed", { raid: nextRound, boss, playerId: authority.actorId, status: command.status }, authority, command.commandId));
    } else if (command.type === "raid.retreat") {
      const boss = this.projection.bosses[command.bossId];
      const raid = this.projection.raids[command.roundId] as WildsRaidRound | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      const nextRound = retreatWildsRaidParticipant(raid, { playerId: authority.actorId, occurredAt: authority.occurredAt });
      events.push(this.append("raid.retreated", { raid: nextRound, boss, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "raid.act") {
      if (!authority.card) throw new Error("wilds_world_verified_card_required");
      const boss = this.projection.bosses[command.bossId] as unknown as WildsBossDefinition | undefined;
      const raid = this.projection.raids[command.roundId] as WildsRaidRound & { encounter?: ReturnType<typeof createWildsRaidEncounter> } | undefined;
      if (!boss || !raid || raid.bossId !== boss.id) throw new Error("wilds_world_raid_missing");
      if (!raid.squads.flat().includes(authority.actorId) && !raid.supportPlayerIds.includes(authority.actorId)) throw new Error("wilds_raid_player_not_admitted");
      const encounter = raid.encounter ?? createWildsRaidEncounter({ boss, roundId: raid.id, openedAt: raid.openedAt });
      const nextEncounter = applyWildsRaidIntent(encounter, { type: command.intent, commandId: command.commandId }, {
        actorId: authority.actorId, card: authority.card, eventOrdinal: this.projection.revision + 1, occurredAt: authority.occurredAt
      });
      const nextBoss = { ...boss, health: nextEncounter.bossHealth, phase: nextEncounter.phase === "active" ? "contested" : nextEncounter.phase } as WildsBossDefinition;
      const nextRound = nextEncounter.phase === "defeated"
        ? { ...settleWildsRaidRound(raid, { occurredAt: authority.occurredAt, winningEventId: command.commandId }), encounter: nextEncounter }
        : { ...raid, phase: nextEncounter.phase === "transforming" ? "transformation_lock" as const : "active" as const, encounter: nextEncounter };
      const acceptedAction = nextEncounter.actions.at(-1);
      events.push(this.append("raid.acted", { raid: nextRound, boss: nextBoss, playerId: authority.actorId, acceptedAction: acceptedAction ? { ...acceptedAction } : null }, authority, command.commandId));
      if (nextEncounter.phase === "defeated") {
        events.push(this.append("boss.defeated", { bossId: boss.id, defeatedAt: authority.occurredAt, winningCommandId: command.commandId }, authority, command.commandId));
      }
    } else if (command.type === "ecology.discover") {
      const site = this.projection.ecologySites[command.siteId];
      if (!site || site.phase !== "foreshadowed") throw new Error("wilds_ecology_discovery_phase_invalid");
      if (!positionNear(command.position, site.position, site.radius)) throw new Error("wilds_ecology_location_invalid");
      const discovered: WildsWorldEcologyProjection = {
        ...site,
        phase: "discovered",
        discoveredAt: authority.occurredAt,
        discoveredBy: authority.actorId
      };
      events.push(this.append("ecology.discovered", { site: discovered, playerId: authority.actorId }, authority, command.commandId));
    } else if (command.type === "ecology.contribute") {
      if (!/^sha256:[a-f0-9]{64}$/.test(command.cardProofDigest)) throw new Error("wilds_world_card_proof_invalid");
      if (!Number.isSafeInteger(command.amount) || command.amount < 1 || command.amount > 10) throw new Error("wilds_ecology_contribution_invalid");
      let site = this.projection.ecologySites[command.siteId];
      if (!site || (site.phase !== "discovered" && site.phase !== "active")) throw new Error("wilds_ecology_contribution_phase_invalid");
      if (!positionNear(command.position, site.position, site.radius)) throw new Error("wilds_ecology_location_invalid");
      if (site.phase === "discovered") {
        events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: "active" }, authority, command.commandId));
        site = this.projection.ecologySites[site.id]!;
      }
      const contributed: WildsWorldEcologyProjection = {
        ...site,
        contributionTotal: Math.min(10, site.contributionTotal + command.amount),
        participantIds: site.participantIds.includes(authority.actorId) ? site.participantIds : [...site.participantIds, authority.actorId].slice(-128)
      };
      events.push(this.append("ecology.contributed", { site: contributed, playerId: authority.actorId, amount: command.amount, cardProofDigest: command.cardProofDigest }, authority, command.commandId));
      if (contributed.contributionTotal >= 10) {
        events.push(this.append("ecology.phase_changed", { siteId: site.id, phase: "resolving" }, authority, command.commandId));
        const resolved: WildsWorldEcologyProjection = { ...contributed, phase: "aftermath", resolvedAt: authority.occurredAt };
        events.push(this.append("ecology.resolved", { site: resolved }, authority, command.commandId));
      }
    } else if (command.type === "raid.join") {
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
    } else if (command.type === "team.join") {
      if (Object.values(this.projection.teams).some((team) => team.memberIds.includes(authority.actorId))) throw new Error("wilds_team_membership_exists");
      const team = this.projection.teams[command.teamId];
      if (!team) throw new Error("wilds_team_missing");
      events.push(this.append("team.joined", { team: joinWildsTeam(team, authority.actorId) }, authority, command.commandId));
    } else if (command.type === "team.invite" || command.type === "team.invite.accept" || command.type === "team.role" || command.type === "team.role.change" || command.type === "team.event.schedule" || command.type === "team.squad.assemble") {
      const current = this.projection.teams[command.teamId];
      if (!current) throw new Error("wilds_team_missing");
      const social = socialTeam(current);
      let next: WildsSocialTeam;
      let kind: WildsWorldEventKind;
      if (command.type === "team.invite") {
        const result = inviteWildsPlayer({ team: social, inviterId: authority.actorId, inviteeId: command.inviteeId, occurredAt: authority.occurredAt, expiresAt: command.expiresAt, inviteeAccountAgeDays: command.inviteeAccountAgeDays }); next = result.team; kind = "team.invited";
      } else if (command.type === "team.invite.accept") {
        next = acceptWildsInvite({ team: social, inviteId: command.inviteId, playerId: authority.actorId, occurredAt: authority.occurredAt }).team; kind = "team.invite_accepted";
      } else if (command.type === "team.role" || command.type === "team.role.change") {
        next = changeWildsRole({ team: social, actorId: authority.actorId, playerId: command.playerId, role: command.role }).team; kind = "team.role_changed";
      } else if (command.type === "team.event.schedule") {
        next = scheduleWildsTeamEvent({ team: social, organizerId: authority.actorId, startsAt: command.startsAt, endsAt: command.endsAt, occurredAt: authority.occurredAt }).team; kind = "team.event_scheduled";
      } else {
        next = assembleWildsSquad({ team: social, eventId: command.eventId, playerIds: command.playerIds }).team; kind = "team.squad_assembled";
      }
      events.push(this.append(kind, { team: projectionTeam(next, current) }, authority, command.commandId));
    } else if (command.type === "social.report") {
      const report = reportWildsAbuse({ reporterId: authority.actorId, subjectId: command.subjectId, reason: command.reason, occurredAt: authority.occurredAt });
      events.push(this.append("social.abuse_reported", { report }, authority, command.commandId));
    }
    return { events, projection: this.projection };
  }
}

function positionNear(left: { x: number; z: number }, right: { x: number; z: number }, radius: number) {
  return Number.isFinite(left.x) && Number.isFinite(left.z) && Math.hypot(left.x - right.x, left.z - right.z) <= radius;
}

function ecologyProjection(site: WildsEcologySite): WildsWorldEcologyProjection {
  return {
    ...site,
    discoveredAt: null,
    discoveredBy: null,
    contributionTotal: 0,
    participantIds: [],
    resolvedAt: null
  };
}

function socialTeam(team: import("./wilds-team-league").WildsTeam): WildsSocialTeam {
  const members = team.members ?? team.memberIds.map((playerId) => ({ playerId, role: playerId === team.captainId ? "captain" as const : "member" as const, joinedAt: team.createdAt }));
  return { id: team.id, name: team.name, captainId: team.captainId, members, invites: team.invites ?? [], events: team.events ?? [] };
}

function projectionTeam(team: WildsSocialTeam, previous: import("./wilds-team-league").WildsTeam) {
  return { ...previous, captainId: team.captainId, memberIds: team.members.map((member) => member.playerId), members: team.members, invites: team.invites, events: team.events };
}
