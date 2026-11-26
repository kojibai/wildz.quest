import { canonicalizeReceizV122, receizBase64UrlEncode, type ReceizClient } from "@receiz/sdk";
import type { WildsWorldEvent } from "../../features/play/wilds-world-event";
import { initialWildsWorldProjection, type WildsWorldProjection } from "../../features/play/wilds-world-state";
import { decodeWildsResourceEventV128 } from "./wilds-resource-event-codec-v128";
import { reduceWildsOpenedResourceEventV128 } from "./wilds-resource-exchange-v128";
import { initialWildsResourceJournalV128, replayWildsResourceJournalOwnerV128, WILDS_RESOURCE_DOMAIN_V128,
  WILDS_RESOURCE_GENESIS_HEAD_V128, WILDS_RESOURCE_LAW_V128, WILDS_RESOURCE_NAMESPACE_V128, WILDS_RESOURCE_REDUCER_DIGEST_V128,
  WILDS_RESOURCE_REGISTRY_DIGEST_V128, type WildsResourceJournalEventV128, type WildsResourceJournalV128 } from "./wilds-resource-journal-v128";
import { readWildsAtlasReplayJson, type WildsAtlasReplaySource } from "./wilds-atlas-replay-source";

export const wildsAtlasResourceCoordinates = {
  domainId: WILDS_RESOURCE_DOMAIN_V128, expectedRegistryDigest: WILDS_RESOURCE_REGISTRY_DIGEST_V128,
  expectedReducerDigest: WILDS_RESOURCE_REDUCER_DIGEST_V128
};

const resourceLawBytes = receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(WILDS_RESOURCE_LAW_V128)));
const buildingFields = [
  "structures", "constructionSites", "constructionComponents", "constructionProjects", "constructionChunks",
  "constructionMaterialContributions", "constructionWorkContributions", "constructionConditions",
  "creations", "creationEvents", "materialLots", "materialCustody", "consumedMaterialLots"
] as const;

export function createWildsAtlasResourceProjection() {
  let state = initialWildsResourceJournalV128();
  let count = 0, head = WILDS_RESOURCE_GENESIS_HEAD_V128;
  let projection = initialWildsWorldProjection();
  const states = new Map<string, WildsResourceJournalV128>();
  const owners = new Map<string, { trace: WildsResourceJournalV128["traces"][string]; world: WildsWorldProjection; events: Readonly<Record<string, readonly WildsWorldEvent[]>> }>();
  const events: { event: WildsResourceJournalEventV128; appendId: string; head: string; kaiUPulse: number; sealKai: string }[] = [];

  return {
    async advance(sdk: ReceizClient, sources: readonly WildsAtlasReplaySource[]) {
      if (sources.length === count && owners.size === Object.keys(state.traces).length) return projection;
      for (const source of sources.slice(count)) {
        const { replay } = source;
        const addition = replay.additions[0];
        if (!addition || replay.additions.length !== 1 || source.head.genesisHead !== WILDS_RESOURCE_GENESIS_HEAD_V128
          || replay.priorHead !== head || replay.domainId !== WILDS_RESOURCE_DOMAIN_V128
          || replay.registryDigest !== WILDS_RESOURCE_REGISTRY_DIGEST_V128 || replay.reducerDigest !== WILDS_RESOURCE_REDUCER_DIGEST_V128
          || replay.namespace.name !== WILDS_RESOURCE_NAMESPACE_V128 || replay.namespace.head !== WILDS_RESOURCE_REGISTRY_DIGEST_V128
          || replay.namespace.exactBytesB64u !== resourceLawBytes) throw Error("wilds_atlas_resource_source_invalid");
        const event = await decodeWildsResourceEventV128(readWildsAtlasReplayJson(addition.exactEventBytesB64u)) as WildsResourceJournalEventV128;
        const next = await reduceWildsOpenedResourceEventV128(sdk, state, events, { event, sealKai: String(source.artifactKaiPulse),
          sourceOwner: source.sourceAuthority.ownerReceizId, sourceKeyId: source.authoringEvidence.identity.keyId, previousHead: head });
        state = next.state; head = replay.head; count++;
        events.push({ event, appendId: addition.appendId, head, kaiUPulse: source.journalAppends[0]!.acceptedAtKaiUPulse, sealKai: next.sealKai });
        states.set(head, state);
      }
      if (owners.size && [...owners].every(([owner, prior]) => state.traces[owner] === prior.trace)
        && owners.size === Object.keys(state.traces).length) return projection;
      const nextWorld = initialWildsWorldProjection();
      for (const [owner, trace] of Object.entries(state.traces)) {
        const previous = owners.get(owner);
        let projected = previous;
        if (!projected || projected.trace !== trace) {
          const replay = await replayWildsResourceJournalOwnerV128(state, owner, trace.gameplayOwnerId, trace.commands);
          projected = { trace, world: replay.world, events: replay.eventsByCommand };
          owners.set(owner, projected);
        }
        for (const field of buildingFields) Object.assign(nextWorld, { [field]: { ...nextWorld[field], ...projected.world[field] } });
      }
      projection = nextWorld;
      return projection;
    },
    currentHead: () => head,
    eventsFor: (owner: string, commandId: string) => owners.get(owner)?.events[commandId],
    async foundingWorld(at: string, owner: string) {
      const snapshot = states.get(at);
      const trace = snapshot?.traces[owner];
      if (!snapshot || !trace) throw Error("wilds_atlas_foundation_source_missing");
      return (await replayWildsResourceJournalOwnerV128(snapshot, owner, trace.gameplayOwnerId, trace.commands)).world;
    }
  };
}
