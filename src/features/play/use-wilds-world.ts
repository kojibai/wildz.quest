"use client";
import { prepareReceivedWildsWorldProofs } from "./wilds-received-proof-immutability";
import { emitWildsPlaytestDuration } from "./wilds-playtest-events";
import { createWildsWorldRefreshCoordinator } from "./wilds-world-refresh-coordinator";
import type { WildsBurrowRequest } from "./wilds-burrow";
import { settleWildsBuild } from "./wilds-steward-build-settlement";
import { playerStewardBuilder } from "./wilds-steward-construction";
import type { WildsActivityEntry } from "./wallet/wilds-activity-history";
import { projectWildsStoryActivity } from "./wilds-story-activity";
import { resolveWildsCraftWorkstation } from "./wilds-construction-function";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import type { WildsWorldCommand } from "./wilds-world-service";
import { WILDS_WORLD_ID, type WildsWorldEvent } from "./wilds-world-event";
import { initialWildsWorldProjection, wildsMaterialCustodian, type WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldSnapshot } from "./wilds-world-record";
import type { WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsGameplayVerb } from "./wilds-saga-types";
import type { WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";
import type { WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import { admitWildsEmission, previewWildsEmission, type WildsWorldEmissionProofV1 } from "./wilds-world-emission";
import type { WildsResourceLotV1 } from "./wilds-resource-lot";
import type { WildsResourceSource } from "./wilds-resource-authority";
import type { WildsCreatureMandateV1 } from "./wilds-creature-mandate";
import { completeWildsConstructionSite, contributeWildsConstructionSite, createWildsConstructionSite, type WildsConstructionBlueprint } from "./wilds-construction-site";
import {
  createWildsMaterialHarvest,
  createWildsStewardHarvestOperation,
  createWildsStewardPhiAward,
  createWildsStewardStructureOperation,
  createWildsStewardTool,
  createWildsStewardToolOperation,
  createWildsTrailCache,
  createWildsTrailBridge,
  createWildsTrailShelter,
  createWildsWorkstation,
  wildsMaterialContributorReceizIds,
  type WildsStewardToolKind
} from "./wilds-steward-construction";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { isWildsEdgeImmediateConstructionCommand, worldCommandRequiresCard } from "./wilds-world-authority";
import { withWildsWorldCommandKai, verifyWildsWorldCommandKai } from "./wilds-world-authority";
import { deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "./kai-klok-moment";
import { createKaiTemporalRoot } from "./kai-temporal-root";
import { publishActiveWildsWorldWithIdentityProof } from "@/lib/receiz/wilds-world-identity-publication";
import {
  createWildsWorldEdgeAdmissionQueue,
  preserveWildsConstructionHistory,
  prepareWildsWorldOutboxPublication,
  bindWildsCrewOutboxIdentity,
  reconcileWildsWorldOutboxProjection,
  type WildsWorldOutboxEntry
} from "./wilds-world-outbox";
import { createWildsSessionRestore } from "./wilds-session-restore";
import { projectWildsWorldOutboxAsync, prepareAndPersistWildsWorldOutboxEntryAsync, prepareWildsWorldOutboxEntryAsync, restoreWildsWorldEdgeSource, acknowledgeWildsWorldCommand, acknowledgeWildsWorldPublication, persistWildsWorldCommand, readWildsWorldOutbox } from "./wilds-world-work-client";
import {
  shouldAttemptWildsNetwork,
  isOpaqueWildsNetworkFailure,
  WILDS_NETWORK_RETRY_BACKOFF_MS,
  WILDS_WORLD_OFFLINE_MESSAGE,
  wildsNetworkFailureMessage
} from "./wilds-network-status";
import { createWildsSourceAuthorityProjection, planWildsMaterialHarvest, replanQueuedWildsMaterialHarvest } from "./wilds-source-work-authority";
import { wildsWorldSourceEmission } from "./wilds-world-genesis";
import type { WildsOwnedWorldAdditions } from "./game-state";
import { mergeWildsOwnedWorldAdditions } from "./wilds-player-world-additions";
import { preserveWildsResourcePackageHistory } from "./wilds-resource-package-continuity";
import { mergeWildsNativeWorldHistory, wildsWorldCommandSource, wildsWorldGroveSource } from "./wilds-native-world-command-source";

import { publishWildsConstructionEntry } from "./wilds-construction-publication";
import type { WildsBlueprintPlacement } from "./wilds-world-construction";
import type { WildsConstructionPlacementRequest } from "./wilds-construction-placement";

export function acceptWildsWorldSnapshot(current: WildsWorldProjection | null, candidate: WildsWorldProjection, owned?: WildsOwnedWorldAdditions) {
  const started = performance.now();
  try {
    if (owned) candidate = mergeWildsOwnedWorldAdditions(candidate, owned);
    if (current && candidate.revision < current.revision) return current;
    return current ? preserveWildsResourcePackageHistory(current, preserveWildsConstructionHistory(current, candidate)) : candidate;
  } finally { emitWildsPlaytestDuration('world-adopt', performance.now() - started); }
}

/** Retain the visible historical inventory when switching to a new native
 * authority head. This display merge is never sent to the native source API. */
export function displayWildsNativeWorldSnapshot(current: WildsWorldProjection | null, candidate: WildsWorldProjection, owned?: WildsOwnedWorldAdditions) {
  const admitted = acceptWildsWorldSnapshot(null, candidate, owned);
  const historical = current ? mergeWildsNativeWorldHistory(current, admitted) : admitted;
  return mergeWildsNativeWorldHistory(historical, candidate);
}

export function buildWildsWorldCommandBody(
  guestId: string,
  command: WildsWorldCommand,
  card?: PortableCardAsset,
  cardAdmission?: WildzVaultCardMembershipProof | null
) {
  return card
    ? { guestId, command, card, ...(cardAdmission ? { cardAdmission } : {}) }
    : { guestId, command };
}

function validWildsWorldProjection(projection: WildsWorldProjection | undefined) {
  return projection?.schema === "receiz.wilds_world_projection.v3"
    && projection.worldId === WILDS_WORLD_ID
    && Number.isSafeInteger(projection.revision)
    && projection.revision >= 0;
}

export function parseWildsWorldSnapshotResponse(value: unknown): WildsWorldSnapshot {
  if (!value || typeof value !== "object") throw new Error("wilds_world_snapshot_invalid");
  const response = value as Record<string, unknown>;
  const projection = response.projection as WildsWorldProjection | undefined;
  const mode = response.mode;
  if (response.ok !== true || !validWildsWorldProjection(projection) || (mode !== "receiz_live" && mode !== "kai_live" && mode !== "local_practice")) {
    throw new Error("wilds_world_snapshot_invalid");
  }
  return { projection: projection!, mode };
}

export type WildsWorldClientMode = "connecting" | "receiz_live" | "kai_live" | "local_practice" | "receiz_recovery_pending" | "reconnecting";
export type WildsWorldCommandMode = Extract<WildsWorldClientMode, "receiz_live" | "kai_live" | "local_practice" | "receiz_recovery_pending">;

export function wildsWorldModeAfterRequestFailure(
  offline: boolean,
  currentMode: WildsWorldClientMode
): WildsWorldClientMode {
  if (offline) return "receiz_recovery_pending";
  return currentMode === "receiz_live" || currentMode === "kai_live" ? currentMode : "reconnecting";
}

export function wildsWorldModeAfterConfirmedBootstrap(mode: WildsWorldClientMode): WildsWorldClientMode {
  return mode === "connecting" ? "kai_live" : mode;
}

export function shouldQueueWildsWorldCommandLocally(input: Readonly<{
  commandPending: boolean;
  networkEnabled: boolean;
  networkAvailable: boolean;
  canonicalAvailable: boolean;
}>) {
  return input.commandPending || !input.networkEnabled || !input.networkAvailable || !input.canonicalAvailable;
}

export function shouldSynchronizeWildsWorldCommandAfterPaint(command: Pick<WildsWorldCommand, "type">) {
  return command.type === "resource.material.harvest" || isWildsEdgeImmediateConstructionCommand(command);
}

export function scheduleWildsWorldBackgroundSync(task: () => void) {
  if (typeof window === "undefined") {
    queueMicrotask(task);
    return;
  }
  window.requestAnimationFrame(() => window.setTimeout(task, 0));
}

export function parseWildsWorldCommandResponse(value: unknown): { projection: WildsWorldProjection; mode: WildsWorldCommandMode } {
  if (!value || typeof value !== "object") throw new Error("wilds_world_command_response_invalid");
  const response = value as Record<string, unknown>;
  const projection = response.projection as WildsWorldProjection | undefined;
  const mode = response.mode;
  if (response.ok !== true || !validWildsWorldProjection(projection) || (mode !== "receiz_live" && mode !== "kai_live" && mode !== "local_practice" && mode !== "receiz_recovery_pending")) {
    throw new Error("wilds_world_command_response_invalid");
  }
  return { projection: projection!, mode };
}

/** Run the refresh transaction independently of React's presentation state. */
export async function refreshWildsWorldClient(input: {
  current: () => WildsWorldProjection;
  currentMode: () => WildsWorldClientMode;
  networkAvailable: () => boolean;
  readPending: () => Promise<WildsWorldOutboxEntry[]>;
  requestSnapshot: () => Promise<WildsWorldSnapshot>;
  adopt: (projection: WildsWorldProjection) => WildsWorldProjection;
  flush: (projection: WildsWorldProjection, mode: WildsWorldCommandMode) => Promise<{ projection: WildsWorldProjection; mode: WildsWorldClientMode }>;
}): Promise<{ projection?: WildsWorldProjection; mode: WildsWorldClientMode; error: string; retryAfter?: number } | null> {
  if (!input.networkAvailable()) {
    return { mode: "receiz_recovery_pending", error: WILDS_WORLD_OFFLINE_MESSAGE };
  }
  try {
    const pending = await input.readPending();
    if (pending.some((entry) => isWildsEdgeImmediateConstructionCommand(entry.command))) await input.flush(input.current(), "receiz_live");
    const snapshot = await input.requestSnapshot();
    const projection = input.adopt(snapshot.projection);
    const flushed = await input.flush(projection, snapshot.mode);
    const remaining = await input.readPending();
    return {
      projection: flushed.projection,
      mode: remaining.length ? "receiz_recovery_pending" : flushed.mode,
      error: remaining.length ? "Your work is admitted here and will keep syncing globally in the background." : "",
      retryAfter: 0
    };
  } catch (cause) {
    if ((cause as Error).name === "AbortError") return null;
    const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
    const offline = !input.networkAvailable() || opaqueFailure;
    return {
      mode: wildsWorldModeAfterRequestFailure(offline, input.currentMode()),
      error: wildsNetworkFailureMessage(cause, "world", !offline),
      ...(opaqueFailure ? { retryAfter: Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS } : {})
    };
  }
}

/** Present an available bootstrap immediately through the normal admission
 * boundary. Account recovery continues independently, preserving its history. */
export async function startWildsWorldClient(input: {
  initialProjection?: WildsWorldProjection | null;
  cancelled: () => boolean;
  adopt: (projection: WildsWorldProjection) => WildsWorldProjection;
  current: () => WildsWorldProjection;
  publish: (projection: WildsWorldProjection) => void;
  restore: () => Promise<unknown>;
  refresh?: () => Promise<unknown>;
}) {
  if (input.cancelled()) return;
  if (input.initialProjection && validWildsWorldProjection(input.initialProjection)) {
    input.publish(input.adopt(input.initialProjection));
  }
  await input.restore();
  if (input.cancelled()) return;
  input.publish(input.current());
  await input.refresh?.();
}

export function useWildsWorld(input: {
  onActivity?: (activity: WildsActivityEntry) => void;
  enabled: boolean;
  networkEnabled: boolean;
  nativeSourceEnabled?: boolean;
  onNativeReplay?: (replay: Readonly<Record<string, unknown>>) => void;
  actorId: string;
  guestId: string;
  kaiUPulse: number;
  activeCard: PortableCardAsset | null;
  cardAdmission: WildzVaultCardMembershipProof | null;
  initialSnapshot?: { projection: WildsWorldProjection; mode: "receiz_live" | "kai_live" } | null;
  ownedWorldAdditions?: WildsOwnedWorldAdditions;
  authorizeLivingWorld?: (input: Readonly<{
    operationId: string;
    planDigest: string;
    semanticIdempotencyKey: string;
    amountPhiMicro: string;
  }>) => Promise<unknown>;
}) {
  const activityListener = useRef(input.onActivity);
  activityListener.current = input.onActivity;
  const nativeReplayListener = useRef(input.onNativeReplay);
  nativeReplayListener.current = input.onNativeReplay;
  const ownedWorldAdditions = useRef(input.ownedWorldAdditions);
  ownedWorldAdditions.current = input.ownedWorldAdditions;
  const [snapshot, setSnapshot] = useState<WildsWorldProjection | null>(() => mergeWildsOwnedWorldAdditions(
    input.initialSnapshot?.projection ?? createWildsSourceAuthorityProjection(),
    input.ownedWorldAdditions ?? { constructionSites: {}, structures: {}, harvestedSources: {}, materialLots: {}, materialCustody: {}, consumedMaterialLots: {}, reservedMaterialLots: {}, storedMaterialLots: {} }
  ));
  const nativeAuthorityActive = useRef(false);
  const nativeProjection = useRef<WildsWorldProjection | null>(null);
  const legacyProjection = useRef<WildsWorldProjection | null>(snapshot);
  const [mode, setMode] = useState<WildsWorldClientMode>(() => input.initialSnapshot?.mode ?? "connecting");
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const [error, setError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const commandPending = useRef(false);
  const canonicalSnapshot = useRef<WildsWorldProjection | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const clientActive = useRef(true);
  const retryAfter = useRef(0);
  const authorizeLivingWorld = input.authorizeLivingWorld;
  const edge = useRef<{ actorId: string; queue: ReturnType<typeof createWildsWorldEdgeAdmissionQueue>; refresh: ReturnType<typeof createWildsWorldRefreshCoordinator> } | null>(null);
  if (!edge.current || edge.current.actorId !== input.actorId) {
    edge.current = { actorId: input.actorId, refresh: createWildsWorldRefreshCoordinator(), queue: createWildsWorldEdgeAdmissionQueue({
      initialProjection: snapshot ?? createWildsSourceAuthorityProjection(),
      prepare: prepareWildsWorldOutboxEntryAsync,
      prepareAndPersist: prepareAndPersistWildsWorldOutboxEntryAsync,
      persist: async (entry) => {
        try { await persistWildsWorldCommand(entry); }
        catch (cause) { throw new Error("wilds_world_local_persistence_failed", { cause }); }
      },
      onAdmitted: (projection, entry, events, constitution) => {
        if (!nativeAuthorityActive.current || wildsWorldCommandSource(entry.command, nativeProjection.current, legacyProjection.current) === "legacy") legacyProjection.current = projection;
        canonicalSnapshot.current = projection;
        setSnapshot((current) => nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(current, projection, ownedWorldAdditions.current) : acceptWildsWorldSnapshot(current, projection, ownedWorldAdditions.current));
        for (const event of events) {
          if (event.actorId !== entry.actorId) continue;
          activityListener.current?.(projectWildsStoryActivity(event, constitution));
        }
      }
    }) };
  }
  const edgeQueue = edge.current.queue;
  const adoptSnapshot = useCallback((projection: WildsWorldProjection) => edgeQueue.adopt(
    nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(edgeQueue.current(), projection, ownedWorldAdditions.current)
      : acceptWildsWorldSnapshot(null, projection, ownedWorldAdditions.current)
  ), [edgeQueue]);

  const projectPending = useCallback((base: WildsWorldProjection, entries: WildsWorldOutboxEntry[], adopt = false) => reconcileWildsWorldOutboxProjection({
    base, entries, actorId: input.actorId, current: edgeQueue.current,
    project: projectWildsWorldOutboxAsync, adopt: adopt ? adoptSnapshot : projection => projection,
    cancelled: () => !clientActive.current || edge.current?.queue !== edgeQueue
  }), [adoptSnapshot, edgeQueue, input.actorId]);

  const adoptServerWorld = useCallback((projection: WildsWorldProjection) => {
    if (!validWildsWorldProjection(projection)) throw Error('wilds_world_projection_invalid');
    canonicalSnapshot.current = projection;
    const admitted = adoptSnapshot(projection);
    setSnapshot(current => nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(current, admitted, ownedWorldAdditions.current) : acceptWildsWorldSnapshot(current, admitted, ownedWorldAdditions.current));
    return admitted;
  }, [adoptSnapshot]);


  const restoreSession = useMemo(() => createWildsSessionRestore(async () => {
    const restored = await restoreWildsWorldEdgeSource(edgeQueue.current(), input.actorId);
    if (edge.current?.queue !== edgeQueue) throw new Error("wilds_world_session_changed");
    adoptSnapshot(restored);
  }), [adoptSnapshot, edgeQueue, input.actorId]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const value = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok || !value) {
        const error = new Error(typeof value?.error === "string" ? value.error : "wilds_world_request_failed") as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      await prepareReceivedWildsWorldProofs(value.projection, { cancelled: () => controller.signal.aborted });
      controller.signal.throwIfAborted();
      return value;
    } finally {
      controllers.current.delete(controller);
    }
  }, []);

  const sendEntry = useCallback(async (entry: WildsWorldOutboxEntry) => {
    if (input.nativeSourceEnabled && nativeAuthorityActive.current && wildsWorldCommandSource(entry.command, nativeProjection.current, legacyProjection.current) === "native") {
      const { createActiveWildsNativeWorldContext, ensureWildsNativeWorldSource, appendWildsNativeWorldSteps, prepareWildsNativeWorldCardSource, wildsNativeWorldProfile } = await import("./wilds-native-world-source-client");
      const context = await createActiveWildsNativeWorldContext({ command: entry.command, card: entry.card ?? null });
      if (wildsNativeWorldProfile(context) !== entry.actorId) throw Error("wilds_native_world_actor_mismatch");
      await ensureWildsNativeWorldSource(context);
      const cardSources = [], cardRecoveryProofs = [];
      const cards = new Map<string, PortableCardAsset>();
      if (entry.card) cards.set(entry.card.id, entry.card);
      if (entry.command.type === "creation.construct" || entry.command.type === "creation.evolve") for (const worker of entry.command.workerSources) cards.set(worker.card.id, worker.card);
      for (const card of cards.values()) {
        const source = await prepareWildsNativeWorldCardSource(card, entry.actorId);
        cardSources.push(source.predecessor);
        if (source.recovery) cardRecoveryProofs.push(source.recovery);
      }
      const kai = verifyWildsWorldCommandKai(entry.command), pulse = kaiUPulseToISOString(kai.uPulse);
      const accepted = await appendWildsNativeWorldSteps({ context, cardSources, cardRecoveryProofs, steps: [{ kind: "command", command: entry.command, authority: { actorId: entry.actorId, canonical: true, pulse, occurredAt: pulse, uPulse: kai.uPulse, ...(entry.card ? { card: entry.card } : {}) } }], idempotencyKey: entry.command.commandId });
      const projection = accepted.record.checkpoint.projection;
      nativeProjection.current = projection;
      await prepareReceivedWildsWorldProofs(projection);
      nativeAuthorityActive.current = true;
      nativeReplayListener.current?.(accepted.replay);
      return { projection, mode: "receiz_live" as const, commandId: entry.command.commandId, globallyPublished: true };
    }
    if ((entry.command.type === "creation.construct" || entry.command.type === "creation.evolve") && entry.command.workerSources.some(source => source.nativeKeeper)) throw Error("wilds_native_world_keeper_source_required");
    if (isWildsEdgeImmediateConstructionCommand(entry.command)) {
      const parsed = await publishWildsConstructionEntry(entry, `${window.location.origin}/api/wilds/world/snapshot`);
      legacyProjection.current = parsed.projection;
      return nativeProjection.current ? { ...parsed, projection: displayWildsNativeWorldSnapshot(parsed.projection, nativeProjection.current, ownedWorldAdditions.current) } : parsed;
    }
    const receizExecution = (entry.command.type === "grove.act"
      || entry.command.type === "resource.material.harvest"
      || entry.command.type === "structure.trail-shelter.build"
      || entry.command.type === "structure.trail-bridge.build"
      || entry.command.type === "structure.steward-workbench.build"
      || entry.command.type === "structure.trail-cache.build"
      || entry.command.type === "construction.site.work"
      || entry.command.type === "tool.steward.craft") && entry.command.operation && entry.command.amountPhiMicro && entry.command.amountPhiMicro !== "0"
      ? await authorizeLivingWorld?.({
          operationId: entry.command.operation.operationId,
          planDigest: entry.command.operation.planDigest,
          semanticIdempotencyKey: entry.command.operation.semanticIdempotencyKey,
          amountPhiMicro: entry.command.amountPhiMicro
        })
      : undefined;
    const value = await request("/api/wilds/world/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        guestId: entry.guestId,
        command: entry.command,
        ...(entry.card ? { card: entry.card } : {}),
        ...(entry.cardAdmission ? { cardAdmission: entry.cardAdmission } : {}),
        ...(receizExecution ? { receizExecution } : {})
      })
    });
    const publication = value.publication as Record<string, unknown> | undefined;
    let globallyPublished = publication?.published === true || value.mode === "local_practice";
    if (publication?.required === "identity_proof" && publication.published === false) {
      await publishActiveWildsWorldWithIdentityProof(publication.draft);
      globallyPublished = true;
    }
    const parsed = parseWildsWorldCommandResponse(value);
    legacyProjection.current = parsed.projection;
    return { ...parsed, projection: nativeProjection.current ? displayWildsNativeWorldSnapshot(parsed.projection, nativeProjection.current, ownedWorldAdditions.current) : parsed.projection, commandId: entry.command.commandId, globallyPublished };
  }, [authorizeLivingWorld, request, input.nativeSourceEnabled]);

  const flushOutbox = useCallback(async (base: WildsWorldProjection, initialMode: WildsWorldCommandMode) => {
    if (commandPending.current) {
      const entries = await readWildsWorldOutbox(input.actorId);
      return { projection: await projectPending(base, entries), mode: initialMode as WildsWorldClientMode };
    }
    commandPending.current = true;
    let canonical = base;
    let nextMode: WildsWorldClientMode = initialMode;
    let entries: WildsWorldOutboxEntry[] = [];
    try {
      entries = await readWildsWorldOutbox(input.actorId);
      while (entries.length > 0 && shouldAttemptWildsNetwork()) {
        const queued = entries[0]!;
        const entry = prepareWildsWorldOutboxPublication(queued, command => replanQueuedWildsMaterialHarvest({
          projection: canonical, source: command.source, actorId: input.actorId, actorPosition: command.actorPosition,
          kaiUPulse: command.kai?.uPulse ?? command.operation?.kaiUPulse ?? 0, commandId: command.commandId,
          card: queued.card, mandate: command.mandate, kai: command.kai
        }));
        const parsed = await sendEntry(entry);
        if ("commandId" in parsed && parsed.commandId !== queued.command.commandId) throw new Error("wilds_world_published_head_mismatch");
        canonical = nativeAuthorityActive.current ? parsed.projection : acceptWildsWorldSnapshot(edgeQueue.current(), parsed.projection);
        nextMode = parsed.mode;
        if (!parsed.globallyPublished) break;
        entries = await acknowledgeWildsWorldCommand(input.actorId, queued.command.commandId);
      }
    } finally {
      commandPending.current = false;
    }
    canonical = await projectPending(canonical, entries, true);
    canonicalSnapshot.current = canonical;
    return { projection: canonical, mode: nextMode };
  }, [edgeQueue, input.actorId, projectPending, sendEntry]);

  const refreshCoordinator = edge.current.refresh;
  useEffect(() => () => refreshCoordinator.cancelPending(), [refreshCoordinator]);
  const refresh = useCallback(() => refreshCoordinator.run(async () => {
    if (!input.enabled || !input.networkEnabled) return;
    if (shouldAttemptWildsNetwork() && Date.now() < retryAfter.current) return;
    const result = await refreshWildsWorldClient({
      current: edgeQueue.current,
      currentMode: () => currentMode.current,
      networkAvailable: shouldAttemptWildsNetwork,
      readPending: () => readWildsWorldOutbox(input.actorId),
      requestSnapshot: async () => {
        if (!input.nativeSourceEnabled) return parseWildsWorldSnapshotResponse(await request("/api/wilds/world/snapshot"));
        const { createWildsWalletNativeSdkClient } = await import("./wallet/wilds-wallet-native-sdk-client");
        const { createActiveWildsNativeWorldContext, ensureWildsNativeWorldSource, nativeWorldRecord } = await import("./wilds-native-world-source-client");
        const read = await createWildsWalletNativeSdkClient().nativeWorld.readLatest();
        const accepted = read ? { record: nativeWorldRecord(read), replay: read.replay } : await ensureWildsNativeWorldSource(await createActiveWildsNativeWorldContext({ action: "initialize-native-world" }));
        const projection = accepted.record.checkpoint.projection;
        nativeProjection.current = projection;
        await prepareReceivedWildsWorldProofs(projection);
        nativeAuthorityActive.current = true;
        nativeReplayListener.current?.(accepted.replay);
        return { projection, mode: "receiz_live" as const };
      },
      adopt: adoptSnapshot,
      flush: flushOutbox
    });
    if (!result) return;
    if (result.projection) {
      canonicalSnapshot.current = result.projection;
      setSnapshot((current) => nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(current, result.projection!, ownedWorldAdditions.current) : acceptWildsWorldSnapshot(current, result.projection!, ownedWorldAdditions.current));
    }
    setMode(result.mode);
    setError(result.error);
    if (result.retryAfter !== undefined) retryAfter.current = result.retryAfter;
  }), [adoptSnapshot, edgeQueue, flushOutbox, input.actorId, input.enabled, input.networkEnabled, input.nativeSourceEnabled, request, refreshCoordinator]);

  useEffect(() => {
    if (input.enabled) setMode(wildsWorldModeAfterConfirmedBootstrap);
  }, [input.enabled]);

  useEffect(() => {
    if (!input.enabled) return;
    let cancelled = false;
    void startWildsWorldClient({
      initialProjection: input.initialSnapshot?.projection,
      cancelled: () => cancelled,
      adopt: adoptSnapshot,
      current: edgeQueue.current,
      restore: restoreSession,
      publish: (admitted) => {
        canonicalSnapshot.current = admitted;
        setSnapshot((current) => nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(current, admitted, ownedWorldAdditions.current) : acceptWildsWorldSnapshot(current, admitted, ownedWorldAdditions.current));
      },
      ...(input.networkEnabled ? { refresh } : {})
    })
      .catch((cause) => {
        if (cancelled || (cause as Error).name === "AbortError") return;
        setMode("receiz_recovery_pending");
        setError(wildsNetworkFailureMessage(cause, "world"));
      });
    return () => { cancelled = true; };
  }, [adoptSnapshot, edgeQueue, input.actorId, input.enabled, input.networkEnabled, input.initialSnapshot, refresh, restoreSession]);

  useEffect(() => {
    clientActive.current = true;
    const activeControllers = controllers.current;
    return () => {
      clientActive.current = false;
      for (const controller of activeControllers) controller.abort();
      activeControllers.clear();
    };
  }, []);

  const post = useCallback(async (
    command: WildsWorldCommand,
    authority?: Readonly<{ card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof | null }> | null,
    crewAdmission?:Readonly<{beforeAdmit(entry:WildsWorldOutboxEntry):Promise<void>;onAdmitted(projection:WildsWorldProjection,events:readonly WildsWorldEvent[]):void}>
  ) => {
    if (!input.enabled) throw new Error("wilds_world_session_required");
    const kaiAuthority = mode === "receiz_live" || mode === "kai_live" ? "world" : "local";
    const rootedCommand = crewAdmission && command.type !== "creation.construct" && command.type !== "creation.evolve" ? withWildsWorldCommandKai(command,verifyWildsWorldCommandKai(command)) : withWildsWorldCommandKai(command, createKaiTemporalRoot(
      deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: kaiAuthority })
    ));
    const authorityCard = authority === null ? null : authority?.card ?? input.activeCard;
    const authorityCardAdmission = authority === null ? null : authority?.cardAdmission ?? input.cardAdmission;
    const unboundEntry: WildsWorldOutboxEntry = {
      schema: "receiz.wilds_world_outbox_entry.v1",
      actorId: input.actorId,
      guestId: input.guestId,
      command: rootedCommand,

      ...((crewAdmission || worldCommandRequiresCard(rootedCommand) || rootedCommand.type === "resource.material.harvest"
        || (input.nativeSourceEnabled && rootedCommand.type === "grove.act" && rootedCommand.operation.participants.some(participant => participant.kind === "creature"))) && authorityCard ? { card: authorityCard } : {}),
      ...(authorityCardAdmission ? { cardAdmission: authorityCardAdmission } : {}),
      queuedAt: new Date().toISOString()
    };
    if(crewAdmission&&!authorityCard&&rootedCommand.type!=="creation.construct"&&rootedCommand.type!=="creation.evolve"&&rootedCommand.type!=="creation.action")throw new Error("wilds_crew_worker_card_required");
    const entry=crewAdmission&&authorityCard?bindWildsCrewOutboxIdentity(unboundEntry,authorityCard):unboundEntry;
    if (nativeAuthorityActive.current) {
      const source = wildsWorldCommandSource(rootedCommand, nativeProjection.current, legacyProjection.current) === "legacy" ? legacyProjection.current : nativeProjection.current;
      if (source) edgeQueue.adopt({ ...edgeQueue.current(), worldEmission: source.worldEmission });
    }
    if (isWildsEdgeImmediateConstructionCommand(rootedCommand)) {
      try {
        await restoreSession();
        const projection = await edgeQueue.admit(entry,crewAdmission);
        setError("");
        scheduleWildsWorldBackgroundSync(() => {
          if (input.networkEnabled) void refresh();
        });
        return projection;
      } catch (cause) {
        setError((cause as Error).message === "wilds_world_local_persistence_failed"
          ? "This change could not be saved on this device. Please try again."
          : "This placement or contribution could not be completed. Check its position and available materials.");
        throw cause;
      }
    }
    const locallyAdmittedProjection = await edgeQueue.admit(entry,crewAdmission);
    const queueForGlobalCommit = async () => {
      setSnapshot((current) => acceptWildsWorldSnapshot(current, locallyAdmittedProjection, ownedWorldAdditions.current));
      setMode("receiz_recovery_pending");
      setError("Your work is admitted here and will keep syncing globally in the background.");
      return locallyAdmittedProjection;
    };
    if (shouldSynchronizeWildsWorldCommandAfterPaint(rootedCommand)) {
      scheduleWildsWorldBackgroundSync(() => {
        void refresh()
          .catch((cause) => {
            setError(wildsNetworkFailureMessage(cause, "world", false));
          });
      });
      return locallyAdmittedProjection;
    }
    if (shouldQueueWildsWorldCommandLocally({
      commandPending: commandPending.current,
      networkEnabled: input.networkEnabled,
      networkAvailable: shouldAttemptWildsNetwork(),
      canonicalAvailable: canonicalSnapshot.current !== null
    })) {
      return queueForGlobalCommit();
    }
    commandPending.current = true;
    setPendingCommand(command.commandId);
    try {
      const parsed = await sendEntry(entry);
      const projection = parsed.projection;
      canonicalSnapshot.current = projection;
      const queued = await acknowledgeWildsWorldPublication(entry, parsed);
      const synchronizedProjection = parsed.globallyPublished
        ? nativeAuthorityActive.current ? projection : acceptWildsWorldSnapshot(locallyAdmittedProjection, projection)
        : await projectPending(projection, queued);
      setSnapshot((current) => nativeAuthorityActive.current ? displayWildsNativeWorldSnapshot(current, synchronizedProjection, ownedWorldAdditions.current) : acceptWildsWorldSnapshot(current, synchronizedProjection, ownedWorldAdditions.current));
      setMode(parsed.globallyPublished ? parsed.mode : "receiz_recovery_pending");
      setError(parsed.globallyPublished ? "" : "Your work is admitted here and its global projection will keep syncing in the background.");
      retryAfter.current = 0;
      return synchronizedProjection;
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') throw cause;
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      return queueForGlobalCommit();
    } finally {
      commandPending.current = false;
      setPendingCommand(null);
    }
  }, [edgeQueue, input.activeCard, input.actorId, input.cardAdmission, input.enabled, input.guestId, input.kaiUPulse, input.networkEnabled, input.nativeSourceEnabled, mode, projectPending, refresh, restoreSession, sendEntry]);

  useEffect(() => {
    const resume = () => {
      retryAfter.current = 0;
      void refresh();
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [refresh]);

  const commandId = (kind: string) => `${kind}:${crypto.randomUUID()}`;
  const buildGroundStewardStructure = (blueprint: "steward-workbench" | "trail-cache", position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate?: WildsCreatureMandateV1) => {
    if (mandate && !input.activeCard) throw new Error("wilds_world_active_card_required");
    if (!snapshot) throw new Error("wilds_world_session_required");
    const currentEmission = wildsWorldSourceEmission(snapshot);
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lots.some((lot) => wildsMaterialCustodian(snapshot, lot) !== input.actorId)
      || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard?.id ?? input.actorId).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard?.proof.digest ?? input.actorId);
    const terrain = sampleWildsTerrain(position.x, position.z);
    const structureInput = { ownerReceizId: input.actorId, position: { x: position.x, y: terrain.elevation, z: position.z }, rotationQuarterTurns, lots,
      materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, input.actorId),
      builder: mandate ? { creatureSubjectId, creatureHead } : playerStewardBuilder(input.actorId), existingStructures: Object.values(snapshot.structures), kaiUPulse: input.kaiUPulse };
    const structure = blueprint === "steward-workbench" ? createWildsWorkstation(structureInput) : createWildsTrailCache(structureInput);
    const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const settlement = settleWildsBuild({ operation, currentEmission, actorId: input.actorId });
    return post({ type: blueprint === "steward-workbench" ? "structure.steward-workbench.build" : "structure.trail-cache.build", position, actorPosition,
      rotationQuarterTurns, lotIds, ...(mandate ? { mandate } : {}), ...settlement,
      ...(input.activeCard ? { cardProofDigest: input.activeCard.proof.digest } : {}), commandId: commandId(`command:structure:${blueprint}`) });
  };
  const craftStewardTool = (kind: WildsStewardToolKind, workstationId: string, actorPosition: { x: number; z: number }, lotIds: string[], mandate?: WildsCreatureMandateV1) => {
    if (mandate && !input.activeCard) throw new Error("wilds_world_active_card_required");
    if (!snapshot) throw new Error("wilds_world_session_required");
    const currentEmission = wildsWorldSourceEmission(snapshot);
    const workstation = resolveWildsCraftWorkstation(snapshot, workstationId);
    if (!workstation) throw new Error("wilds_world_tool_workstation_invalid");
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lots.some((lot) => wildsMaterialCustodian(snapshot, lot) !== input.actorId)
      || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_tool_material_invalid");
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard?.id ?? input.actorId).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard?.proof.digest ?? input.actorId);
    const tool = createWildsStewardTool({ kind, ownerReceizId: input.actorId, workstation, lots,
      materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, input.actorId),
      builder: mandate ? { creatureSubjectId, creatureHead } : playerStewardBuilder(input.actorId), kaiUPulse: input.kaiUPulse });
    const operation = createWildsStewardToolOperation({ tool, lots, workstation, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const settlement = settleWildsBuild({ operation, currentEmission, actorId: input.actorId });
    return post({ type: "tool.steward.craft", kind, workstationId, actorPosition, lotIds, ...(mandate ? { mandate } : {}), ...settlement, ...(input.activeCard ? { cardProofDigest: input.activeCard.proof.digest } : {}), commandId: commandId(`command:tool:${kind}`) });
  };
  const placeConstructionSite = (blueprint: WildsConstructionBlueprint, position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[]) => {
    if (!snapshot) throw new Error("wilds_world_session_required");
    createWildsConstructionSite({ blueprint, placedByReceizId: input.actorId, actorPosition, position, rotationQuarterTurns,
      existingStructures: Object.values(snapshot.structures), existingSites: Object.values(snapshot.constructionSites), kaiUPulse: input.kaiUPulse });
    const required = blueprint === "trail-shelter" ? { timber: 2, stone: 1 } : { timber: 4, stone: 2 };
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (new Set(lotIds).size !== lotIds.length || lots.length !== required.timber + required.stone
      || lots.filter((lot) => lot.kind === "timber").length !== required.timber
      || lots.filter((lot) => lot.kind === "stone").length !== required.stone
      || lots.some((lot) => wildsMaterialCustodian(snapshot, lot) !== input.actorId)
      || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) {
      throw new Error("wilds_construction_material_invalid");
    }
    return post({ type: "construction.site.place", blueprint, position, actorPosition, rotationQuarterTurns, lotIds,
      ...(input.activeCard ? { cardProofDigest: input.activeCard.proof.digest } : {}), commandId: commandId("command:construction:site:place") });
  };
  const contributeConstructionSite = (siteId: string, siteHead: string, actorPosition: { x: number; z: number }, lotIds: string[]) => {
    if (!snapshot) throw new Error("wilds_world_session_required");
    const site = snapshot.constructionSites[siteId];
    if (!site || site.head !== siteHead) throw new Error("wilds_construction_site_stale");
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_construction_material_invalid");
    contributeWildsConstructionSite({ site, expectedSiteHead: siteHead, contributorReceizId: input.actorId, lots, kaiUPulse: input.kaiUPulse });
    return post({ type: "construction.site.contribute", siteId, siteHead, actorPosition, lotIds,
      ...(input.activeCard ? { cardProofDigest: input.activeCard.proof.digest } : {}), commandId: commandId("command:construction:site:contribute") });
  };
  const workConstructionSite = (siteId: string, siteHead: string, actorPosition: { x: number; z: number }, mandate?: WildsCreatureMandateV1) => {
    if ((mandate && !input.activeCard) || !snapshot) throw new Error("wilds_world_active_card_required");
    const currentEmission = wildsWorldSourceEmission(snapshot);
    const site = snapshot.constructionSites[siteId];
    if (!site || site.head !== siteHead) throw new Error("wilds_construction_site_stale");
    const lots = site.contributedLots.map((entry) => snapshot.materialLots[entry.lotId]).filter(Boolean);
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard?.id ?? input.actorId).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard?.proof.digest ?? input.actorId);
    const completed = completeWildsConstructionSite({ site, expectedSiteHead: siteHead, lots, workerReceizId: input.actorId,
      ...(mandate ? { creature: { subjectId: creatureSubjectId, head: creatureHead } } : {}), existingStructures: Object.values(snapshot.structures), kaiUPulse: input.kaiUPulse });
    const operation = createWildsStewardStructureOperation({ structure: completed.structure, lots, ownerReceizId: completed.structure.ownerReceizId,
      actorReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const settlement = settleWildsBuild({ operation, currentEmission, actorId: input.actorId });
    return post({ type: "construction.site.work", siteId, siteHead, actorPosition, ...(mandate ? { mandate } : {}), ...settlement, ...(input.activeCard ? { cardProofDigest: input.activeCard.proof.digest } : {}), commandId: commandId("command:construction:site:work") });
  };
  return {
    snapshot,
    mode,
    error,
    pendingCommand,
    refresh,
    adoptServerWorld,
    emissionForGrove: (groveId: string) => wildsWorldSourceEmission(nativeAuthorityActive.current ? wildsWorldGroveSource(groveId, nativeProjection.current, legacyProjection.current) : snapshot),
    digBurrow: (request:WildsBurrowRequest,actorPosition:{x:number;y:number;z:number}) => post({type:"construction.burrow.dig",request,actorPosition,cardProofDigest:input.activeCard?.proof.digest??"",commandId:commandId("command:burrow")}),
    createConstructionProject: (name: string, region: { x: number; z: number }) => post({ type: "construction.project.create", name, region, commandId: commandId("command:construction:project") }, null),
    placeConstructionComponent: (projectId: string, placement: WildsBlueprintPlacement, request: WildsConstructionPlacementRequest, actorPosition: { x: number; z: number }) => post({ type: "construction.component.place", projectId, placement, request, actorPosition, commandId: commandId("command:construction:place") }, null),
    adjustConstructionComponent: (componentId: string, componentHead: string, placement: WildsBlueprintPlacement, request: WildsConstructionPlacementRequest, actorPosition: {x:number;z:number}) => post({type: "construction.component.adjust", componentId, componentHead, placement, request, actorPosition, commandId: commandId("command:construction:adjust")}, null),
    depositConstructionMaterial: (componentId: string, componentHead: string, lotIds: string[], actorPosition: { x: number; z: number }) => post({ type: "construction.component.deposit", componentId, componentHead, lotIds, actorPosition, commandId: commandId("command:construction:deposit") }, null),
    maintainConstructionComponent: (componentId: string, componentHead: string, conditionHead: string | null, actorPosition: { x: number; z: number }, lotId?: string) => post({ type: "construction.component.maintain", componentId, componentHead, conditionHead, actorPosition, ...(lotId ? { lotId } : {}), commandId: commandId("command:construction:maintain") }, null),
    workConstructionComponent: (componentId: string, componentHead: string, actorPosition: { x: number; z: number }) => post({ type: "construction.component.work", componentId, componentHead, actorPosition, commandId: commandId("command:construction:work") }, null),
    contributeStory: (dayId: string, objectiveId: string, verb: WildsGameplayVerb, amount = 1, position?: { x: number; z: number }) => post({
      type: "story.contribute",
      dayId,
      objectiveId,
      verb,
      amount,
      position,
      cardProofDigest: input.activeCard?.proof.digest,
      commandId: commandId("command:story:contribute")
    }),
    settleTrainerBattle: (dayId: string, trainerId: string, outcome: "player_victory" | "trainer_victory" | "fled") => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      return post({
        type: "story.trainer_battle",
        dayId,
        trainerId,
        matchId: `match:story:${crypto.randomUUID()}`,
        outcome,
        cardProofDigest: input.activeCard.proof.digest,
        commandId: commandId("command:story:trainer_battle")
      });
    },
    enterSagaTournament: (tournamentId: string, qualificationGrantId: string) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      return post({
        type: "story.tournament_enter",
        tournamentId,
        qualificationGrantId,
        cardProofDigest: input.activeCard.proof.digest,
        commandId: commandId("command:story:tournament_enter")
      });
    },
    discoverEcology: (siteId: string, position: { x: number; z: number }) => post({ type: "ecology.discover", siteId, position, commandId: commandId("command:ecology:discover") }),
    discoverGrove: (grove: WildsRegenerativeGroveV1, emission: WildsWorldEmissionProofV1) => post({
      type: "grove.observe", grove, emission, commandId: commandId("command:grove:observe")
    }),
    actInGrove: (operation: WildsLivingOperationPlanV1, grove: WildsRegenerativeGroveV1, emission: WildsWorldEmissionProofV1, amountPhiMicro: string, resourceLot?: WildsResourceLotV1 | null) => post({
      type: "grove.act", operation, grove, emission, amountPhiMicro, resourceLot: resourceLot ?? null, commandId: commandId("command:grove:act")
    }),
    /** Exact crew command; preparation and mandate verification happen before this port.
     * The queued source transition retains its Kai root and idempotency identity. */
    currentSource: edgeQueue.current,
    /** The existing durable edge source admits one exact finite aggregate before rendering. */
    admitCreationAction: async (command: Extract<WildsWorldCommand,{type:"creation.action"}>,beforeAdmit:()=>Promise<void>) => {
      const events:WildsWorldEvent[]=[];
      const projection=await post(command,null,{beforeAdmit,onAdmitted:(_projection,admitted)=>{events.push(...admitted);}});
      return {projection,events};
    },
    admitCreation: async (
      command: Extract<WildsWorldCommand, {type:"creation.construct"|"creation.evolve"}>,
      beforeAdmit: () => Promise<void>
    ) => {
      const events: WildsWorldEvent[] = [];
      const projection = await post(command, null, { beforeAdmit, onAdmitted: (_projection, admitted) => { events.push(...admitted); } });
      return { projection, events };
    },
    admitCrewHarvest: async (
      command:Extract<WildsWorldCommand,{type:"resource.material.harvest"}>,
      authority:Readonly<{card:PortableCardAsset;cardAdmission?:WildzVaultCardMembershipProof|null}>,
      beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>
    )=>{
      const events:WildsWorldEvent[]=[];
      const projection=await post(command,authority,{beforeAdmit,onAdmitted:(_projection,admitted)=>{events.push(...admitted);}});
      return {projection,events};
    },
    admitCrewSourceWork: async (
      command:Extract<WildsWorldCommand,{type:"resource.material.harvest"|"construction.site.contribute"|"construction.site.work"}>,
      authority:Readonly<{card:PortableCardAsset;cardAdmission?:WildzVaultCardMembershipProof|null}>,
      beforeAdmit:(entry:WildsWorldOutboxEntry)=>Promise<void>
    )=>{
      const events:WildsWorldEvent[]=[];
      const projection=await post(command,authority,{beforeAdmit,onAdmitted:(_projection,admitted)=>{events.push(...admitted);}});
      return {projection,events};
    },
    harvestMaterial: (source: WildsResourceSource, sourceHead: string, actorPosition: { x: number; z: number }, mandate?: WildsCreatureMandateV1, authority?: Readonly<{ card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof | null }> | null) => {
      const authorityCard = authority === null ? null : authority?.card ?? input.activeCard;
      if (!snapshot) throw new Error("wilds_world_session_required");
      const command = planWildsMaterialHarvest({
        projection: snapshot,
        source,
        actorId: input.actorId,
        actorPosition,
        kaiUPulse: input.kaiUPulse,
        commandId: commandId("command:material:harvest"),
        card: authorityCard,
        mandate
      });
      if (command.sourceHead !== sourceHead) throw new Error("wilds_world_resource_source_stale");
      return post(command, authority);
    },
    placeConstructionSite,
    contributeConstructionSite,
    workConstructionSite,
    buildTrailShelter: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate?: WildsCreatureMandateV1) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      if (!snapshot) throw new Error("wilds_world_session_required");
      const currentEmission = wildsWorldSourceEmission(snapshot);
      const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter((lot) => Boolean(lot));
      if (lots.length !== lotIds.length || lots.some((lot) => wildsMaterialCustodian(snapshot, lot) !== input.actorId)
        || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
      const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
      const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
      const terrain = sampleWildsTerrain(position.x, position.z);
      const structure = createWildsTrailShelter({
        ownerReceizId: input.actorId,
        position: { x: position.x, y: terrain.elevation, z: position.z },
        rotationQuarterTurns,
        lots,
        materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, input.actorId),
        builder: { creatureSubjectId, creatureHead },
        existingStructures: Object.values(snapshot.structures),
        kaiUPulse: input.kaiUPulse
      });
      const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
      const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
      if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
      const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
      const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
      return post({
        type: "structure.trail-shelter.build",
        position,
        actorPosition,
        rotationQuarterTurns,
        lotIds,
        mandate,
        operation,
        emission,
        amountPhiMicro: preview.amountPhiMicro,
        phiAward,
        cardProofDigest: input.activeCard.proof.digest,
        commandId: commandId("command:structure:trail-shelter")
      });
    },
    buildTrailBridge: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate?: WildsCreatureMandateV1) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      if (!snapshot) throw new Error("wilds_world_session_required");
      const currentEmission = wildsWorldSourceEmission(snapshot);
      const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter((lot) => Boolean(lot));
      if (lots.length !== lotIds.length || lots.some((lot) => wildsMaterialCustodian(snapshot, lot) !== input.actorId)
        || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
      const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
      const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
      const structure = createWildsTrailBridge({
        ownerReceizId: input.actorId,
        position,
        rotationQuarterTurns,
        lots,
        materialContributorReceizIds: wildsMaterialContributorReceizIds(lots, input.actorId),
        builder: { creatureSubjectId, creatureHead },
        existingStructures: Object.values(snapshot.structures),
        kaiUPulse: input.kaiUPulse
      });
      const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
      const preview = previewWildsEmission({ emission: currentEmission, operation, contributionClass: "construction" });
      if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
      const emission = admitWildsEmission({ emission: currentEmission, operation, contributionClass: "construction", preview });
      const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
      return post({
        type: "structure.trail-bridge.build",
        position,
        actorPosition,
        rotationQuarterTurns,
        lotIds,
        mandate,
        operation,
        emission,
        amountPhiMicro: preview.amountPhiMicro,
        phiAward,
        cardProofDigest: input.activeCard.proof.digest,
        commandId: commandId("command:structure:trail-bridge")
      });
    },
    buildStewardWorkbench: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate?: WildsCreatureMandateV1) => buildGroundStewardStructure("steward-workbench", position, actorPosition, rotationQuarterTurns, lotIds, mandate),
    buildTrailCache: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate?: WildsCreatureMandateV1) => buildGroundStewardStructure("trail-cache", position, actorPosition, rotationQuarterTurns, lotIds, mandate),
    craftStewardTool,
    equipStewardTool: (toolId: string) => post({ type: "tool.steward.equip", toolId, commandId: commandId("command:tool:equip") }),
    moveStoredMaterial: (lotId: string, cacheId: string, direction: "deposit" | "withdraw", actorPosition: { x: number; z: number }) => post({ type: "storage.material.move", lotId, cacheId, direction, actorPosition, commandId: commandId("command:storage:material") }),
    contributeEcology: (siteId: string, position: { x: number; z: number }, amount: number) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      return post({ type: "ecology.contribute", siteId, position, amount, cardProofDigest: input.activeCard.proof.digest, commandId: commandId("command:ecology:contribute") });
    },
    joinRaid: (bossId: string, preferredSquad?: number) => post({ type: "raid.join", bossId, preferredSquad, commandId: commandId("command:raid:join") }),
    trackBoss: (bossId: string, position: { x: number; z: number }) => post({ type: "boss.track", bossId, position, commandId: commandId("command:boss:track") }),
    enterRaid: (bossId: string, roundId: string, position: { x: number; z: number }, preferredSquad?: number) => post({ type: "raid.enter", bossId, roundId, position, preferredSquad, commandId: commandId("command:raid:enter") }),
    actRaid: (bossId: string, roundId: string, intent: WildsRaidIntent["type"]) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      return post({ type: "raid.act", bossId, roundId, intent, commandId: commandId("command:raid:act") });
    },
    leaseRaid: (bossId: string, roundId: string, status: "connected" | "disconnected") => post({ type: "raid.lease", bossId, roundId, status, commandId: commandId("command:raid:lease") }),
    retreatRaid: (bossId: string, roundId: string) => post({ type: "raid.retreat", bossId, roundId, commandId: commandId("command:raid:retreat") }),
    contribute: (bossId: string, damage: number, support: number) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      return post({ type: "raid.contribute", bossId, damage, support, cardProofDigest: input.activeCard.proof.digest, commandId: commandId("command:raid:contribute") });
    },
    createTeam: (name: string) => post({ type: "team.create", name, commandId: commandId("command:team:create") }),
    joinTeam: (teamId: string) => post({ type: "team.join", teamId, commandId: commandId("command:team:join") })
  };
}
