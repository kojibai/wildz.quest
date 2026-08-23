import type { NextRequest } from "next/server";
import type { JsonObject } from "@receiz/sdk";
import {
  admitWildsConversation,
  getWildsConversation,
  getWildsConversationsForActor
} from "@/features/play/wilds-messenger-ledger";
import {
  wildsConversationId,
  type WildsConversation,
  type WildsMessengerParticipant
} from "@/features/play/wilds-messenger-core";
import { hostContextFromHost } from "@/lib/hosting/host-context";
import { platform } from "@/lib/platform";
import { createReceizCommerceAdapter } from "./adapter";
import type { WildsMultiplayerActor } from "./wilds-multiplayer-server";

const hydrateKey = Symbol.for("receiz.wilds.messenger-hydration.v1");
const WILDS_MESSAGE_REMOTE_DEADLINE_MS = 900;
const WILDS_MESSAGE_HYDRATE_TTL_MS = 4_000;

function requestOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

export function wildsConversationSourceUrl(request: NextRequest, leftId: string, rightId: string) {
  return `${requestOrigin(request)}/api/wilds/messages/source/${encodeURIComponent(wildsConversationId(leftId, rightId))}`;
}

function hydratedUrls() {
  const root = globalThis as typeof globalThis & { [hydrateKey]?: Map<string, number> };
  return (root[hydrateKey] ??= new Map());
}

async function withDeadline<T>(work: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T | null>([
      work,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), WILDS_MESSAGE_REMOTE_DEADLINE_MS); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function findConversation(value: unknown): WildsConversation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schema === "receiz.wilds_conversation.v1" && typeof record.id === "string") {
    return record as WildsConversation;
  }
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const found = findConversation(record[key]);
    if (found) return found;
  }
  return null;
}

export async function hydrateWildsConversation(
  request: NextRequest,
  actor: WildsMultiplayerActor,
  peer: WildsMessengerParticipant
) {
  const self = { id: actor.playerId, handle: actor.handle };
  const sourceUrl = wildsConversationSourceUrl(request, actor.playerId, peer.id);
  const hydratedAt = hydratedUrls().get(sourceUrl) ?? 0;
  if (Date.now() - hydratedAt < WILDS_MESSAGE_HYDRATE_TTL_MS) return getWildsConversation(self, peer);
  hydratedUrls().set(sourceUrl, Date.now());
  try {
    const adapter = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
    const recovered = await withDeadline(adapter.readAppStateByUrl(sourceUrl));
    const conversation = findConversation(recovered);
    if (conversation?.id === wildsConversationId(actor.playerId, peer.id)) admitWildsConversation(conversation);
  } catch {
    hydratedUrls().delete(sourceUrl);
  }
  return getWildsConversation(self, peer);
}

export async function hydrateWildsMessengerInbox(actor: WildsMultiplayerActor) {
  if (actor.practice) return getWildsConversationsForActor(actor.playerId);
  try {
    const adapter = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
    const result = await withDeadline(adapter.client.appState.byCreator(actor.receizActorId));
    const candidates = result && typeof result === "object" && "records" in result && Array.isArray(result.records)
      ? result.records
      : [];
    for (const candidate of candidates) {
      const conversation = findConversation(candidate);
      if (conversation?.participants.some((participant) => participant.id === actor.playerId)) {
        admitWildsConversation(conversation);
      }
    }
  } catch {
    // The admitted local proof history remains usable while private sync retries.
  }
  return getWildsConversationsForActor(actor.playerId);
}

export async function publishWildsConversation(
  request: NextRequest,
  actor: WildsMultiplayerActor,
  conversation: WildsConversation
) {
  if (actor.practice) return { published: false, mode: "local_practice" as const };
  const peer = conversation.participants.find((participant) => participant.id !== actor.playerId);
  if (!peer) throw new Error("wilds_message_participant_required");
  const sourceUrl = wildsConversationSourceUrl(request, actor.playerId, peer.id);
  const hostContext = hostContextFromHost(new URL(sourceUrl).host);
  const tenantHost = hostContext.tenantHost ?? hostContext.host ?? platform.domain;
  try {
    const adapter = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
    const result = await withDeadline(adapter.client.appState.publish({
      tenantHost,
      creatorReceizId: actor.receizActorId,
      externalCreatorId: actor.receizActorId,
      title: `Wildz private conversation ${conversation.id}`,
      sourceUrl,
      namespace: conversation.id,
      projectionState: "published",
      visibility: "private",
      platform: platform.productName,
      state: conversation as unknown as JsonObject,
      data: conversation as unknown as JsonObject
    }, { idempotencyKey: `${conversation.id}:${conversation.revision}` }));
    return { published: Boolean(result?.ok), mode: result?.ok ? "receiz_synced" as const : "sync_pending" as const };
  } catch {
    return { published: false, mode: "sync_pending" as const };
  }
}
