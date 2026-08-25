"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { creatureForm } from "./creature-catalog";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import type { WildsWorldCommand } from "./wilds-world-service";
import { WILDS_WORLD_ID } from "./wilds-world-event";
import { initialWildsWorldProjection, type WildsWorldProjection } from "./wilds-world-state";
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
  initialWildsHarvestedSourceState,
  projectWildsCreatureWorkFamilies,
  type WildsStewardToolKind
} from "./wilds-steward-construction";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import { worldCommandRequiresCard } from "./wilds-world-authority";
import { withWildsWorldCommandKai } from "./wilds-world-authority";
import { deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { createKaiTemporalRoot } from "./kai-temporal-root";
import { publishActiveWildsWorldWithIdentityProof } from "@/lib/receiz/wilds-world-identity-publication";
import {
  acknowledgeWildsWorldCommand,
  enqueueWildsWorldCommand,
  projectWildsWorldOutbox,
  readWildsWorldOutbox,
  type WildsWorldOutboxEntry
} from "./wilds-world-outbox";
import {
  shouldAttemptWildsNetwork,
  isOpaqueWildsNetworkFailure,
  WILDS_NETWORK_RETRY_BACKOFF_MS,
  WILDS_WORLD_OFFLINE_MESSAGE,
  wildsNetworkFailureMessage
} from "./wilds-network-status";

export function acceptWildsWorldSnapshot(current: WildsWorldProjection | null, candidate: WildsWorldProjection) {
  return current && candidate.revision < current.revision ? current : candidate;
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

export function useWildsWorld(input: {
  enabled: boolean;
  actorId: string;
  guestId: string;
  kaiUPulse: number;
  activeCard: PortableCardAsset | null;
  cardAdmission: WildzVaultCardMembershipProof | null;
  initialSnapshot?: { projection: WildsWorldProjection; mode: "receiz_live" | "kai_live" } | null;
  authorizeLivingWorld?: (input: Readonly<{
    operationId: string;
    planDigest: string;
    semanticIdempotencyKey: string;
    amountPhiMicro: string;
  }>) => Promise<unknown>;
}) {
  const [snapshot, setSnapshot] = useState<WildsWorldProjection | null>(() => input.initialSnapshot?.projection ?? null);
  const [mode, setMode] = useState<WildsWorldClientMode>(() => input.initialSnapshot?.mode ?? "connecting");
  const [error, setError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const commandPending = useRef(false);
  const canonicalSnapshot = useRef<WildsWorldProjection | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const retryAfter = useRef(0);
  const authorizeLivingWorld = input.authorizeLivingWorld;

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
      return value;
    } finally {
      controllers.current.delete(controller);
    }
  }, []);

  const sendEntry = useCallback(async (entry: WildsWorldOutboxEntry) => {
    const receizExecution = (entry.command.type === "grove.act"
      || entry.command.type === "resource.material.harvest"
      || entry.command.type === "structure.trail-shelter.build"
      || entry.command.type === "structure.trail-bridge.build"
      || entry.command.type === "structure.steward-workbench.build"
      || entry.command.type === "structure.trail-cache.build"
      || entry.command.type === "construction.site.work"
      || entry.command.type === "tool.steward.craft") && entry.command.operation && entry.command.amountPhiMicro
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
    return { ...parseWildsWorldCommandResponse(value), globallyPublished };
  }, [authorizeLivingWorld, request]);

  const flushOutbox = useCallback(async (base: WildsWorldProjection, initialMode: WildsWorldCommandMode) => {
    if (commandPending.current) {
      const entries = await readWildsWorldOutbox(input.actorId);
      return { projection: projectWildsWorldOutbox(base, input.actorId, entries), mode: initialMode as WildsWorldClientMode };
    }
    commandPending.current = true;
    let canonical = base;
    let nextMode: WildsWorldClientMode = initialMode;
    let entries = await readWildsWorldOutbox(input.actorId);
    try {
      while (entries.length > 0 && shouldAttemptWildsNetwork()) {
        const parsed = await sendEntry(entries[0]!);
        canonical = parsed.projection;
        nextMode = parsed.mode;
        if (!parsed.globallyPublished) break;
        entries = await acknowledgeWildsWorldCommand(input.actorId, entries[0]!.command.commandId);
      }
    } finally {
      commandPending.current = false;
    }
    canonicalSnapshot.current = canonical;
    return { projection: projectWildsWorldOutbox(canonical, input.actorId, entries), mode: nextMode };
  }, [input.actorId, sendEntry]);

  const refresh = useCallback(async () => {
    if (!input.enabled) return;
    if (!shouldAttemptWildsNetwork()) {
      setMode("receiz_recovery_pending");
      setError(WILDS_WORLD_OFFLINE_MESSAGE);
      return;
    }
    if (Date.now() < retryAfter.current) return;
    try {
      const value = await request("/api/wilds/world/snapshot");
      const { projection, mode: nextMode } = parseWildsWorldSnapshotResponse(value);
      canonicalSnapshot.current = projection;
      const flushed = await flushOutbox(projection, nextMode);
      setSnapshot(flushed.projection);
      setMode(flushed.mode);
      setError("");
      retryAfter.current = 0;
    } catch (cause) {
      if ((cause as Error).name === "AbortError") return;
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      setMode((current) => wildsWorldModeAfterRequestFailure(offline, current));
      setError(wildsNetworkFailureMessage(cause, "world", !offline));
    }
  }, [flushOutbox, input.enabled, request]);

  useEffect(() => {
    if (input.enabled) setMode(wildsWorldModeAfterConfirmedBootstrap);
  }, [input.enabled]);

  useEffect(() => {
    if (!input.enabled || !input.initialSnapshot || !validWildsWorldProjection(input.initialSnapshot.projection)) return;
    canonicalSnapshot.current = input.initialSnapshot.projection;
    setSnapshot(input.initialSnapshot.projection);
    setMode(input.initialSnapshot.mode);
    setError("");
  }, [input.enabled, input.initialSnapshot]);

  useEffect(() => {
    const activeControllers = controllers.current;
    return () => {
      for (const controller of activeControllers) controller.abort();
      activeControllers.clear();
    };
  }, []);

  const post = useCallback(async (
    command: WildsWorldCommand,
    authority?: Readonly<{ card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof | null }> | null
  ) => {
    if (!input.enabled) throw new Error("wilds_world_session_required");
    const kaiAuthority = mode === "receiz_live" || mode === "kai_live" ? "world" : "local";
    const rootedCommand = withWildsWorldCommandKai(command, createKaiTemporalRoot(
      deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: kaiAuthority })
    ));
    const authorityCard = authority === null ? null : authority?.card ?? input.activeCard;
    const authorityCardAdmission = authority === null ? null : authority?.cardAdmission ?? input.cardAdmission;
    const entry: WildsWorldOutboxEntry = {
      schema: "receiz.wilds_world_outbox_entry.v1",
      actorId: input.actorId,
      guestId: input.guestId,
      command: rootedCommand,
      ...((worldCommandRequiresCard(rootedCommand) || rootedCommand.type === "resource.material.harvest") && authorityCard ? { card: authorityCard } : {}),
      ...(authorityCardAdmission ? { cardAdmission: authorityCardAdmission } : {}),
      queuedAt: new Date().toISOString()
    };
    const queueForGlobalCommit = async () => {
      const entries = await enqueueWildsWorldCommand(entry);
      const base = canonicalSnapshot.current ?? snapshot ?? initialWildsWorldProjection();
      const projection = projectWildsWorldOutbox(base, input.actorId, entries);
      setSnapshot(projection);
      setMode("receiz_recovery_pending");
      setError(WILDS_WORLD_OFFLINE_MESSAGE);
      return projection;
    };
    if (commandPending.current || !shouldAttemptWildsNetwork()) {
      return queueForGlobalCommit();
    }
    commandPending.current = true;
    setPendingCommand(command.commandId);
    try {
      const parsed = await sendEntry(entry);
      const projection = parsed.projection;
      canonicalSnapshot.current = projection;
      const queued = parsed.globallyPublished
        ? await readWildsWorldOutbox(input.actorId)
        : await enqueueWildsWorldCommand(entry);
      setSnapshot(projectWildsWorldOutbox(projection, input.actorId, queued));
      setMode(parsed.globallyPublished ? parsed.mode : "receiz_recovery_pending");
      setError(parsed.globallyPublished ? "" : "Your work is admitted here and its global projection will keep syncing in the background.");
      retryAfter.current = 0;
      return projection;
    } catch (cause) {
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      const status = (cause as Error & { status?: number }).status;
      if (offline || status === undefined || status >= 500) return queueForGlobalCommit();
      const message = wildsNetworkFailureMessage(cause, "world", !offline);
      setMode((current) => wildsWorldModeAfterRequestFailure(offline, current));
      setError(message);
      throw new Error(message);
    } finally {
      commandPending.current = false;
      setPendingCommand(null);
    }
  }, [input.activeCard, input.actorId, input.cardAdmission, input.enabled, input.guestId, input.kaiUPulse, mode, sendEntry, snapshot]);

  useEffect(() => {
    const resume = () => {
      retryAfter.current = 0;
      void refresh();
    };
    window.addEventListener("online", resume);
    return () => window.removeEventListener("online", resume);
  }, [refresh]);

  const commandId = (kind: string) => `${kind}:${crypto.randomUUID()}`;
  const buildGroundStewardStructure = (blueprint: "steward-workbench" | "trail-cache", position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate: WildsCreatureMandateV1) => {
    if (!input.activeCard) throw new Error("wilds_world_active_card_required");
    if (!snapshot?.worldEmission) throw new Error("wilds_world_emission_required");
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
    const terrain = sampleWildsTerrain(position.x, position.z);
    const structureInput = { ownerReceizId: input.actorId, position: { x: position.x, y: terrain.elevation, z: position.z }, rotationQuarterTurns, lots,
      builder: { creatureSubjectId, creatureHead }, existingStructures: Object.values(snapshot.structures), kaiUPulse: input.kaiUPulse };
    const structure = blueprint === "steward-workbench" ? createWildsWorkstation(structureInput) : createWildsTrailCache(structureInput);
    const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
    if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
    const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
    return post({ type: blueprint === "steward-workbench" ? "structure.steward-workbench.build" : "structure.trail-cache.build", position, actorPosition,
      rotationQuarterTurns, lotIds, mandate, operation, emission, amountPhiMicro: preview.amountPhiMicro, phiAward,
      cardProofDigest: input.activeCard.proof.digest, commandId: commandId(`command:structure:${blueprint}`) });
  };
  const craftStewardTool = (kind: WildsStewardToolKind, workstationId: string, actorPosition: { x: number; z: number }, lotIds: string[], mandate: WildsCreatureMandateV1) => {
    if (!input.activeCard) throw new Error("wilds_world_active_card_required");
    if (!snapshot?.worldEmission) throw new Error("wilds_world_emission_required");
    const workstation = snapshot.structures[workstationId];
    if (!workstation || workstation.blueprint !== "steward-workbench") throw new Error("wilds_world_tool_workstation_invalid");
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_world_tool_material_invalid");
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
    const tool = createWildsStewardTool({ kind, ownerReceizId: input.actorId, workstation, lots, builder: { creatureSubjectId, creatureHead }, kaiUPulse: input.kaiUPulse });
    const operation = createWildsStewardToolOperation({ tool, lots, workstation, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
    if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
    const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
    return post({ type: "tool.steward.craft", kind, workstationId, actorPosition, lotIds, mandate, operation, emission,
      amountPhiMicro: preview.amountPhiMicro, phiAward, cardProofDigest: input.activeCard.proof.digest, commandId: commandId(`command:tool:${kind}`) });
  };
  const placeConstructionSite = (blueprint: WildsConstructionBlueprint, position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number) => {
    if (!input.activeCard || !snapshot) throw new Error("wilds_world_active_card_required");
    createWildsConstructionSite({ blueprint, placedByReceizId: input.actorId, actorPosition, position, rotationQuarterTurns,
      existingStructures: Object.values(snapshot.structures), existingSites: Object.values(snapshot.constructionSites), kaiUPulse: input.kaiUPulse });
    return post({ type: "construction.site.place", blueprint, position, actorPosition, rotationQuarterTurns,
      cardProofDigest: input.activeCard.proof.digest, commandId: commandId("command:construction:site:place") });
  };
  const contributeConstructionSite = (siteId: string, siteHead: string, actorPosition: { x: number; z: number }, lotIds: string[]) => {
    if (!input.activeCard || !snapshot) throw new Error("wilds_world_active_card_required");
    const site = snapshot.constructionSites[siteId];
    if (!site || site.head !== siteHead) throw new Error("wilds_construction_site_stale");
    const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter(Boolean);
    if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId] || snapshot.storedMaterialLots[lotId] || snapshot.reservedMaterialLots[lotId])) throw new Error("wilds_construction_material_invalid");
    contributeWildsConstructionSite({ site, expectedSiteHead: siteHead, contributorReceizId: input.actorId, lots, kaiUPulse: input.kaiUPulse });
    return post({ type: "construction.site.contribute", siteId, siteHead, actorPosition, lotIds,
      cardProofDigest: input.activeCard.proof.digest, commandId: commandId("command:construction:site:contribute") });
  };
  const workConstructionSite = (siteId: string, siteHead: string, actorPosition: { x: number; z: number }, mandate: WildsCreatureMandateV1) => {
    if (!input.activeCard || !snapshot?.worldEmission) throw new Error("wilds_world_active_card_required");
    const site = snapshot.constructionSites[siteId];
    if (!site || site.head !== siteHead) throw new Error("wilds_construction_site_stale");
    const lots = site.contributedLots.map((entry) => snapshot.materialLots[entry.lotId]).filter(Boolean);
    const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
    const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
    const completed = completeWildsConstructionSite({ site, expectedSiteHead: siteHead, lots, workerReceizId: input.actorId,
      creature: { subjectId: creatureSubjectId, head: creatureHead }, existingStructures: Object.values(snapshot.structures), kaiUPulse: input.kaiUPulse });
    const operation = createWildsStewardStructureOperation({ structure: completed.structure, lots, ownerReceizId: completed.structure.ownerReceizId,
      actorReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
    const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
    if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
    const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
    const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
    return post({ type: "construction.site.work", siteId, siteHead, actorPosition, mandate, operation, emission,
      amountPhiMicro: preview.amountPhiMicro, phiAward, cardProofDigest: input.activeCard.proof.digest, commandId: commandId("command:construction:site:work") });
  };
  return {
    snapshot,
    mode,
    error,
    pendingCommand,
    refresh,
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
    harvestMaterial: (source: WildsResourceSource, sourceHead: string, actorPosition: { x: number; z: number }, mandate?: WildsCreatureMandateV1, authority?: Readonly<{ card: PortableCardAsset; cardAdmission?: WildzVaultCardMembershipProof | null }> | null) => {
      const authorityCard = authority === null ? null : authority?.card ?? input.activeCard;
      if (!snapshot?.worldEmission) throw new Error("wilds_world_emission_required");
      const currentSource = snapshot.harvestedSources[source.sourceId] ?? initialWildsHarvestedSourceState(source);
      if (currentSource.head !== sourceHead) throw new Error("wilds_world_resource_source_stale");
      const creatureSubjectId = authorityCard ? `creature:${sha256PortableBasis(authorityCard.id).slice(0, 32)}` : undefined;
      const creatureHead = authorityCard ? sha256PortableBasis(authorityCard.proof.digest) : undefined;
      const element = authorityCard ? creatureForm(authorityCard.manifest.formId)?.element ?? "" : "";
      const toolId = snapshot.equippedStewardTools[input.actorId];
      const tool = toolId ? snapshot.stewardTools[toolId] : null;
      const matchingTool = tool?.capability === source.requirements.creature && tool.durability.remaining > 0 ? tool : null;
      const harvested = createWildsMaterialHarvest({
        source,
        current: currentSource,
        ownerReceizId: input.actorId,
        actorPosition,
        creature: creatureSubjectId && creatureHead ? { subjectId: creatureSubjectId, head: creatureHead, workFamilies: projectWildsCreatureWorkFamilies(element), willing: true } : undefined,
        tool: matchingTool,
        kaiUPulse: input.kaiUPulse
      });
      const operation = createWildsStewardHarvestOperation({
        source,
        currentSource,
        harvestedSource: harvested.source,
        lot: harvested.lot,
        ownerReceizId: input.actorId,
        playerHead: sha256PortableBasis(input.actorId),
        ...(creatureSubjectId && creatureHead ? { creatureSubjectId, creatureHead } : {}),
        tool: matchingTool,
        nextTool: harvested.tool,
        kaiUPulse: input.kaiUPulse
      });
      const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
      if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
      const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
      const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
      return post({
        type: "resource.material.harvest",
        source,
        sourceHead,
        actorPosition,
        toolId: matchingTool?.toolId,
        ...(mandate ? { mandate } : {}),
        operation,
        emission,
        amountPhiMicro: preview.amountPhiMicro,
        phiAward,
        ...(authorityCard ? { cardProofDigest: authorityCard.proof.digest } : {}),
        commandId: commandId("command:material:harvest")
      }, authority);
    },
    placeConstructionSite,
    contributeConstructionSite,
    workConstructionSite,
    buildTrailShelter: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate: WildsCreatureMandateV1) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      if (!snapshot?.worldEmission) throw new Error("wilds_world_emission_required");
      const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter((lot) => Boolean(lot));
      if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
      const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
      const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
      const terrain = sampleWildsTerrain(position.x, position.z);
      const structure = createWildsTrailShelter({
        ownerReceizId: input.actorId,
        position: { x: position.x, y: terrain.elevation, z: position.z },
        rotationQuarterTurns,
        lots,
        builder: { creatureSubjectId, creatureHead },
        existingStructures: Object.values(snapshot.structures),
        kaiUPulse: input.kaiUPulse
      });
      const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
      const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
      if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
      const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
      const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
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
    buildTrailBridge: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate: WildsCreatureMandateV1) => {
      if (!input.activeCard) throw new Error("wilds_world_active_card_required");
      if (!snapshot?.worldEmission) throw new Error("wilds_world_emission_required");
      const lots = lotIds.map((lotId) => snapshot.materialLots[lotId]).filter((lot) => Boolean(lot));
      if (lots.length !== lotIds.length || lotIds.some((lotId) => snapshot.consumedMaterialLots[lotId])) throw new Error("wilds_world_structure_material_invalid");
      const creatureSubjectId = `creature:${sha256PortableBasis(input.activeCard.id).slice(0, 32)}`;
      const creatureHead = sha256PortableBasis(input.activeCard.proof.digest);
      const structure = createWildsTrailBridge({
        ownerReceizId: input.actorId,
        position,
        rotationQuarterTurns,
        lots,
        builder: { creatureSubjectId, creatureHead },
        existingStructures: Object.values(snapshot.structures),
        kaiUPulse: input.kaiUPulse
      });
      const operation = createWildsStewardStructureOperation({ structure, lots, ownerReceizId: input.actorId, playerHead: sha256PortableBasis(input.actorId) });
      const preview = previewWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction" });
      if (!preview.eligible || preview.amountPhiMicro === "0") throw new Error("wilds_world_steward_emission_unavailable");
      const emission = admitWildsEmission({ emission: snapshot.worldEmission, operation, contributionClass: "construction", preview });
      const phiAward = createWildsStewardPhiAward({ ownerReceizId: input.actorId, operation, currentEmission: snapshot.worldEmission, nextEmission: emission, amountPhiMicro: preview.amountPhiMicro });
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
    buildStewardWorkbench: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate: WildsCreatureMandateV1) => buildGroundStewardStructure("steward-workbench", position, actorPosition, rotationQuarterTurns, lotIds, mandate),
    buildTrailCache: (position: { x: number; z: number }, actorPosition: { x: number; z: number }, rotationQuarterTurns: number, lotIds: string[], mandate: WildsCreatureMandateV1) => buildGroundStewardStructure("trail-cache", position, actorPosition, rotationQuarterTurns, lotIds, mandate),
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
