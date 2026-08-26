import type { NextRequest } from "next/server";
import type { JsonObject } from "@receiz/sdk";
import {
  createWildsPlayerVault,
  mergeWildsPlayerPlayStates,
  verifyWildsPlayerVault,
  type WildsPlayerVaultPayload
} from "@/features/play/wilds-player-vault";
import { hostContextFromHost } from "@/lib/hosting/host-context";
import { platform } from "@/lib/platform";
import { createReceizCommerceAdapter } from "./adapter";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildsMultiplayerActor } from "./wilds-multiplayer-server";

export const WILDZ_PLAYER_STATE_SCHEMA = "receiz.wildz_player_state.v1" as const;

export type WildzPlayerStateRecord = {
  schema: typeof WILDZ_PLAYER_STATE_SCHEMA;
  playerId: string;
  revision: number;
  updatedAt: string;
  sourceDigest: string;
  previousSourceDigest: string | null;
  player: WildsPlayerVaultPayload;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function findWildzPlayerStateRecord(value: unknown): WildzPlayerStateRecord | null {
  const candidate = record(value);
  if (!candidate) return null;
  if (candidate.schema === WILDZ_PLAYER_STATE_SCHEMA) {
    const player = candidate.player as WildsPlayerVaultPayload;
    const verified = verifyWildsPlayerVault(player);
    if (typeof candidate.playerId === "string"
      && Number.isSafeInteger(candidate.revision)
      && Number(candidate.revision) > 0
      && typeof candidate.updatedAt === "string"
      && Number.isFinite(Date.parse(candidate.updatedAt))
      && typeof candidate.sourceDigest === "string"
      && candidate.sourceDigest === player?.payloadDigest
      && (candidate.previousSourceDigest === null || typeof candidate.previousSourceDigest === "string")
      && verified.ok
      && sameWildzPlayerCoordinate(candidate.playerId, player.playerId)) {
      return candidate as WildzPlayerStateRecord;
    }
    return null;
  }
  for (const key of ["state", "data", "record", "appState", "result", "storeStateRecord"]) {
    const found = findWildzPlayerStateRecord(candidate[key]);
    if (found) return found;
  }
  return null;
}

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function wildzPlayerStateSourceUrl(request: NextRequest, playerId: string) {
  return `${requestOrigin(request)}/api/wilds/player-state/source/${encodeURIComponent(playerId)}`;
}

function mergedRecords<T>(left: readonly T[], right: readonly T[], key: (value: T) => string) {
  const merged = new Map<string, T>();
  for (const value of left) merged.set(key(value), value);
  for (const value of right) merged.set(key(value), value);
  return [...merged.values()];
}

export function convergeWildzPlayerState(input: {
  actorId: string;
  current: WildzPlayerStateRecord | null;
  incoming: WildsPlayerVaultPayload;
  now: string;
}): WildzPlayerStateRecord {
  const verified = verifyWildsPlayerVault(input.incoming);
  if (!verified.ok || !sameWildzPlayerCoordinate(input.actorId, input.incoming.playerId)) {
    throw new Error("wildz_player_state_source_invalid");
  }
  const current = input.current;
  if (current && !sameWildzPlayerCoordinate(input.actorId, current.playerId)) {
    throw new Error("wildz_player_state_owner_invalid");
  }
  if (current?.sourceDigest === input.incoming.payloadDigest) return current;
  const incomingIsNewest = !current
    || Date.parse(input.incoming.exportedAt) >= Date.parse(current.player.exportedAt);
  const preferred = incomingIsNewest ? input.incoming : current!.player;
  const other = incomingIsNewest ? current?.player : input.incoming;
  const playState = other
    ? mergeWildsPlayerPlayStates({
        local: preferred.playState,
        restored: other.playState,
        actorId: input.actorId,
        preferLocalState: true
      })
    : preferred.playState;
  const player = createWildsPlayerVault({
    playerId: preferred.playerId,
    exportedAt: input.now,
    playState,
    character: preferred.character,
    settings: preferred.settings,
    personalEvents: mergedRecords(
      current?.player.personalEvents ?? [],
      input.incoming.personalEvents,
      (event) => event.eventId
    ),
    canonicalCursor: current && current.player.canonicalCursor.revision > input.incoming.canonicalCursor.revision
      ? current.player.canonicalCursor
      : input.incoming.canonicalCursor,
    receipts: mergedRecords(
      current?.player.receipts ?? [],
      input.incoming.receipts,
      (receipt) => receipt.eventId
    )
  });
  return {
    schema: WILDZ_PLAYER_STATE_SCHEMA,
    playerId: input.actorId,
    revision: (current?.revision ?? 0) + 1,
    updatedAt: new Date(Date.parse(input.now)).toISOString(),
    sourceDigest: player.payloadDigest,
    previousSourceDigest: current?.sourceDigest ?? null,
    player
  };
}

export async function loadWildzPlayerState(request: NextRequest, actor: WildsMultiplayerActor) {
  if (actor.practice) throw new Error("wildz_player_state_identity_required");
  const adapter = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
  return findWildzPlayerStateRecord(await adapter.readAppStateByUrl(
    wildzPlayerStateSourceUrl(request, actor.playerId)
  ));
}

export async function publishWildzPlayerState(
  request: NextRequest,
  actor: WildsMultiplayerActor,
  incoming: WildsPlayerVaultPayload
) {
  if (actor.practice) throw new Error("wildz_player_state_identity_required");
  const adapter = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
  const sourceUrl = wildzPlayerStateSourceUrl(request, actor.playerId);
  const current = findWildzPlayerStateRecord(await adapter.readAppStateByUrl(sourceUrl).catch(() => null));
  const next = convergeWildzPlayerState({ actorId: actor.playerId, current, incoming, now: new Date().toISOString() });
  if (next === current) return current;
  const hostContext = hostContextFromHost(new URL(sourceUrl).host);
  const tenantHost = hostContext.tenantHost ?? hostContext.host ?? platform.domain;
  const result = await adapter.client.appState.publish({
    tenantHost,
    creatorReceizId: actor.receizActorId,
    externalCreatorId: actor.playerId,
    title: "Wildz private Receiz ID continuity",
    sourceUrl,
    namespace: `wildz:player-state:v1:${actor.playerId}`,
    projectionState: "published",
    visibility: "private",
    platform: platform.productName,
    state: next as unknown as JsonObject,
    data: next as unknown as JsonObject
  }, { idempotencyKey: `wildz:player-state:${actor.playerId}:${next.sourceDigest}` });
  if (!result?.ok) throw new Error("wildz_player_state_sync_pending");
  const admitted = findWildzPlayerStateRecord(await adapter.readAppStateByUrl(sourceUrl));
  if (!admitted || admitted.sourceDigest !== next.sourceDigest) {
    throw new Error("wildz_player_state_sync_unconfirmed");
  }
  return admitted;
}
