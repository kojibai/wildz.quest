import type { NextRequest } from "next/server";
import type { JsonObject } from "@receiz/sdk";
import { WildsWorldService, type WildsWorldCommand } from "@/features/play/wilds-world-service";
import { findWildsWorldRecord } from "@/features/play/wilds-world-record";
import type { WildsWorldEvent } from "@/features/play/wilds-world-event";
import { platform } from "@/lib/platform";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";

export type WildsWorldPublication = { published: boolean; mode: "receiz_live" | "local_practice" | "receiz_recovery_pending"; revision: number };

function origin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function sourceUrl(request: NextRequest) {
  return `${origin(request)}/api/wilds/world/snapshot`;
}

const serviceKey = Symbol.for("receiz.wilds.world.service.v3");
const hydrationKey = Symbol.for("receiz.wilds.world.hydrated.v3");
type WorldGlobal = typeof globalThis & { [serviceKey]?: WildsWorldService; [hydrationKey]?: boolean };
function root() { return globalThis as WorldGlobal; }
function service() { return (root()[serviceKey] ??= new WildsWorldService()); }

export async function hydrateWildsWorldFromReceiz(request: NextRequest) {
  if (root()[hydrationKey]) return;
  root()[hydrationKey] = true;
  try {
    const recovered = await Promise.race([
      createReceizCommerceAdapter().readAppStateByUrl(sourceUrl(request)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_200))
    ]);
    const record = findWildsWorldRecord(recovered);
    if (record) root()[serviceKey] = new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail });
  } catch {
    root()[hydrationKey] = false;
  }
}

async function publish(request: NextRequest, actor: WildsMultiplayerActor, world: WildsWorldService): Promise<WildsWorldPublication> {
  if (actor.practice) return { published: false, mode: "local_practice", revision: world.snapshot().revision };
  const checkpoint = world.checkpoint();
  const lastEventId = checkpoint.lastEventId ?? "genesis";
  try {
    const result = await createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined).publishPublicStore({
      tenantHost: new URL(sourceUrl(request)).host,
      merchantReceizId: actor.handle,
      title: "Receiz Wilds canonical world",
      sourceUrl: sourceUrl(request),
      namespace: "wilds:global:v3",
      projectionState: "published",
      platform: platform.productName,
      state: { checkpoint, eventTail: world.events() } as unknown as JsonObject
    }, { idempotencyKey: `wilds:global:v3:${checkpoint.revision}:${lastEventId}` });
    if (result && typeof result === "object" && "ok" in result && result.ok === false) throw new Error("wilds_world_publish_failed");
    return { published: true, mode: "receiz_live", revision: checkpoint.revision };
  } catch {
    return { published: false, mode: "receiz_recovery_pending", revision: checkpoint.revision };
  }
}

async function auditMajorEvents(request: NextRequest, actor: WildsMultiplayerActor, events: readonly WildsWorldEvent[]) {
  const major = new Set(["boss.emerged", "boss.defeated", "site.memorialized", "team.created", "league.scored"]);
  const client = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
  try {
    for (const event of events.filter((candidate) => major.has(candidate.kind))) {
      await client.auditAppend({
        tenantHost: new URL(sourceUrl(request)).host,
        action: `wilds.${event.kind}:${event.eventId}`,
        actorReceizId: actor.handle
      }, { idempotencyKey: event.eventId });
    }
    return true;
  } catch {
    return false;
  }
}

export async function worldSnapshot(request: NextRequest) {
  await hydrateWildsWorldFromReceiz(request);
  return service().snapshot();
}

export async function executeWildsWorldCommand(request: NextRequest, body: unknown) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const actor = await resolveWildsMultiplayerActor(request, value.guestId);
  if (actor.practice) throw new Error("wilds_world_canonical_authority_required");
  await hydrateWildsWorldFromReceiz(request);
  const current = service();
  const before = { checkpoint: current.checkpoint(), events: current.events() };
  const command = value.command as WildsWorldCommand;
  const now = new Date().toISOString();
  const result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now });
  let publication = await publish(request, actor, current);
  if (!publication.published) {
    root()[serviceKey] = new WildsWorldService(before);
    throw new Error("wilds_world_canonical_publish_required");
  }
  if (!await auditMajorEvents(request, actor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
  return { projection: result.projection, events: result.events, publication };
}

export async function tickWildsWorld(request: NextRequest) {
  await hydrateWildsWorldFromReceiz(request);
  const current = service();
  const before = { checkpoint: current.checkpoint(), events: current.events() };
  const now = new Date().toISOString();
  const result = current.tick({ pulse: now, occurredAt: now, systemActorId: "receiz:pulse" });
  const pulseActor = { playerId: "receiz:pulse", handle: "receiz:pulse", practice: false } as const;
  let publication = await publish(request, pulseActor, current);
  if (!publication.published) {
    root()[serviceKey] = new WildsWorldService(before);
    throw new Error("wilds_world_canonical_publish_required");
  }
  if (!await auditMajorEvents(request, pulseActor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
  return { projection: result.projection, events: result.events, publication };
}
