import { canonicalizeReceizV122, createReceizClient, receizBase64UrlEncode, type ReceizClient } from "@receiz/sdk";
import { applyWildsAtlasCivicEvent, type WildsAtlasSourceProjection } from "../../features/play/wilds-atlas-receiz-projection";
import { WILDS_CITY_RULES_DIGEST, WILDS_CLAN_RULES_DIGEST } from "../../features/play/wilds-city";
import { isWildsCivicCommand } from "../../features/play/wilds-civic-command";
import { canonicalPortableCardJson, sha256PortableBasis } from "../../features/play/portable-card";
import type { WildsWorldEvent } from "../../features/play/wilds-world-event";
import { verifyWildsWorldAdmittedSource, type WildsWorldOutboxEntry } from "../../features/play/wilds-world-outbox";
import { initialWildsWorldProjection } from "../../features/play/wilds-world-state";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import type { openWildsResourcePackageExchangeBrowserV128 } from "./wilds-resource-exchange-browser-v128";
import { createWildsResourceSourceClientV128, createWildsResourceSourceRecoveryStoreV128 } from "./wilds-resource-source-client-v128";
import { createWildsAtlasReplayReader, readWildsAtlasReplayJson, wildsAtlasReplayPredecessor, type WildsAtlasReplaySource } from "./wilds-atlas-replay-source";
import { createWildsAtlasResourceProjection, wildsAtlasResourceCoordinates } from "./wilds-atlas-resource-replay";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

const law = Object.freeze({ schema: "wildz.atlas.civic-law.v1", city: WILDS_CITY_RULES_DIGEST, clan: WILDS_CLAN_RULES_DIGEST,
  origin: "exact-wilds-world-event", foundation: "exact-resource-replay-head", advancement: "existing-civic-reducer" });
const digest = (value: unknown) => sha256PortableBasis(canonicalPortableCardJson(value)).slice(7);
const namespace = { namespace: law, namespaceName: "wildz.atlas.civics", namespaceHead: digest(law) };
const namespaceBytes = receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(law)));
export const wildsAtlasCivicCoordinates = { domainId: "world:wildz:atlas:civics:v1", expectedRegistryDigest: namespace.namespaceHead,
  expectedReducerDigest: digest({ law, version: 1 }) };
const genesis = digest({ law, domainId: wildsAtlasCivicCoordinates.domainId });
type CivicEvent = Readonly<{ schema: "wildz.atlas.civic-event.v1"; event: WildsWorldEvent; foundationHead: string | null }>;
export type WildsAtlasSourceRuntime = Awaited<ReturnType<typeof openWildsResourcePackageExchangeBrowserV128>>;

function readCivicSource(source: WildsAtlasReplaySource) {
  const { replay, head } = source;
  const addition = replay.additions[0];
  if (!addition || replay.additions.length !== 1 || head.genesisHead !== genesis || replay.domainId !== wildsAtlasCivicCoordinates.domainId
    || replay.namespace.name !== namespace.namespaceName || replay.namespace.head !== namespace.namespaceHead
    || replay.namespace.exactBytesB64u !== namespaceBytes) throw Error("wilds_atlas_civic_source_invalid");
  const entry = readWildsAtlasReplayJson(addition.exactEventBytesB64u) as CivicEvent;
  const payload = entry?.event?.payload as { command?: { type?: string } } | undefined;
  if (!entry || Object.keys(entry).sort().join() !== "event,foundationHead,schema" || entry.schema !== "wildz.atlas.civic-event.v1"
    || addition.appendId !== `wildz:atlas:${entry.event?.eventId}` || !Number.isSafeInteger(entry.event.uPulse)
    || BigInt(entry.event.uPulse) >= (BigInt(source.artifactKaiPulse) + 1n) * 1_000_000n
    || (payload?.command?.type === "city.found" ? typeof entry.foundationHead !== "string" || !/^[a-f0-9]{64}$/.test(entry.foundationHead) : entry.foundationHead !== null))
    throw Error("wilds_atlas_civic_source_invalid");
  return entry;
}

export function createWildsAtlasSource(input: Readonly<{ applicationId: string; database: WildzContinuityDatabase }>) {
  const { applicationId, database } = input;
  const civic = createWildsAtlasReplayReader({ database, domain: { applicationId, ...wildsAtlasCivicCoordinates } });
  const resources = createWildsAtlasReplayReader({ database, domain: { applicationId, ...wildsAtlasResourceCoordinates } });
  const construction = createWildsAtlasResourceProjection();
  const offline = createReceizClient({ applicationId, fetchImpl: async () => { throw Error("wilds_atlas_external_read_unavailable"); } });
  let projection: WildsAtlasSourceProjection = { buildings: initialWildsWorldProjection(), civics: initialWildsWorldProjection() };
  let applied = 0;
  let operation = Promise.resolve();
  function run<T>(fn: () => Promise<T>) {
    const next = operation.then(fn);
    operation = next.then(() => undefined, () => undefined);
    return next;
  }

  async function project(sdk: ReceizClient) {
    const buildings = await construction.advance(sdk, await resources.readHeld());
    const sources = await civic.readHeld();
    let civics = projection.civics;
    for (const source of sources.slice(applied)) {
      // The native append orders distribution. Wildz still admits the exact
      // civic delta and preserves invalid or conflicting Originals in custody.
      let value: CivicEvent;
      try { value = readCivicSource(source); } catch { applied++; continue; }
      let context = civics;
      if (value.foundationHead) {
        try {
          const foundation = await construction.foundingWorld(value.foundationHead, source.sourceAuthority.ownerReceizId);
          context = { ...foundation, cities: civics.cities, clans: civics.clans, constitutionalCommandReceipts: civics.constitutionalCommandReceipts };
        } catch { break; }
      }
      try {
        const advanced = applyWildsAtlasCivicEvent(context, value.event, source.sourceAuthority.ownerReceizId);
        civics = { ...civics, cities: advanced.cities, clans: advanced.clans, constitutionalCommandReceipts: advanced.constitutionalCommandReceipts };
      } catch { /* Invalid gameplay evidence is retained without projecting authority. */ }
      applied++;
    }
    if (buildings !== projection.buildings || civics !== projection.civics) projection = { buildings, civics };
    return projection;
  }

  function currentRuntime(runtime: WildsAtlasSourceRuntime) {
    if (runtime.applicationId !== applicationId) throw Error("wilds_atlas_application_mismatch");
    return runtime;
  }

  async function refresh(runtime: WildsAtlasSourceRuntime) {
    const { sdk, ownerReceizId } = currentRuntime(runtime);
    await Promise.allSettled([resources.refresh(sdk, ownerReceizId), civic.refresh(sdk, ownerReceizId)]);
    return project(sdk);
  }

  return {
    restore: () => run(() => project(offline)),
    refresh: (runtime: WildsAtlasSourceRuntime) => run(() => refresh(runtime)),
    observeBuilding: (entry: WildsWorldOutboxEntry, runtime: WildsAtlasSourceRuntime) => run(async () => {
      const { ownerReceizId } = currentRuntime(runtime);
      if (!sameWildzPlayerCoordinate(entry.actorId, ownerReceizId)) throw Error("wilds_atlas_event_actor_mismatch");
      verifyWildsWorldAdmittedSource(entry);
      const observed = await refresh(runtime);
      const sealedEvents = construction.eventsFor(ownerReceizId, entry.command.commandId);
      if (!sealedEvents || canonicalPortableCardJson(sealedEvents) !== canonicalPortableCardJson(entry.admittedSource!.events))
        throw Error("wilds_atlas_building_source_pending");
      return observed;
    }),
    publish: (entry: WildsWorldOutboxEntry, runtime: WildsAtlasSourceRuntime) => run(async () => {
      const { sdk, ownerReceizId, sourceAuthor, session } = currentRuntime(runtime);
      if (!isWildsCivicCommand(entry.command) || !sameWildzPlayerCoordinate(entry.actorId, ownerReceizId)) throw Error("wilds_atlas_event_actor_mismatch");
      verifyWildsWorldAdmittedSource(entry);
      const event = entry.admittedSource!.events[0]!;
      await resources.refresh(sdk, ownerReceizId).catch(() => undefined);
      try { await civic.refresh(sdk, ownerReceizId); } catch (cause) {
        // A first append can compare against native genesis. A later attempt
        // must recover the known sealed predecessor.
        const failure = cause as { status?: number; payload?: { code?: string } } | null;
        if ((await civic.readHeld()).length || failure?.status !== 503 || failure.payload?.code !== "SERVICE_CAPACITY_UNAVAILABLE") throw cause;
      }
      await project(sdk);
      const original = (await civic.readHeld()).find(source => source.replay.additions.some(addition => addition.appendId === `wildz:atlas:${event.eventId}`));
      if (original) {
        if (readCivicSource(original).event.digest !== event.digest || !sameWildzPlayerCoordinate(original.sourceAuthority.ownerReceizId, entry.actorId)
          || !projection.civics.constitutionalCommandReceipts?.[event.causeId]?.eventIds.includes(event.eventId)) throw Error("wilds_atlas_shared_source_conflict");
        return projection;
      }
      const latest = await civic.readHeld();
      if (applied !== latest.length) throw Error("wilds_atlas_predecessor_unresolved");
      const attemptId = `atlas:${digest(event)}`;
      const recoveryStore = createWildsResourceSourceRecoveryStoreV128(database);
      const retained = await recoveryStore.read(ownerReceizId, attemptId);
      const previous = retained ? readWildsAtlasReplayJson(retained.preparation.replay.additions[0]!.exactEventBytesB64u) as CivicEvent : null;
      if (previous && (previous.schema !== "wildz.atlas.civic-event.v1" || canonicalPortableCardJson(previous.event) !== canonicalPortableCardJson(event)))
        throw Error("wilds_atlas_attempt_conflict");
      const foundationHead = previous ? previous.foundationHead : entry.command.type === "city.found" ? construction.currentHead() : null;
      const structure = foundationHead ? await construction.foundingWorld(foundationHead, ownerReceizId) : undefined;
      applyWildsAtlasCivicEvent({ ...projection.civics, ...(structure ? {
        ...structure, cities: projection.civics.cities, clans: projection.civics.clans, constitutionalCommandReceipts: projection.civics.constitutionalCommandReceipts
      } : {}) }, event, ownerReceizId);
      const publisher = createWildsResourceSourceClientV128({ sdk, authority: sourceAuthor, session, recoveryStore });
      const value: CivicEvent = { schema: "wildz.atlas.civic-event.v1", event, foundationHead };
      const result = await publisher.publish({ attemptId, page: {
        domainId: wildsAtlasCivicCoordinates.domainId, registryDigest: wildsAtlasCivicCoordinates.expectedRegistryDigest, reducerDigest: wildsAtlasCivicCoordinates.expectedReducerDigest,
        genesisHead: genesis, predecessor: wildsAtlasReplayPredecessor(latest), appendId: `wildz:atlas:${event.eventId}`, event: value, ...namespace
      } });
      if (result.status !== "published") throw new Error("wilds_atlas_publication_pending", { cause: new Error(result.message) });
      // After a native acknowledgement only exact independently opened
      // Originals count. Losing the subsequent empty tail keeps that page.
      await civic.refresh(sdk, ownerReceizId).catch(() => undefined);
      const observed = await project(sdk);
      if (!observed.civics.constitutionalCommandReceipts?.[event.causeId]?.eventIds.includes(event.eventId)) throw Error("wilds_atlas_publication_unconfirmed");
      return observed;
    })
  };
}
