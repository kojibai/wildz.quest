import type { NextRequest } from "next/server";
import type { JsonObject } from "@receiz/sdk";
import { pvpCardFromAsset } from "@/features/play/multiplayer-card";
import { admitWildsMultiplayerRoom, restoreWildsMultiplayerRoom, type WildsMultiplayerRoom, type WildsMultiplayerSnapshot } from "@/features/play/multiplayer-ledger";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { hostContextFromHost } from "@/lib/hosting/host-context";
import { platform } from "@/lib/platform";
import { createReceizCommerceAdapter } from "./adapter";
import { loadReceizConnectProfile } from "./connect-profile";
import { playerReceizAccessToken, receizRequestSession } from "./session";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { readWildzProofSessionCookie, wildzProofPrincipalId } from "./wildz-proof-session";
import { verifyWildzVaultCardMembershipProof } from "./wildz-vault-card-admission";

export type WildsMultiplayerActor = {
  playerId: string;
  handle: string;
  receizActorId: string;
  practice: boolean;
  accessToken?: string;
  vaultCardRootSha256?: string;
};

function stringValue(value: unknown, maxLength = 200) {
  return typeof value === "string" && value.length <= maxLength ? value : "";
}

export function parseWildsRoomKey(value: unknown) {
  const roomKey = stringValue(value, 160);
  if (!/^(?:wilds:[a-z0-9.:-]+:-?\d+:-?\d+|invite:[a-f0-9]{16})$/i.test(roomKey)) throw new Error("wilds_room_invalid");
  return roomKey;
}

export async function resolveWildsMultiplayerActor(request: NextRequest, guestValue?: unknown): Promise<WildsMultiplayerActor> {
  const playerToken = playerReceizAccessToken(receizRequestSession(request));
  try {
    const proofSession = readWildzProofSessionCookie(request);
    const principalId = wildzProofPrincipalId(proofSession);
    let matchingAccessToken: string | undefined;
    let matchingReceizActorId: string | undefined;
    if (playerToken) {
      const profile = await loadReceizConnectProfile(playerToken).catch(() => null);
      if (profile?.handle && sameWildzPlayerCoordinate(profile.handle, proofSession.profileHandle)) {
        matchingAccessToken = playerToken;
        matchingReceizActorId = profile.id || profile.handle;
      }
    }
    return {
      playerId: principalId,
      handle: proofSession.profileHandle,
      receizActorId: matchingReceizActorId ?? principalId,
      practice: false,
      ...(matchingAccessToken ? { accessToken: matchingAccessToken } : {}),
      ...(proofSession.vaultCardRootSha256
        ? { vaultCardRootSha256: proofSession.vaultCardRootSha256 }
        : {})
    };
  } catch {
    // Legacy scoped Connect sessions remain accepted during migration.
  }
  if (playerToken) {
    const profile = await loadReceizConnectProfile(playerToken).catch(() => null);
    if (profile?.handle) return {
      playerId: profile.handle,
      handle: profile.handle,
      receizActorId: profile.id || profile.handle,
      practice: false,
      accessToken: playerToken
    };
  }
  const guestId = stringValue(guestValue, 64);
  if (!/^[a-z0-9-]{8,64}$/i.test(guestId)) throw new Error("wilds_guest_identity_required");
  const suffix = guestId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return {
    playerId: `guest:${guestId}`,
    handle: `Explorer ${suffix}`,
    receizActorId: `guest:${guestId}`,
    practice: true
  };
}

export function authorizeWildsMultiplayerCard(actor: WildsMultiplayerActor, value: unknown, admission?: unknown) {
  if (!value || typeof value !== "object") throw new Error("wilds_multiplayer_card_required");
  const asset = value as PortableCardAsset;
  const owner = asset.manifest?.ownerReceizId;
  const directlyOwned = sameWildzPlayerCoordinate(owner ?? "", actor.handle);
  const admittedFromVault = !actor.practice
    && !directlyOwned
    && Boolean(actor.vaultCardRootSha256)
    && verifyWildzVaultCardMembershipProof({
      expectedRoot: actor.vaultCardRootSha256!,
      expectedPlayerHandle: actor.handle,
      card: asset,
      proof: admission
    });
  if (!actor.practice && !directlyOwned && !admittedFromVault) {
    throw new Error("wilds_multiplayer_card_owner_invalid");
  }
  return pvpCardFromAsset(asset);
}

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function multiplayerSourceUrl(request: NextRequest, roomKey: string) {
  return `${requestOrigin(request)}/api/wilds/multiplayer/snapshot?room=${encodeURIComponent(roomKey)}`;
}

function findRoomRecord(value: unknown): WildsMultiplayerRoom | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schema === "receiz.wilds_multiplayer_room.v1" && typeof record.roomKey === "string") return record as WildsMultiplayerRoom;
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const found = findRoomRecord(record[key]);
    if (found) return found;
  }
  return null;
}

const hydrateKey = Symbol.for("receiz.wilds.multiplayer-hydration.v2");
function hydratedUrls() {
  const root = globalThis as typeof globalThis & { [hydrateKey]?: Map<string, number> };
  return (root[hydrateKey] ??= new Map());
}

export async function hydrateWildsRoomFromReceiz(request: NextRequest, roomKey: string) {
  const sourceUrl = multiplayerSourceUrl(request, roomKey);
  const hydratedAt = hydratedUrls().get(sourceUrl) ?? 0;
  if (Date.now() - hydratedAt < 1_000) return;
  hydratedUrls().set(sourceUrl, Date.now());
  try {
    const recovered = await Promise.race([
      createReceizCommerceAdapter().readAppStateByUrl(sourceUrl),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_200))
    ]);
    const room = findRoomRecord(recovered);
    if (room?.roomKey === roomKey) admitWildsMultiplayerRoom(room);
  } catch {
    hydratedUrls().delete(sourceUrl);
    // Retain the last visible room; the next verified write retries publication.
  }
}

export async function publishWildsRoomToReceiz(request: NextRequest, actor: WildsMultiplayerActor, room: WildsMultiplayerSnapshot) {
  if (actor.practice) return { published: false, mode: "local_practice" as const };
  const sourceUrl = multiplayerSourceUrl(request, room.roomKey);
  const hostContext = hostContextFromHost(new URL(sourceUrl).host);
  const tenantHost = hostContext.tenantHost ?? hostContext.host ?? platform.domain;
  try {
    const result = await createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined).publishPublicStore({
      tenantHost,
      merchantReceizId: actor.receizActorId,
      title: `Receiz Wilds live room ${room.roomKey}`,
      sourceUrl,
      namespace: room.roomKey,
      projectionState: "published",
      platform: platform.productName,
      state: room as unknown as JsonObject
    }, { idempotencyKey: `${room.roomKey}:${room.revision}` });
    const failed = Boolean(result && typeof result === "object" && "ok" in result && result.ok === false);
    return { published: !failed, mode: "receiz_live" as const };
  } catch {
    return { published: false, mode: "receiz_recovery_pending" as const };
  }
}

export async function commitWildsRoomToReceiz(
  request: NextRequest,
  actor: WildsMultiplayerActor,
  previous: WildsMultiplayerRoom,
  room: WildsMultiplayerSnapshot
) {
  const publication = await publishWildsRoomToReceiz(request, actor, room);
  if (!actor.practice && !publication.published) {
    restoreWildsMultiplayerRoom(previous);
    throw new Error("wilds_multiplayer_publication_required");
  }
  return publication;
}
