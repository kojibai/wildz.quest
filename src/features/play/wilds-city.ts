import { parseWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { verifyKaiTemporalRoot, type KaiTemporalRoot } from "./kai-temporal-root";
import { constitutionalDigest, WILDS_CONSTITUTION } from "./wilds-constitution";
import { resolveWildsCityFoundingAnchor, reviewWildsCityFootprint, WILDS_CITY_CELL_SIZE, WILDS_CITY_MAX_CELLS, type WildsCityAnchor, type WildsCityAnchorReference, type WildsCityCell } from "./wilds-city-footprint";
import { canonicalPortableCardJson } from "./portable-card";
import { compareWildsWorldEvents, verifyWildsWorldEvent, type CompatibleWildsWorldEvent, type WildsWorldEvent } from "./wilds-world-event";
import type { WildsWorldProjection } from "./wilds-world-state";
import { isWildsCivicCommand } from "./wilds-civic-command";

export { reviewWildsCityFootprint, WILDS_CITY_CELL_SIZE, WILDS_CITY_MAX_CELLS, wildsCityCellAt, wildsCityCellCenter, wildsCityFoundingAnchors } from "./wilds-city-footprint";
export type { WildsCityAnchor, WildsCityAnchorReference, WildsCityCell, WildsCityFootprintError, WildsCityFoundingAnchor } from "./wilds-city-footprint";

export const WILDS_CITY_RULES = Object.freeze({
  schema: "wildz.city-charter.v1",
  constitution: WILDS_CONSTITUTION.sourceDigest,
  scope: "voluntary stewardship coordination around an admitted built improvement",
  footprint: Object.freeze({ cellSize: WILDS_CITY_CELL_SIZE, maximumCells: WILDS_CITY_MAX_CELLS, review: "connected outdoor cells, public routes and landmark aprons protected" }),
  membership: "explicit applicant consent and acceptance by the founding resident; voluntary exit",
  jurisdiction: "maintenance and public-route priority statements",
  resolution: "unanimous snapshot of accepted residents; an objection or electorate departure closes the vote",
});
export const WILDS_CITY_RULES_DIGEST = constitutionalDigest(WILDS_CITY_RULES);
export const WILDS_CLAN_RULES = Object.freeze({
  schema: "wildz.clan-charter.v1",
  constitution: WILDS_CONSTITUTION.sourceDigest,
  scope: "voluntary association and its own membership",
  membership: "explicit participant consent and voluntary exit",
});
export const WILDS_CLAN_RULES_DIGEST = constitutionalDigest(WILDS_CLAN_RULES);

type CityRevision = Readonly<{ cityId: string; expectedRevision: number; expectedHead: string }>;
type ClanRevision = Readonly<{ clanId: string; expectedRevision: number; expectedHead: string }>;
type CivicCommand = (
  | Readonly<{ type: "city.found"; name: string; anchor: WildsCityAnchorReference; cells: readonly WildsCityCell[]; rulesDigest: string }>
  | (CityRevision & Readonly<{ type: "city.residency.request"; rulesDigest: string }>)
  | (CityRevision & Readonly<{ type: "city.residency.accept"; applicantId: string }>)
  | (CityRevision & Readonly<{ type: "city.residency.leave" }>)
  | (CityRevision & Readonly<{ type: "city.proposal.open"; plan: string }>)
  | (CityRevision & Readonly<{ type: "city.proposal.vote"; proposalId: string; vote: "yes" | "no" }>)
  | Readonly<{ type: "clan.create"; name: string; rulesDigest: string }>
  | (ClanRevision & Readonly<{ type: "clan.join"; rulesDigest: string }>)
  | (ClanRevision & Readonly<{ type: "clan.leave" }>)
) & Readonly<{ commandId: string }>;
export type WildsCityCommand = CivicCommand;
type ExistingCityCommand = Extract<CivicCommand, CityRevision>;
type CivicSourceCommand = CivicCommand & Readonly<{ kai: KaiTemporalRoot }>;
type CivicEventKind = "city.transitioned" | "clan.transitioned";
type CivicEventPayload = { command: CivicSourceCommand; constitutionalCommand: { type: CivicCommand["type"]; digest: string } };

const cityRevisionKeys = ["cityId", "expectedRevision", "expectedHead"] as const;
const clanRevisionKeys = ["clanId", "expectedRevision", "expectedHead"] as const;
const fieldNames = {
  "city.found": ["name", "anchor", "cells", "rulesDigest"],
  "city.residency.request": [...cityRevisionKeys, "rulesDigest"],
  "city.residency.accept": [...cityRevisionKeys, "applicantId"],
  "city.residency.leave": cityRevisionKeys,
  "city.proposal.open": [...cityRevisionKeys, "plan"],
  "city.proposal.vote": [...cityRevisionKeys, "proposalId", "vote"],
  "clan.create": ["name", "rulesDigest"],
  "clan.join": [...clanRevisionKeys, "rulesDigest"],
  "clan.leave": clanRevisionKeys,
} as const satisfies Record<CivicCommand["type"], readonly string[]>;

export function wildsCivicEventKind(command: CivicCommand): CivicEventKind {
  return command.type.startsWith("city.") ? "city.transitioned" : "clan.transitioned";
}

export type WildsCityMember = Readonly<{ actorId: string; joinedAt: number; eventId: string }>;
export type WildsCityApplication = Readonly<{ actorId: string; requestedAt: number; eventId: string }>;
export type WildsCityVote = Readonly<{ actorId: string; vote: "yes" | "no"; at: number; eventId: string }>;
export type WildsCityProposalResult = Readonly<{
  at: number; eventId: string; reason: "unanimous" | "opposed" | "electorate-changed"; yes: number; no: number;
}>;
export type WildsCityProposal = Readonly<{
  id: string; proposerId: string; plan: string; openedAt: number; openedRevision: number;
  electorate: readonly string[]; votes: Readonly<Record<string, WildsCityVote>>;
  status: "open" | "accepted" | "rejected"; result: WildsCityProposalResult | null;
}>;
export type WildsCivicHistoryEntry = Readonly<{
  eventId: string; actorId: string; at: number; sourceEvent: WildsWorldEvent<CivicEventPayload>; head: string; parentHead: string | null;
}>;
type CivicRecord = Readonly<{
  id: string; name: string; founderId: string; rulesDigest: string; revision: number; head: string; parentHead: string | null;
  history: readonly WildsCivicHistoryEntry[];
  members: Readonly<Record<string, WildsCityMember>>;
}>;
export type WildsCity = CivicRecord & Readonly<{
  anchor: WildsCityAnchor;
  cells: readonly WildsCityCell[];
  applications: Readonly<Record<string, WildsCityApplication>>;
  proposals: Readonly<Record<string, WildsCityProposal>>;
  activeProposalId: string | null;
  maintenancePlan: string | null;
}>;
export type WildsClan = CivicRecord;

export function wildsCityPopulation(city: WildsCity) {
  return Object.keys(city.members).length;
}

type CivicEventContext = Readonly<{ eventId: string; actorId: string; memberKey: string; at: number; command: CivicSourceCommand; event: WildsWorldEvent<CivicEventPayload> }>;
const own = <T>(map: Readonly<Record<string, T>> | undefined, key: string) =>
  map && Object.hasOwn(map, key) ? map[key] : undefined;

function civicText(input: unknown, maximum: number, error: string) {
  if (typeof input !== "string" || input.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(input)) throw new Error(error);
  const value = input.trim().normalize("NFC");
  if (!value || value.length > maximum) throw new Error(error);
  return value;
}

function civicName(value: unknown, error: string) {
  const name = civicText(value, 80, error);
  if (/[\t\r\n]/u.test(name)) throw new Error(error);
  return name;
}

function civicRecordId(kind: "city" | "clan" | "city-proposal", context: CivicEventContext) {
  return `wildz:${kind}:${constitutionalDigest({ actorId: context.memberKey, commandId: context.command.commandId }).slice(7)}`;
}

function nextCivicRevision(previous: CivicRecord | undefined, context: CivicEventContext) {
  const { eventId, actorId, at, event } = context;
  const parentHead = previous?.head ?? null;
  const revision = (previous?.revision ?? 0) + 1;
  const head = event.digest;
  return {
    revision, head, parentHead,
    history: [...(previous?.history ?? []), { eventId, actorId, at, sourceEvent: structuredClone(event), head, parentHead }]
  };
}

function member(context: CivicEventContext, actorId = context.actorId): WildsCityMember {
  return { actorId, joinedAt: context.at, eventId: context.eventId };
}

function foundCity(world: WildsWorldProjection, command: Extract<CivicCommand, { type: "city.found" }>, context: CivicEventContext): WildsCity {
  if (command.rulesDigest !== WILDS_CITY_RULES_DIGEST) throw new Error("wilds_city_rules_required");
  const name = civicName(command.name, "wilds_city_name_invalid");
  const reference = command.anchor;
  if (!reference || typeof reference !== "object" || Object.keys(reference).length !== 3
    || !["structure", "component", "creation"].includes(reference.kind) || typeof reference.id !== "string" || typeof reference.head !== "string") {
    throw new Error("wilds_city_anchor_invalid");
  }
  const anchor = resolveWildsCityFoundingAnchor(world, context.actorId, reference);
  if (!anchor) throw new Error("wilds_city_anchor_invalid");
  const footprint = reviewWildsCityFootprint(world, anchor, command.cells);
  if (!footprint.ok) throw new Error(footprint.reason);
  const id = civicRecordId("city", context);
  if (own(world.cities, id)) throw new Error("wilds_city_conflict");
  return { id, name, founderId: context.memberKey, rulesDigest: WILDS_CITY_RULES_DIGEST, anchor, cells: footprint.cells,
    ...nextCivicRevision(undefined, context), members: { [context.memberKey]: member(context) },
    applications: {}, proposals: {}, activeProposalId: null, maintenancePlan: null };
}

function closeProposal(city: WildsCity, proposal: WildsCityProposal, context: CivicEventContext, reason: WildsCityProposalResult["reason"]): Partial<WildsCity> {
  const votes = Object.values(proposal.votes);
  const yes = votes.filter(ballot => ballot.vote === "yes").length;
  const accepted = reason === "unanimous";
  const decided: WildsCityProposal = { ...proposal, status: accepted ? "accepted" : "rejected",
    result: { at: context.at, eventId: context.eventId, reason, yes, no: votes.length - yes } };
  return { proposals: { ...city.proposals, [proposal.id]: decided }, activeProposalId: null,
    ...(accepted ? { maintenancePlan: proposal.plan } : {}) };
}

function updateCity(city: WildsCity, command: ExistingCityCommand, context: CivicEventContext): Partial<WildsCity> {
  const { memberKey, actorId, at, eventId } = context;
  const resident = own(city.members, memberKey);
  const currentProposal = city.activeProposalId ? own(city.proposals, city.activeProposalId) : undefined;
  switch (command.type) {
    case "city.residency.request": {
      if (command.rulesDigest !== city.rulesDigest) throw new Error("wilds_city_rules_required");
      if (resident || own(city.applications, memberKey)) throw new Error("wilds_city_membership_exists");
      if (!own(city.members, city.founderId)) throw new Error("wilds_city_residency_closed");
      return { applications: { ...city.applications, [memberKey]: { actorId, requestedAt: at, eventId } } };
    }
    case "city.residency.accept": {
      if (!resident || memberKey !== city.founderId) throw new Error("wilds_city_membership_required");
      const applicant = typeof command.applicantId === "string" ? parseWildzPlayerCoordinate(command.applicantId)?.actorId : undefined;
      const applications = { ...city.applications };
      const pending = applicant ? own(applications, applicant) : undefined;
      if (!applicant || !pending || own(city.members, applicant)) throw new Error("wilds_city_application_invalid");
      delete applications[applicant];
      return { applications, members: { ...city.members, [applicant]: member(context, pending.actorId) } };
    }
    case "city.residency.leave": {
      const applications = { ...city.applications };
      const members = { ...city.members };
      if (!resident && !own(applications, memberKey)) throw new Error("wilds_city_membership_required");
      delete applications[memberKey];
      delete members[memberKey];
      return { members, applications, ...(currentProposal?.electorate.includes(memberKey)
        ? closeProposal(city, currentProposal, context, "electorate-changed") : {}) };
    }
    case "city.proposal.open": {
      if (!resident) throw new Error("wilds_city_membership_required");
      if (currentProposal) throw new Error("wilds_city_proposal_open");
      const id = civicRecordId("city-proposal", context);
      const plan = civicText(command.plan, 600, "wilds_city_plan_invalid");
      const electorate = Object.keys(city.members).sort();
      const proposal: WildsCityProposal = { id, proposerId: memberKey, plan, openedAt: at, openedRevision: city.revision,
        electorate, votes: { [memberKey]: { actorId, vote: "yes", at, eventId } }, status: "open", result: null };
      return electorate.length === 1 ? closeProposal(city, proposal, context, "unanimous")
        : { activeProposalId: id, proposals: { ...city.proposals, [id]: proposal } };
    }
    case "city.proposal.vote": {
      if (!currentProposal || currentProposal.id !== command.proposalId) throw new Error("wilds_city_proposal_stale");
      if (!resident || !currentProposal.electorate.includes(memberKey)) throw new Error("wilds_city_vote_ineligible");
      if (own(currentProposal.votes, memberKey) || (command.vote !== "yes" && command.vote !== "no")) throw new Error("wilds_city_vote_invalid");
      const proposal: WildsCityProposal = { ...currentProposal, votes: { ...currentProposal.votes, [memberKey]: { actorId, vote: command.vote, at, eventId } } };
      if (command.vote === "no") return closeProposal(city, proposal, context, "opposed");
      if (proposal.electorate.every(voter => own(proposal.votes, voter)?.vote === "yes")) return closeProposal(city, proposal, context, "unanimous");
      return { proposals: { ...city.proposals, [proposal.id]: proposal } };
    }
  }
}

function transitionClan(world: WildsWorldProjection, command: Extract<CivicCommand, { type: `clan.${string}` }>, context: CivicEventContext): WildsClan {
  const { memberKey } = context;
  if (command.type === "clan.create") {
    if (command.rulesDigest !== WILDS_CLAN_RULES_DIGEST) throw new Error("wilds_clan_rules_required");
    const id = civicRecordId("clan", context);
    if (own(world.clans, id)) throw new Error("wilds_clan_conflict");
    return { id, name: civicName(command.name, "wilds_clan_name_invalid"), founderId: memberKey, rulesDigest: WILDS_CLAN_RULES_DIGEST,
      members: { [memberKey]: member(context) }, ...nextCivicRevision(undefined, context) };
  }
  const clan = own(world.clans, command.clanId);
  if (!clan || clan.revision !== command.expectedRevision || clan.head !== command.expectedHead) throw new Error("wilds_clan_revision_stale");
  const members = { ...clan.members };
  const previous = own(members, memberKey);
  if (command.type === "clan.join") {
    if (command.rulesDigest !== clan.rulesDigest) throw new Error("wilds_clan_rules_required");
    if (previous) throw new Error("wilds_clan_membership_exists");
    members[memberKey] = member(context);
  } else {
    if (!previous) throw new Error("wilds_clan_membership_required");
    delete members[memberKey];
  }
  return { ...clan, members, ...nextCivicRevision(clan, context) };
}

/** Civic state is created only as a projection of a verified world append.
 * Replaying checks the same command, exact Kai, predecessor and actor. */
export function reduceWildsCivicEvent(world: WildsWorldProjection, event: CompatibleWildsWorldEvent, payload: Record<string, unknown>): Pick<WildsWorldProjection, "cities" | "clans"> {
  const command = payload.command as CivicSourceCommand | undefined;
  const binding = payload.constitutionalCommand as { type?: unknown; digest?: unknown } | undefined;
  if (!command || typeof command !== "object" || !isWildsCivicCommand(command)
    || event.kind !== wildsCivicEventKind(command) || command.commandId !== event.causeId || event.causeId.length < 6
    || binding?.type !== command.type || binding.digest !== constitutionalDigest(command)
    || own(world.constitutionalCommandReceipts, event.causeId)) throw new Error("wilds_civic_command_binding_invalid");
  if (!command.kai) throw new Error("wilds_world_kai_root_required");
  const kai = verifyKaiTemporalRoot(command.kai);
  if (event.schema !== "receiz.wilds_world_event.v4" || kai.uPulse !== event.uPulse
    || kai.coordinate !== deriveKaiKlokMomentFromUPulse({ uPulse: kai.uPulse, authority: kai.authority }).coordinate) {
    throw new Error("wilds_civic_kai_invalid");
  }
  const keys = fieldNames[command.type];
  if (Object.keys(command).length !== keys.length + 3 || keys.some(key => !Object.hasOwn(command, key))) throw new Error("wilds_civic_command_invalid");
  const identity = parseWildzPlayerCoordinate(event.actorId);
  if (!identity) throw new Error("wilds_civic_identity_required");
  const context: CivicEventContext = {
    eventId: event.eventId, actorId: event.actorId, memberKey: identity.actorId, at: event.uPulse, command, event: event as WildsWorldEvent<CivicEventPayload>
  };
  if (command.type === "clan.create" || command.type === "clan.join" || command.type === "clan.leave") {
    const clan = transitionClan(world, command, context);
    return { clans: { ...world.clans, [clan.id]: clan } };
  }
  if (command.type === "city.found") {
    const city = foundCity(world, command, context);
    return { cities: { ...world.cities, [city.id]: city } };
  }
  const previous = own(world.cities, command.cityId);
  if (!previous || previous.revision !== command.expectedRevision || previous.head !== command.expectedHead) throw new Error("wilds_city_revision_stale");
  const city: WildsCity = { ...previous, ...updateCity(previous, command, context), ...nextCivicRevision(previous, context) };
  return { cities: { ...world.cities, [city.id]: city } };
}

const same = (left: unknown, right: unknown) => left === right || canonicalPortableCardJson(left ?? null) === canonicalPortableCardJson(right ?? null);

function carriesCivicHistory(
  held: WildsWorldProjection, candidate: WildsWorldProjection, collection: "cities" | "clans", prior: WildsCity | WildsClan
) {
  const next = own(candidate[collection], prior.id);
  if (!next || !Array.isArray(next.history) || next.history.length !== next.revision || next.revision < prior.revision) return false;
  if (!prior.history.every(({ sourceEvent }) => same(own(held.constitutionalCommandReceipts, sourceEvent.causeId), own(candidate.constitutionalCommandReceipts, sourceEvent.causeId)))) return false;
  if (next === prior) return true;
  if (!prior.history.every((entry, index) => same(entry, next.history[index]))) return false;
  if (next.revision === prior.revision) return same(prior, next);
  let replay = held;
  // The caller already has a candidate world source. Check that it actually
  // carries the same subject and that its claimed state derives from the
  // exact civic events attached to its later revisions.
  let precedingEvent = prior.history.at(-1)?.sourceEvent;
  for (const entry of next.history.slice(prior.revision)) {
    const event = entry?.sourceEvent;
    if (!event || !verifyWildsWorldEvent(event).ok || (precedingEvent && compareWildsWorldEvents(precedingEvent, event) >= 0)) return false;
    const receipt = own(candidate.constitutionalCommandReceipts, event.causeId);
    if (!receipt || receipt.actorId !== event.actorId || receipt.type !== event.payload.command.type || receipt.digest !== constitutionalDigest(event.payload.command)
      || receipt.eventIds.length !== 1 || receipt.eventIds[0] !== event.eventId) return false;
    replay = { ...replay, ...reduceWildsCivicEvent(replay, event, event.payload) };
    const derived = own(replay[collection], prior.id);
    if (!derived || !same(derived.history.at(-1), entry)) return false;
    precedingEvent = event;
  }
  return same(own(replay[collection], prior.id), next);
}

/** A projection may advance only when it carries the admitted civic prefix.
 * Callers retain the full predecessor world on a missing or conflicting
 * prefix so the next command never appends against a hybrid branch. */
export function preservesWildsCivicHistory(held: WildsWorldProjection, candidate: WildsWorldProjection) {
  try {
    for (const city of Object.values(held.cities ?? {})) {
      if (!carriesCivicHistory(held, candidate, "cities", city)) return false;
      if (city.anchor.kind === "structure" && !same(held.structures[city.anchor.id], candidate.structures[city.anchor.id])) return false;
      if (city.anchor.sourceEventId && !same(held.creationEvents?.[city.anchor.sourceEventId], candidate.creationEvents?.[city.anchor.sourceEventId])) return false;
      for (const lot of city.anchor.materialLots) {
        if (!same(held.materialLots[lot.id], candidate.materialLots[lot.id])
          || candidate.consumedMaterialLots[lot.id] !== city.anchor.id) return false;
      }
    }
    return Object.values(held.clans ?? {}).every(clan => carriesCivicHistory(held, candidate, "clans", clan));
  } catch {
    return false;
  }
}
