"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import type { WildsWorldCommand } from "./wilds-world-service";
import { WILDS_WORLD_ID } from "./wilds-world-event";
import { initialWildsWorldProjection, type WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldSnapshot } from "./wilds-world-record";
import type { WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsGameplayVerb } from "./wilds-saga-types";
import type { WildsRegenerativeGroveV1 } from "./wilds-regenerative-grove";
import type { WildsLivingOperationPlanV1 } from "./wilds-living-operation";
import type { WildsWorldEmissionProofV1 } from "./wilds-world-emission";
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
    const receizExecution = entry.command.type === "grove.act"
      ? await input.authorizeLivingWorld?.({
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
    if (publication?.required === "identity_proof" && publication.published === false) {
      await publishActiveWildsWorldWithIdentityProof(publication.draft);
    }
    return parseWildsWorldCommandResponse(value);
  }, [input.authorizeLivingWorld, request]);

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

  const post = useCallback(async (command: WildsWorldCommand) => {
    if (!input.enabled) throw new Error("wilds_world_session_required");
    const kaiAuthority = mode === "receiz_live" || mode === "kai_live" ? "world" : "local";
    const rootedCommand = withWildsWorldCommandKai(command, createKaiTemporalRoot(
      deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: kaiAuthority })
    ));
    const entry: WildsWorldOutboxEntry = {
      schema: "receiz.wilds_world_outbox_entry.v1",
      actorId: input.actorId,
      guestId: input.guestId,
      command: rootedCommand,
      ...(worldCommandRequiresCard(rootedCommand) && input.activeCard ? { card: input.activeCard } : {}),
      ...(input.cardAdmission ? { cardAdmission: input.cardAdmission } : {}),
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
      const queued = await readWildsWorldOutbox(input.actorId);
      setSnapshot(projectWildsWorldOutbox(projection, input.actorId, queued));
      setMode(parsed.mode);
      setError("");
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
    actInGrove: (operation: WildsLivingOperationPlanV1, grove: WildsRegenerativeGroveV1, emission: WildsWorldEmissionProofV1, amountPhiMicro: string) => post({
      type: "grove.act", operation, grove, emission, amountPhiMicro, commandId: commandId("command:grove:act")
    }),
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
