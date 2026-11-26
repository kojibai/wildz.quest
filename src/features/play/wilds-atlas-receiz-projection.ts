import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { constitutionalDigest } from "./wilds-constitution";
import { canonicalPortableCardJson } from "./portable-card";
import { reduceWildsCivicEvent, type WildsCity, type WildsClan } from "./wilds-city";
import { isWildsCivicCommand } from "./wilds-civic-command";
import { compareWildsWorldEvents, verifyWildsWorldEvent, type WildsWorldEvent } from "./wilds-world-event";
import { mergeWorldCreationSourceRows } from "./creation/world-source";
import { mergeWildsConstructionPersistence } from "./wilds-construction-persistence";
import type { WildsWorldProjection } from "./wilds-world-state";

const same = (a: unknown, b: unknown) => a === b || canonicalPortableCardJson(a) === canonicalPortableCardJson(b);

/** Project the civic delta of an exact event from its enclosing Receiz replay
 * source. The shared domain has its own predecessor; the independent local
 * world cursor and the event's original causal coordinate stay intact. */
export function applyWildsAtlasCivicEvent(world: WildsWorldProjection, event: WildsWorldEvent, sourceOwner: string) {
  if (!event || (event.kind !== "city.transitioned" && event.kind !== "clan.transitioned")
    || event.schema !== "receiz.wilds_world_event.v4" || !verifyWildsWorldEvent(event).ok) throw Error("wilds_atlas_event_invalid");
  if (!sameWildzPlayerCoordinate(event.actorId, sourceOwner)) throw Error("wilds_atlas_event_actor_mismatch");
  const payload = event.payload as Record<string, unknown>;
  const command = payload?.command as { type: string; cityId?: string; clanId?: string } | undefined;
  if (!command || !isWildsCivicCommand(command)) throw Error("wilds_atlas_event_invalid");
  const receipt = { type: command.type, digest: constitutionalDigest(command), actorId: event.actorId, eventIds: [event.eventId] };
  const held = Object.hasOwn(world.constitutionalCommandReceipts ?? {}, event.causeId) ? world.constitutionalCommandReceipts?.[event.causeId] : undefined;
  if (held && same(held, receipt)) return world;
  const prior = "cityId" in command ? world.cities?.[command.cityId] : "clanId" in command ? world.clans?.[command.clanId] : undefined;
  const preceding = prior?.history.at(-1)?.sourceEvent;
  if (preceding && compareWildsWorldEvents(preceding, event) >= 0) throw Error("wilds_atlas_event_order_invalid");
  return {
    ...world, ...reduceWildsCivicEvent(world, event, payload),
    constitutionalCommandReceipts: { ...world.constitutionalCommandReceipts, [event.causeId]: receipt }
  };
}

/** Append only verified civic prefixes. A local fork, missing event, or
 * overlapping claim cannot replace the actor's held civic history. */
export function mergeWildsAtlasCivic(held: WildsWorldProjection, shared: WildsWorldProjection): WildsWorldProjection {
  let next = held;
  function merge<K extends "cities" | "clans">(kind: K) {
    for (const [id, candidate] of Object.entries<WildsCity | WildsClan>(shared[kind] ?? {})) {
      const current = next[kind]?.[id];
      if (current && (candidate.revision <= current.revision
        || !current.history.every((prior, i) => same(prior, candidate.history[i])))) continue;
      if (!current && kind === "cities" && "cells" in candidate && Object.values(next.cities ?? {}).some(city =>
        city.cells.some(cell => candidate.cells.some(other => other.x === cell.x && other.z === cell.z)))) continue;
      const receipts = { ...next.constitutionalCommandReceipts };
      let conflict = false;
      for (const { sourceEvent } of candidate.history) {
        const receipt = shared.constitutionalCommandReceipts?.[sourceEvent.causeId];
        if (!receipt || (Object.hasOwn(receipts, sourceEvent.causeId) && !same(receipts[sourceEvent.causeId], receipt))) { conflict = true; break; }
        receipts[sourceEvent.causeId] = receipt;
      }
      if (!conflict) next = { ...next, [kind]: { ...next[kind], [id]: candidate }, constitutionalCommandReceipts: receipts };
    }
  }
  merge("cities");
  merge("clans");
  return next;
}

export type WildsAtlasSourceProjection = Readonly<{ buildings: WildsWorldProjection; civics: WildsWorldProjection }>;

export function withoutUnqualifiedCivicWorld(projection: WildsWorldProjection): WildsWorldProjection {
  const receipts = Object.entries(projection.constitutionalCommandReceipts ?? {});
  const filtered = receipts.filter(([, receipt]) => !isWildsCivicCommand(receipt));
  if (!Object.hasOwn(projection, "cities") && !Object.hasOwn(projection, "clans") && filtered.length === receipts.length) return projection;
  const { cities: _cities, clans: _clans, ...world } = projection;
  if (filtered.length !== receipts.length) world.constitutionalCommandReceipts = Object.fromEntries(filtered);
  return world;
}

const foundationFields = ["structures", "constructionSites", "constructionConditions", "materialLots", "materialCustody",
  "consumedMaterialLots", "constructionCommandReceipts"] as const;

export function mergeWildsAtlasSource(held: WildsWorldProjection, verified: WildsAtlasSourceProjection) {
  const { buildings, civics } = verified;
  if (!Object.keys(buildings.structures).length && !Object.keys(buildings.constructionSites).length
    && !Object.keys(buildings.constructionProjects).length && !Object.keys(buildings.creations ?? {}).length) return mergeWildsAtlasCivic(held, civics);

  const candidate = { ...held,
    ...mergeWildsConstructionPersistence(held, buildings),
    ...mergeWorldCreationSourceRows(held, buildings)
  };
  for (const field of foundationFields) Object.assign(candidate, { [field]: { ...buildings[field], ...held[field] } });
  return mergeWildsAtlasCivic(candidate, civics);
}
