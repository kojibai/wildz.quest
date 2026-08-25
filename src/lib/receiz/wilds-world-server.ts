import type { NextRequest } from "next/server";
import { WildsWorldService, type WildsWorldCommand } from "@/features/play/wilds-world-service";
import { findWildsWorldRecord, selectWildsWorldSnapshot, type WildsWorldRecord } from "@/features/play/wilds-world-record";
import { canonicalPortableCardJson, sha256PortableBasis } from "@/features/play/portable-card";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { verifyWildsWorldCommandKai, worldCommandRequiresCard } from "@/features/play/wilds-world-authority";
import { platform } from "@/lib/platform";
import { authorizeWildsMultiplayerCard, resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";
import { createReceizWildsWorldRepository, type WildsWorldPublication, type WildsWorldRepository } from "./wilds-world-repository";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { createWildsWorldIdentityPublicationDraft } from "./wilds-world-identity-publication";
import { createReceizCommerceAdapter } from "./adapter";
import { executeWildsLivingWorldV124, type WildsLivingWorldV124RuntimeInput } from "./wilds-living-world-v124-runtime";
import { prepareWildsLivingWorldAuthoritySession } from "./wilds-living-world-authority";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import {
  WILDS_LIVING_WORLD_REDUCER_DIGEST,
  WILDS_LIVING_WORLD_REGISTRY_DIGEST,
  wildsLivingWorldSuccessorHeads,
  wildsStewardWorldSuccessorHeads
} from "./wilds-world-emission-source";

export type { WildsWorldPublication } from "./wilds-world-repository";

type WildsWorldServerDependencies = Readonly<{
  executeLivingWorldV124?: (input: WildsLivingWorldV124RuntimeInput) => Promise<Readonly<{ status: string; reasonCode?: unknown }>>;
  prepareLivingWorldAuthorityV124?: typeof prepareWildsLivingWorldAuthoritySession;
}>;

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
    practice.tickGroves({ pulse, occurredAt: pulse, systemActorId: "receiz:pulse" });
    root()[practiceKey] = practice;
  }
  return root()[practiceKey]!;
}

function worldRecordContainsHead(record: WildsWorldRecord, candidate: { revision: number; lastEventId: string | null }) {
  if (candidate.revision === 0 && candidate.lastEventId === null) return true;
  if (candidate.revision === record.checkpoint.revision && candidate.lastEventId === record.checkpoint.lastEventId) return true;
  return candidate.revision < record.checkpoint.revision && candidate.lastEventId !== null
    && (record.eventTail.some((event) => event.eventId === candidate.lastEventId)
      || record.eventTail[0]?.previousEventId === candidate.lastEventId);
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
    const localRecord = { checkpoint: local.checkpoint(), eventTail: local.events() };
    if (localRecord.checkpoint.revision > recovered.checkpoint.revision && worldRecordContainsHead(localRecord, {
      revision: recovered.checkpoint.revision,
      lastEventId: recovered.checkpoint.lastEventId
    })) return local;
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
    const groveTick = current.tickGroves({
      pulse: WILDS_WORLD_GENESIS_PULSE,
      occurredAt: WILDS_WORLD_GENESIS_PULSE,
      systemActorId: "receiz:pulse"
    });
    const events = [...worldTick.events, ...ecologyTick.events, ...groveTick.events];
    const projection = current.snapshot();
    const record = { checkpoint: current.checkpoint(), eventTail: current.events() };
    if (actor.accessToken) {
      let publication = await publish(request, actor, current, { revision: 0, lastEventId: null });
      if (!publication.published) {
        root()[serviceKey] = publication.conflict && publication.record
          ? new WildsWorldService(publication.record)
          : new WildsWorldService(before);
        throw new Error("wilds_world_canonical_publish_required");
      }
      if (!await auditMajorEvents(request, actor, events)) publication = { ...publication, mode: "receiz_recovery_pending" };
      return { projection, mode: publication.mode, events, publication };
    }
    root()[serviceKey] = new WildsWorldService(before);
    return {
      projection,
      mode: "kai_live" as const,
      events,
      publication: {
        published: false as const,
        required: "identity_proof" as const,
        draft: createWildsWorldIdentityPublicationDraft({
          sourceUrl: sourceUrl(request),
          merchantReceizId: actor.handle,
          record,
          expectedHead: { revision: 0, lastEventId: null }
        })
      }
    };
  });
}

export async function worldSnapshot(request: NextRequest) {
  try {
    const recovered = await Promise.race([
      repository().recover(sourceUrl(request)),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_200))
    ]);
    const record = findWildsWorldRecord(recovered);
    if (record && record.checkpoint.revision >= service().checkpoint().revision) {
      root()[serviceKey] = new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail });
    }
  } catch {
    await hydrateWildsWorldFromReceiz(request);
  }
  const snapshot = selectWildsWorldSnapshot(service().snapshot(), practiceService().snapshot());
  if (snapshot.mode === "receiz_live") return snapshot;
  try {
    readWildzProofSessionCookie(request);
    return { projection: snapshot.projection, mode: "kai_live" as const };
  } catch {
    return snapshot;
  }
}

export function executeWildsWorldCommand(request: NextRequest, body: unknown, dependencies: WildsWorldServerDependencies = {}) {
  return serializeWildsWorldMutation(async () => {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const actor = await resolveWildsMultiplayerActor(request, value.guestId);
  const command = value.command as WildsWorldCommand;
  const kai = verifyWildsWorldCommandKai(command);
  const optionalHarvestCard = command.type === "resource.material.harvest" && value.card
    ? value.card as PortableCardAsset
    : undefined;
  const card = worldCommandRequiresCard(command) ? value.card as PortableCardAsset | undefined : optionalHarvestCard;
  if (card) authorizeWildsMultiplayerCard(actor, card, value.cardAdmission);
  else if (worldCommandRequiresCard(command)) authorizeWildsMultiplayerCard(actor, card, value.cardAdmission);
  await hydrateWildsWorldFromReceiz(request);
  if (actor.practice) {
    if (command.type === "structure.trail-shelter.build" || command.type === "structure.trail-bridge.build"
      || command.type === "construction.site.place" || command.type === "construction.site.contribute" || command.type === "construction.site.work") {
      throw new Error("wilds_world_steward_identity_required");
    }
    const now = new Date().toISOString();
    const practiceCommand = command.type === "grove.act" ? { ...command, amountPhiMicro: "0" } : command;
    const result = practiceService().execute(practiceCommand, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
    const publication = { published: false, mode: "local_practice" as const, revision: result.projection.revision };
    return {
      projection: result.projection,
      mode: publication.mode,
      events: result.events,
      publication
    };
  }
  let current = await recoverCanonicalWorldBeforeMutation(request, actor);
  const before = { checkpoint: current.checkpoint(), events: current.events() };
  const now = new Date().toISOString();
  let result;
  if (command.type === "grove.act" || command.type === "resource.material.harvest" || command.type === "structure.trail-shelter.build" || command.type === "structure.trail-bridge.build" || command.type === "construction.site.work") {
    const candidate = new WildsWorldService(before);
    result = candidate.execute(command, { actorId: actor.handle, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
    if (result.events.length > 0) {
      const operation = command.operation;
      const nextEmission = command.emission;
      const amountPhiMicro = command.amountPhiMicro;
      const currentGrove = command.type === "grove.act" ? current.snapshot().groves[command.grove.groveId] : null;
      const currentEmission = current.snapshot().worldEmission;
      const executionAuthority = value.receizExecution;
      // The candidate has already re-derived and verified the exact source,
      // operation, emission successor, and settlement proof. Receiz execution
      // is therefore an optional distribution of that source-authoritative
      // transition; it can never be a second grant or a rollback authority.
      if (executionAuthority && typeof executionAuthority === "object") {
        if (!operation || !nextEmission || !amountPhiMicro || (command.type === "grove.act" && !currentGrove) || !currentEmission) {
          throw new Error("wilds_living_world_source_proof_invalid");
        }
        const authorityRecord = executionAuthority as Record<string, unknown>;
        const rail = createReceizCommerceAdapter(actor.accessToken ? { accessToken: actor.accessToken } : undefined);
        try {
          const authoritySessionInput = await (dependencies.prepareLivingWorldAuthorityV124 ?? prepareWildsLivingWorldAuthoritySession)({
            rail,
            actor,
            executionProof: authorityRecord,
            operation: {
              operationId: operation.operationId,
              planDigest: operation.planDigest,
              semanticIdempotencyKey: operation.semanticIdempotencyKey,
              amountPhiMicro
            }
          });
          const heads = command.type === "grove.act"
            ? wildsLivingWorldSuccessorHeads({
                actorId: actor.handle,
                operation,
                currentCheckpoint: before.checkpoint,
                nextCheckpoint: candidate.checkpoint(),
                currentEmission,
                nextEmission,
                currentGrove: currentGrove!,
                nextGrove: command.grove
              })
            : wildsStewardWorldSuccessorHeads({
                actorId: actor.handle,
                operation,
                currentCheckpoint: before.checkpoint,
                nextCheckpoint: candidate.checkpoint(),
                currentEmission,
                nextEmission
              });
          await (dependencies.executeLivingWorldV124 ?? executeWildsLivingWorldV124)({
            rail: rail as unknown as WildsLivingWorldV124RuntimeInput["rail"],
            authoritySessionInput,
            operation,
            heads,
            amountPhiMicro,
            registryDigest: WILDS_LIVING_WORLD_REGISTRY_DIGEST,
            reducerDigest: WILDS_LIVING_WORLD_REDUCER_DIGEST,
            usdPerPhiMicrocents: typeof authorityRecord.usdPerPhiMicrocents === "string" ? authorityRecord.usdPerPhiMicrocents : "0",
            priceBasis: authorityRecord.priceBasis ?? {
              schema: "wildz.world-emission-price.v1",
              sourceProofDigest: sha256PortableBasis(canonicalPortableCardJson(currentEmission)),
              lawfulAward: true
            },
            attemptId: `wildz:${command.commandId}`
          });
        } catch {
          // Global distribution is retryable representation. The admitted
          // source proof remains authoritative and is published below.
        }
      }
    }
    current = candidate;
    root()[serviceKey] = candidate;
  } else if (command.type === "resource.transfer.admit") {
    if (!actor.accessToken || command.ownerReceizId !== actor.playerId) throw new Error("wilds_world_resource_transfer_authority_required");
    const rail = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const subject = await rail.subjectStateV122(command.subjectId);
    if (subject.subjectId !== command.subjectId || subject.head !== command.subjectHead
      || !sameWildzPlayerCoordinate(subject.ownerReceizId, actor.receizActorId)
      || !sameWildzPlayerCoordinate(subject.ownerReceizId, actor.handle)) {
      throw new Error("wilds_world_resource_transfer_source_invalid");
    }
    result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
  } else {
    result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
  }
  const record = { checkpoint: current.checkpoint(), eventTail: current.events() };
  if (actor.accessToken) {
    let publication = await publish(request, actor, current, {
      revision: before.checkpoint.revision,
      lastEventId: before.checkpoint.lastEventId
    });
    if (!publication.published) {
      if (publication.conflict && publication.record && !worldRecordContainsHead(record, {
        revision: publication.record.checkpoint.revision,
        lastEventId: publication.record.checkpoint.lastEventId
      })) {
        root()[serviceKey] = new WildsWorldService(publication.record);
        throw new Error("wilds_world_canonical_conflict");
      }
      // The source transition remains committed. The same command id can be
      // retried idempotently until its weaker global projection catches up.
      return { projection: result.projection, mode: "receiz_recovery_pending" as const, events: result.events, publication };
    }
    if (!await auditMajorEvents(request, actor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
    return { projection: result.projection, mode: publication.mode, events: result.events, publication };
  }
  root()[serviceKey] = new WildsWorldService(before);
  return {
    projection: result.projection,
    mode: "kai_live" as const,
    events: result.events,
    publication: {
      published: false as const,
      required: "identity_proof" as const,
      draft: createWildsWorldIdentityPublicationDraft({
        sourceUrl: sourceUrl(request),
        merchantReceizId: actor.handle,
        record,
        expectedHead: {
          revision: before.checkpoint.revision,
          lastEventId: before.checkpoint.lastEventId
        }
      })
    }
  };
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
  const groves = current.tickGroves({ pulse: now, occurredAt: now, systemActorId: "receiz:pulse" });
  const result = { projection: groves.projection, events: [...world.events, ...ecology.events, ...groves.events] };
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
