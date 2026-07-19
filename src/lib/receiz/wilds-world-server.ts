import type { NextRequest } from "next/server";
import { WildsWorldService, type WildsWorldCommand } from "@/features/play/wilds-world-service";
import { findWildsWorldRecord, selectWildsWorldSnapshot } from "@/features/play/wilds-world-record";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { worldCommandRequiresCard } from "@/features/play/wilds-world-authority";
import { platform } from "@/lib/platform";
import { authorizeWildsMultiplayerCard, resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";
import { createReceizWildsWorldRepository, type WildsWorldPublication, type WildsWorldRepository } from "./wilds-world-repository";

export type { WildsWorldPublication } from "./wilds-world-repository";

function origin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function sourceUrl(request: NextRequest) {
  return `${origin(request)}/api/wilds/world/snapshot`;
}

const serviceKey = Symbol.for("receiz.wilds.world.service.v3");
const practiceKey = Symbol.for("receiz.wilds.world.practice.v3");
const hydrationKey = Symbol.for("receiz.wilds.world.hydrated.v3");
const repositoryKey = Symbol.for("receiz.wilds.world.repository.v3");
const mutationQueueKey = Symbol.for("receiz.wilds.world.mutation_queue.v3");
const WILDS_WORLD_GENESIS_PULSE = "2026-07-15T00:00:00.000Z";
type WorldGlobal = typeof globalThis & {
  [serviceKey]?: WildsWorldService;
  [practiceKey]?: WildsWorldService;
  [hydrationKey]?: Promise<void>;
  [repositoryKey]?: WildsWorldRepository;
  [mutationQueueKey]?: Promise<void>;
};
function root() { return globalThis as WorldGlobal; }
function service() { return (root()[serviceKey] ??= new WildsWorldService()); }
function repository() { return (root()[repositoryKey] ??= createReceizWildsWorldRepository()); }
function serializeWildsWorldMutation<T>(operation: () => Promise<T>) {
  const previous = root()[mutationQueueKey] ?? Promise.resolve();
  const result = previous.then(operation, operation);
  root()[mutationQueueKey] = result.then(() => undefined, () => undefined);
  return result;
}
function practiceService() {
  if (!root()[practiceKey]) {
    const practice = new WildsWorldService();
    const pulse = WILDS_WORLD_GENESIS_PULSE;
    practice.tick({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
    practice.tickEcology({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
    root()[practiceKey] = practice;
  }
  return root()[practiceKey]!;
}

export async function hydrateWildsWorldFromReceiz(request: NextRequest) {
  const existing = root()[hydrationKey];
  if (existing) return existing;
  const hydration = (async () => {
    const recovered = await Promise.race([
      repository().recover(sourceUrl(request)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_200))
    ]);
    const record = findWildsWorldRecord(recovered);
    if (record) {
      root()[serviceKey] = new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail });
    } else {
      delete root()[hydrationKey];
    }
  })();
  root()[hydrationKey] = hydration;
  try {
    await hydration;
  } catch {
    delete root()[hydrationKey];
  }
}

async function recoverCanonicalWorldBeforeMutation(request: NextRequest, actor?: WildsMultiplayerActor) {
  const local = service();
  const recovered = await Promise.race([
    repository().recover(sourceUrl(request), actor),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("wilds_world_recovery_timeout")), 1_200))
  ]);
  if (recovered) {
    const authoritative = new WildsWorldService({ checkpoint: recovered.checkpoint, events: recovered.eventTail });
    root()[serviceKey] = authoritative;
    return authoritative;
  }
  if (local.checkpoint().revision > 0) throw new Error("wilds_world_canonical_recovery_required");
  return local;
}

async function publish(
  request: NextRequest,
  actor: WildsMultiplayerActor,
  world: WildsWorldService,
  expectedHead: { revision: number; lastEventId: string | null }
): Promise<WildsWorldPublication> {
  return repository().publish({
    sourceUrl: sourceUrl(request),
    actor,
    record: { checkpoint: world.checkpoint(), eventTail: world.events() },
    expectedHead
  });
}

async function auditMajorEvents(request: NextRequest, actor: WildsMultiplayerActor, events: Parameters<WildsWorldRepository["audit"]>[0]["events"]) {
  return repository().audit({ sourceUrl: sourceUrl(request), actor, events });
}

function positiveCanonicalWorld(value: unknown) {
  const record = findWildsWorldRecord(value);
  if (!record || !Number.isSafeInteger(record.checkpoint.revision) || record.checkpoint.revision <= 0) return null;
  try {
    return { record, world: new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail }) };
  } catch {
    return null;
  }
}

/**
 * Joins an authenticated proof-session actor to the shared Receiz world. If
 * no canonical head exists yet, the first actor deterministically publishes
 * the same genesis pulse every other instance would derive.
 */
export function bootstrapWildsWorld(request: NextRequest) {
  return serializeWildsWorldMutation(async () => {
    let actor: WildsMultiplayerActor;
    try {
      actor = await resolveWildsMultiplayerActor(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "wilds_guest_identity_required") throw new Error("wilds_world_proof_session_required");
      throw error;
    }
    if (actor.practice) throw new Error("wilds_world_proof_session_required");
    let recovered;
    try {
      recovered = await repository().recover(sourceUrl(request), actor);
    } catch {
      throw new Error("wilds_world_canonical_recovery_required");
    }

    const existing = positiveCanonicalWorld(recovered);
    if (existing) {
      root()[serviceKey] = existing.world;
      return {
        projection: existing.world.snapshot(),
        mode: "receiz_live" as const,
        events: [],
        publication: {
          published: false,
          mode: "receiz_live" as const,
          revision: existing.record.checkpoint.revision,
          record: existing.record
        }
      };
    }

    const local = service();
    if (local.checkpoint().revision > 0) throw new Error("wilds_world_canonical_recovery_required");
    if (recovered && (
      recovered.checkpoint.revision !== 0
      || recovered.checkpoint.lastEventId !== null
      || recovered.eventTail.length > 0
    )) {
      throw new Error("wilds_world_canonical_recovery_required");
    }

    const current = recovered
      ? new WildsWorldService({ checkpoint: recovered.checkpoint, events: recovered.eventTail })
      : local;
    root()[serviceKey] = current;
    const before = { checkpoint: current.checkpoint(), events: current.events() };
    const worldTick = current.tick({
      pulse: WILDS_WORLD_GENESIS_PULSE,
      occurredAt: WILDS_WORLD_GENESIS_PULSE,
      systemActorId: "receiz:pulse"
    });
    const ecologyTick = current.tickEcology({
      pulse: WILDS_WORLD_GENESIS_PULSE,
      occurredAt: WILDS_WORLD_GENESIS_PULSE,
      systemActorId: "receiz:pulse"
    });
    const events = [...worldTick.events, ...ecologyTick.events];
    let publication: WildsWorldPublication;
    try {
      publication = await publish(request, actor, current, { revision: 0, lastEventId: null });
    } catch {
      root()[serviceKey] = new WildsWorldService(before);
      throw new Error("wilds_world_canonical_publish_required");
    }

    if (publication.published && publication.mode === "receiz_live") {
      return { projection: current.snapshot(), mode: "receiz_live" as const, events, publication };
    }

    const competing = publication.conflict ? positiveCanonicalWorld(publication.record) : null;
    if (competing) {
      root()[serviceKey] = competing.world;
      return {
        projection: competing.world.snapshot(),
        mode: "receiz_live" as const,
        events: [],
        publication: {
          ...publication,
          mode: "receiz_live" as const,
          revision: competing.record.checkpoint.revision,
          record: competing.record
        }
      };
    }

    root()[serviceKey] = new WildsWorldService(before);
    throw new Error("wilds_world_canonical_publish_required");
  });
}

export async function worldSnapshot(request: NextRequest) {
  if (request.cookies.get("wildz_proof_session")) {
    const actor = await resolveWildsMultiplayerActor(request);
    const recovered = await repository().recover(sourceUrl(request), actor);
    const canonical = positiveCanonicalWorld(recovered);
    if (!canonical) throw new Error("wilds_world_canonical_recovery_required");
    root()[serviceKey] = canonical.world;
    return { projection: canonical.world.snapshot(), mode: "receiz_live" as const };
  }
  await hydrateWildsWorldFromReceiz(request);
  return selectWildsWorldSnapshot(service().snapshot(), practiceService().snapshot());
}

export function executeWildsWorldCommand(request: NextRequest, body: unknown) {
  return serializeWildsWorldMutation(async () => {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const actor = await resolveWildsMultiplayerActor(request, value.guestId);
  const command = value.command as WildsWorldCommand;
  const card = worldCommandRequiresCard(command) ? value.card as PortableCardAsset | undefined : undefined;
  if (worldCommandRequiresCard(command)) authorizeWildsMultiplayerCard(actor, card, value.cardAdmission);
  await hydrateWildsWorldFromReceiz(request);
  if (actor.practice) {
    const now = new Date().toISOString();
    const result = practiceService().execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, card });
    const publication = { published: false, mode: "local_practice" as const, revision: result.projection.revision };
    return {
      projection: result.projection,
      mode: publication.mode,
      events: result.events,
      publication
    };
  }
  const current = await recoverCanonicalWorldBeforeMutation(request, actor);
  const before = { checkpoint: current.checkpoint(), events: current.events() };
  const now = new Date().toISOString();
  const result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, card });
  let publication = await publish(request, actor, current, {
    revision: before.checkpoint.revision,
    lastEventId: before.checkpoint.lastEventId
  });
  if (!publication.published) {
    root()[serviceKey] = publication.conflict && publication.record
      ? new WildsWorldService(publication.record)
      : new WildsWorldService(before);
    throw new Error("wilds_world_canonical_publish_required");
  }
  if (!await auditMajorEvents(request, actor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
  return { projection: result.projection, mode: publication.mode, events: result.events, publication };
  });
}

export function tickWildsWorld(request: NextRequest) {
  return serializeWildsWorldMutation(async () => {
  await hydrateWildsWorldFromReceiz(request);
  const current = await recoverCanonicalWorldBeforeMutation(request);
  const before = { checkpoint: current.checkpoint(), events: current.events() };
  const now = new Date().toISOString();
  const world = current.tick({ pulse: now, occurredAt: now, systemActorId: "receiz:pulse" });
  const ecology = current.tickEcology({ pulse: now, occurredAt: now, systemActorId: "receiz:pulse" });
  const result = { projection: ecology.projection, events: [...world.events, ...ecology.events] };
  const pulseActor = {
    playerId: "receiz:pulse",
    handle: "receiz:pulse",
    receizActorId: "receiz:pulse",
    practice: false
  } as const;
  let publication = await publish(request, pulseActor, current, {
    revision: before.checkpoint.revision,
    lastEventId: before.checkpoint.lastEventId
  });
  if (!publication.published) {
    root()[serviceKey] = publication.conflict && publication.record
      ? new WildsWorldService(publication.record)
      : new WildsWorldService(before);
    throw new Error("wilds_world_canonical_publish_required");
  }
  if (!await auditMajorEvents(request, pulseActor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
  return { projection: result.projection, mode: publication.mode, events: result.events, publication };
  });
}
