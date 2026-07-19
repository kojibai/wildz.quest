"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortableCardAsset } from "./portable-card";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import type { WildsWorldCommand } from "./wilds-world-service";
import { WILDS_WORLD_ID } from "./wilds-world-event";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldSnapshot } from "./wilds-world-record";
import type { WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsGameplayVerb } from "./wilds-saga-types";
import { worldCommandRequiresCard } from "./wilds-world-authority";
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
  if (response.ok !== true || !validWildsWorldProjection(projection) || (mode !== "receiz_live" && mode !== "local_practice")) {
    throw new Error("wilds_world_snapshot_invalid");
  }
  return { projection: projection!, mode };
}

export type WildsWorldClientMode = "connecting" | "receiz_live" | "local_practice" | "receiz_recovery_pending" | "reconnecting";
export type WildsWorldCommandMode = Extract<WildsWorldClientMode, "receiz_live" | "local_practice" | "receiz_recovery_pending">;

export function wildsWorldModeAfterRequestFailure(
  offline: boolean,
  currentMode: WildsWorldClientMode
): WildsWorldClientMode {
  if (offline) return "local_practice";
  return currentMode === "receiz_live" ? "receiz_live" : "reconnecting";
}

export function wildsWorldModeAfterConfirmedBootstrap(mode: WildsWorldClientMode): WildsWorldClientMode {
  return mode === "connecting" ? "receiz_live" : mode;
}

export function parseWildsWorldCommandResponse(value: unknown): { projection: WildsWorldProjection; mode: WildsWorldCommandMode } {
  if (!value || typeof value !== "object") throw new Error("wilds_world_command_response_invalid");
  const response = value as Record<string, unknown>;
  const projection = response.projection as WildsWorldProjection | undefined;
  const mode = response.mode;
  if (response.ok !== true || !validWildsWorldProjection(projection) || (mode !== "receiz_live" && mode !== "local_practice" && mode !== "receiz_recovery_pending")) {
    throw new Error("wilds_world_command_response_invalid");
  }
  return { projection: projection!, mode };
}

export function useWildsWorld(input: {
  enabled: boolean;
  guestId: string;
  activeCard: PortableCardAsset | null;
  cardAdmission: WildzVaultCardMembershipProof | null;
}) {
  const [snapshot, setSnapshot] = useState<WildsWorldProjection | null>(null);
  const [mode, setMode] = useState<WildsWorldClientMode>("connecting");
  const [error, setError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const commandPending = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const retryAfter = useRef(0);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const value = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok || !value) {
        throw new Error(typeof value?.error === "string" ? value.error : "wilds_world_request_failed");
      }
      return value;
    } finally {
      controllers.current.delete(controller);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!input.enabled) return;
    if (!shouldAttemptWildsNetwork()) {
      setMode("local_practice");
      setError(WILDS_WORLD_OFFLINE_MESSAGE);
      return;
    }
    if (Date.now() < retryAfter.current) return;
    try {
      const value = await request("/api/wilds/world/snapshot");
      const { projection, mode: nextMode } = parseWildsWorldSnapshotResponse(value);
      setSnapshot((current) => acceptWildsWorldSnapshot(current, projection));
      setMode(nextMode);
      setError("");
      retryAfter.current = 0;
    } catch (cause) {
      if ((cause as Error).name === "AbortError") return;
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      setMode(offline ? "local_practice" : "reconnecting");
      setError(wildsNetworkFailureMessage(cause, "world", !offline));
    }
  }, [input.enabled, request]);

  useEffect(() => {
    if (input.enabled) setMode(wildsWorldModeAfterConfirmedBootstrap);
  }, [input.enabled]);

  useEffect(() => {
    void refresh();
    if (!input.enabled) return;
    const timer = window.setInterval(() => void refresh(), 2_000);
    return () => window.clearInterval(timer);
  }, [input.enabled, refresh]);

  useEffect(() => () => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);

  const post = useCallback(async (command: WildsWorldCommand) => {
    if (!input.enabled) throw new Error("wilds_world_session_required");
    if (commandPending.current) throw new Error("wilds_world_command_pending");
    if (!shouldAttemptWildsNetwork()) {
      setMode("local_practice");
      setError(WILDS_WORLD_OFFLINE_MESSAGE);
      throw new Error(WILDS_WORLD_OFFLINE_MESSAGE);
    }
    commandPending.current = true;
    setPendingCommand(command.commandId);
    try {
      const value = await request("/api/wilds/world/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildWildsWorldCommandBody(
          input.guestId,
          command,
          worldCommandRequiresCard(command) ? input.activeCard ?? undefined : undefined,
          input.cardAdmission
        ))
      });
      const parsed = parseWildsWorldCommandResponse(value);
      const projection = parsed.projection;
      setSnapshot((current) => acceptWildsWorldSnapshot(current, projection));
      setMode(parsed.mode);
      setError("");
      retryAfter.current = 0;
      return projection;
    } catch (cause) {
      const opaqueFailure = isOpaqueWildsNetworkFailure(cause);
      if (opaqueFailure) retryAfter.current = Date.now() + WILDS_NETWORK_RETRY_BACKOFF_MS;
      const offline = !shouldAttemptWildsNetwork() || opaqueFailure;
      const message = wildsNetworkFailureMessage(cause, "world", !offline);
      setMode((current) => wildsWorldModeAfterRequestFailure(offline, current));
      setError(message);
      throw new Error(message);
    } finally {
      commandPending.current = false;
      setPendingCommand(null);
    }
  }, [input.activeCard, input.cardAdmission, input.enabled, input.guestId, request]);

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
