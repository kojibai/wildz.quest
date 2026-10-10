import { requireWildsResourceCustodyRail, assertWildsFoodGatherAdmission,resolveWildsResourceRecipientIdentity } from "./wilds-resource-custody-capability";
import { receizKaiNow } from "@receiz/sdk";
import { projectWildsResourcePackageSubjectAdmissionV122 } from "./wilds-resource-package";
import { projectWildsResourceSubjectAdmissionV122, projectWildsMaterialSubjectAdmissionV122 } from "./wilds-resource-transfer";
import { deriveKaiKlokMoment, KAI_PULSE_DURATION_MS } from "@/features/play/kai-klok-moment";
import type { NextRequest } from "next/server";
import { WildsWorldService, type WildsWorldCommand } from "@/features/play/wilds-world-service";
import { findWildsWorldRecord, selectWildsWorldSnapshot, type WildsWorldRecord } from "@/features/play/wilds-world-record";
import { canonicalPortableCardJson, sha256PortableBasis } from "@/features/play/portable-card";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { verifyWildsWorldCommandKai, worldCommandRequiresCard } from "@/features/play/wilds-world-authority";
import { platform } from "@/lib/platform";
import { authorizeWildsMultiplayerCard, resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";
import { createReceizWildsWorldRepository, type WildsWorldPublication, type WildsWorldRepository } from "./wilds-world-repository";
import { commitWildsConditionalWorldCandidate } from "./wilds-world-conditional-commit";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { createWildsWorldIdentityPublicationDraft } from "./wilds-world-identity-publication";
import { createReceizCommerceAdapter } from "./adapter";
import { executeWildsLivingWorldV124, type WildsLivingWorldV124RuntimeInput } from "./wilds-living-world-v124-runtime";
import { prepareWildsLivingWorldAuthoritySession } from "./wilds-living-world-authority";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { assertWildsLegacyResourceAdmission } from "@/features/play/wilds-legacy-package-history";
import {assertWildsResourcePackagePayingTrade,assertWildsResourcePackageCancelledListing,assertWildsResourcePackageReleasedTrade} from "./wilds-resource-package-market-authority";
import {
  WILDS_LIVING_WORLD_REDUCER_DIGEST,
  WILDS_LIVING_WORLD_REGISTRY_DIGEST,
  wildsLivingWorldSuccessorHeads,
  wildsStewardWorldSuccessorHeads
} from "./wilds-world-emission-source";
import { WILDS_WORLD_GENESIS_PULSE } from "@/features/play/wilds-world-genesis";

export type { WildsWorldPublication } from "./wilds-world-repository";

type WildsWorldServerDependencies = Readonly<{
  executeLivingWorldV124?: (input: WildsLivingWorldV124RuntimeInput) => Promise<Readonly<{ status: string; reasonCode?: unknown }>>;
  prepareLivingWorldAuthorityV124?: typeof prepareWildsLivingWorldAuthoritySession;
  resourcePackageMarketCoordinator?: true;
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
      const local = service();
      const localRecord = { checkpoint: local.checkpoint(), eventTail: local.events() };
      if (localRecord.checkpoint.revision === 0 || worldRecordContainsHead(record, {
        revision: localRecord.checkpoint.revision,
        lastEventId: localRecord.checkpoint.lastEventId
      })) {
        root()[serviceKey] = new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail });
      }
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
  let recovered: WildsWorldRecord | null = null;
  try {
    recovered = await Promise.race([
      repository().recover(sourceUrl(request), actor),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("wilds_world_recovery_timeout")), 1_200))
    ]);
  } catch {
    return local;
  }
  if (recovered) {
    const localRecord = { checkpoint: local.checkpoint(), eventTail: local.events() };
    if (localRecord.checkpoint.revision > 0 && !worldRecordContainsHead(recovered, {
      revision: localRecord.checkpoint.revision,
      lastEventId: localRecord.checkpoint.lastEventId
    })) return local;
    const authoritative = new WildsWorldService({ checkpoint: recovered.checkpoint, events: recovered.eventTail });
    root()[serviceKey] = authoritative;
    return authoritative;
  }
  return local;
}

async function recoverConditionalWorldBeforeMutation(request: NextRequest, actor: WildsMultiplayerActor) {
  const source = repository();
  if (!source.recoverConditional) throw Error("receiz_conditional_resource_custody_unavailable");
  const record = await Promise.race([
    source.recoverConditional(sourceUrl(request), actor),
    new Promise<never>((_, reject) => setTimeout(() => reject(Error("wilds_resource_custody_recovery_timeout")), 1_200))
  ]);
  const current = new WildsWorldService({ checkpoint: record.checkpoint, events: record.eventTail });
  // This is the verified source head, even when a former local projection fork
  // lacks ancestry in it. An unadmitted local branch cannot veto native custody.
  root()[serviceKey] = current;
  return current;
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
    let recovered = null;
    try {
      recovered = await repository().recover(sourceUrl(request), actor);
    } catch {}

    const existing = positiveCanonicalWorld(recovered);
    if (existing) {
      const local = service();
      const localHead = local.checkpoint();
      if (localHead.revision > 0 && !worldRecordContainsHead(existing.record, {
        revision: localHead.revision,
        lastEventId: localHead.lastEventId
      })) {
        return {
          projection: local.snapshot(),
          mode: "kai_live" as const,
          events: [],
          publication: { published: false as const, mode: "receiz_recovery_pending" as const, revision: localHead.revision }
        };
      }
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
    if (local.checkpoint().revision > 0) {
      return {
        projection: local.snapshot(),
        mode: "kai_live" as const,
        events: [],
        publication: { published: false as const, mode: "receiz_recovery_pending" as const, revision: local.checkpoint().revision }
      };
    }
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
        return { projection, mode: "receiz_recovery_pending" as const, events, publication };
      }
      if (!await auditMajorEvents(request, actor, events)) publication = { ...publication, mode: "receiz_recovery_pending" };
      return { projection, mode: publication.mode, events, publication };
    }
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

/** Custody preflights must use the verified source head. Public feeds and local
 * projections can predate package history and cannot authorize native claims. */
export function wildsResourceCustodySnapshot(request: NextRequest, actor: WildsMultiplayerActor) {
  if (actor.practice || !actor.accessToken) throw Error("wilds_resource_package_authority_required");
  return serializeWildsWorldMutation(async () => {
    const current = await recoverConditionalWorldBeforeMutation(request, actor);
    return { projection: current.snapshot(), mode: "receiz_live" as const };
  });
}

export async function worldSnapshot(request: NextRequest, actor?:WildsMultiplayerActor) {
  try {
    const recovered = await Promise.race([
      repository().recover(sourceUrl(request),actor),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_200))
    ]);
    const record = findWildsWorldRecord(recovered);
    const local = service();
    const localHead = local.checkpoint();
    if (record && (localHead.revision === 0 || worldRecordContainsHead(record, {
      revision: localHead.revision,
      lastEventId: localHead.lastEventId
    }))) {
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
  const command = value.command as WildsWorldCommand;
  if ((command?.type === "creation.construct" || command?.type === "creation.evolve") && command.workerSources?.some(source => source.nativeKeeper)) throw Error("wilds_native_world_keeper_source_required");
  if(command?.type?.startsWith("resource.package.market.") && dependencies.resourcePackageMarketCoordinator!==true)throw Error("wilds_resource_package_market_coordinator_required");
  const actor = await resolveWildsMultiplayerActor(request, value.guestId);
  const kai = verifyWildsWorldCommandKai(command);
  const conditionalResource = command.type.startsWith("resource.package.") || command.type === "resource.food.consume"
    || command.type === "resource.transfer.admit" || command.type === "resource.material.transfer.admit";
  if(conditionalResource && (actor.practice || !actor.accessToken))throw Error("wilds_resource_package_authority_required");
  if (command.type === "community.transition") {
    if (actor.practice) throw new Error("wilds_community:Restore your Identity Seal in Wildz before adopting or changing community rules.");
  }
  const optionalHarvestCard = command.type === "resource.material.harvest" && value.card
    ? value.card as PortableCardAsset
    : undefined;
  const card = worldCommandRequiresCard(command) ? value.card as PortableCardAsset | undefined : optionalHarvestCard;
  if (card) authorizeWildsMultiplayerCard(actor, card, value.cardAdmission);
  else if (worldCommandRequiresCard(command)) authorizeWildsMultiplayerCard(actor, card, value.cardAdmission);
  if (!conditionalResource) await hydrateWildsWorldFromReceiz(request);
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
      constitution: result.constitution,
      publication
    };
  }
  let current = conditionalResource ? await recoverConditionalWorldBeforeMutation(request, actor) : await recoverCanonicalWorldBeforeMutation(request, actor);
  const conditionalBase = conditionalResource ? current : null;
  if (command.type === "community.transition" && !current.snapshot().constitutionalCommandReceipts?.[command.commandId]) {
    const currentKai = deriveKaiKlokMoment({ occurredAt: new Date().toISOString(), authority: "world" }).uPulse;
    if (kai.authority === "local" || Math.abs(currentKai - kai.uPulse) > 120000 / KAI_PULSE_DURATION_MS * 1000000) throw new Error("wilds_community:Refresh the community clock before submitting this action.");
  }
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
          // The source work is still complete. With no lawful Phi successor
          // there is simply no settlement projection to distribute.
        } else {
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
    }
    current = candidate;
    root()[serviceKey] = candidate;
  } else if (command.type === "resource.transfer.admit" || command.type === "resource.material.transfer.admit") {
    if (!actor.accessToken || command.ownerReceizId !== actor.playerId) throw new Error("wilds_world_resource_transfer_authority_required");
    const rail = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    requireWildsResourceCustodyRail(rail);
    if(!current.snapshot().constitutionalCommandReceipts?.[command.commandId]){
      const nativeKai=receizKaiNow().uPulse;
      if(kai.authority==="local" || Math.abs(nativeKai-kai.uPulse)>120000/KAI_PULSE_DURATION_MS*1000000)throw Error("wilds_resource_package_native_clock_invalid");
    }
    const world = current.snapshot();
    assertWildsLegacyResourceAdmission(world, command.type === "resource.transfer.admit" ? "resource" : "material", command.lotId);
    const lot = command.type === "resource.transfer.admit" ? world.resourceLots[command.lotId] : world.materialLots[command.lotId];
    if (!lot || (command.type === "resource.transfer.admit" ? world.reservedResourceLots?.[command.lotId] : world.reservedMaterialLots[command.lotId] || world.consumedMaterialLots[command.lotId] || world.storedMaterialLots[command.lotId])) throw Error("wilds_world_resource_transfer_source_invalid");
    const projected = command.type === "resource.transfer.admit"
      ? await projectWildsResourceSubjectAdmissionV122(world.resourceLots[command.lotId]!,actor.receizActorId)
      : await projectWildsMaterialSubjectAdmissionV122(world.materialLots[command.lotId]!,actor.receizActorId);
    const subject = await rail.subjectStateV122(command.subjectId);
    const transfer = await rail.bearerTransferStatus(command.transferId);
    if (subject.subjectId !== projected.subjectId || subject.admittedProofDigest !== projected.admittedProofDigest || subject.head !== command.subjectHead
      || subject.ownerReceizId !== actor.receizActorId || transfer.status !== "claimed" || transfer.subjectId !== command.subjectId || transfer.receiptId !== command.receiptId) {
      throw new Error("wilds_world_resource_transfer_source_invalid");
    }
    current = new WildsWorldService(before);
    result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
  } else if (command.type.startsWith("resource.package.") || command.type === "resource.food.consume") {
    if (command.type === "resource.package.native-adopt") throw Error("wilds_native_resource_complete_receipt_required");
    if (!actor.accessToken || actor.practice) throw Error("wilds_resource_package_authority_required");
    const rail = createReceizCommerceAdapter({accessToken:actor.accessToken});
    requireWildsResourceCustodyRail(rail);
    if(!current.snapshot().constitutionalCommandReceipts?.[command.commandId]){
      const nativeKai=receizKaiNow().uPulse;
      if(kai.authority==="local" || Math.abs(nativeKai-kai.uPulse)>120000/KAI_PULSE_DURATION_MS*1000000)throw Error("wilds_resource_package_native_clock_invalid");
    }
    if(command.type==="resource.package.create")for(const member of command.package.members){
      if(member.kind==="food" && !current.snapshot().foodItems?.[member.id])await assertWildsFoodGatherAdmission(rail,member,actor.receizActorId,receizKaiNow().uPulse);
    }
    if (command.type !== "resource.package.create" && command.type !== "resource.food.consume" && "packageId" in command) {
      const packed = current.snapshot().resourcePackages?.[command.packageId];
      if (!packed) throw Error("wilds_resource_package_missing");
      const projected = await projectWildsResourcePackageSubjectAdmissionV122(packed.package,actor.receizActorId);
      if(command.type==="resource.package.market.pay"){
        const {createResourcePackageMarketRepository}=await import("./resource-package-market-repository");
        const market=await createResourcePackageMarketRepository(rail).load();
        if(market.status!=="ready")throw Error("wilds_resource_package_market_payment_required");
        const listing=assertWildsResourcePackagePayingTrade(market.state,{record:packed,packageId:command.packageId,listingId:command.listingId,tradeId:command.tradeId,
          subjectId:projected.subjectId,buyerReceizId:actor.receizActorId,buyerHandle:actor.handle});
        const subject=await rail.subjectStateV122(projected.subjectId),transfer=await rail.bearerTransferStatus(packed.offer!.transferId);
        if(subject.admittedProofDigest!==projected.admittedProofDigest || subject.ownerReceizId!==listing.sellerReceizUserId
          || transfer.subjectId!==projected.subjectId || transfer.instrumentDigest!==packed.offer!.artifactDigest || transfer.status!=="pending-acceptance")throw Error("wilds_resource_package_market_instrument_invalid");
      }
      if(command.type==="resource.package.market.unreserve"){
        const {createResourcePackageMarketRepository}=await import("./resource-package-market-repository");
        const market=await createResourcePackageMarketRepository(rail).load();
        if(market.status!=="ready")throw Error("wilds_resource_package_market_release_unconfirmed");
        assertWildsResourcePackageReleasedTrade(market.state,{record:packed,packageId:command.packageId,listingId:command.listingId,tradeId:command.tradeId,
          subjectId:projected.subjectId,buyerReceizId:actor.receizActorId,buyerHandle:actor.handle});
      }
      if (command.type === "resource.package.transfer.admit") {
        if(packed.transferId!==command.transferId && (!["offered","cancelling","settling"].includes(packed.status) || packed.offer?.transferId!==command.transferId))throw Error("wilds_resource_package_offer_binding_invalid");
        const subject=await rail.subjectStateV122(command.subjectId),transfer=await rail.bearerTransferStatus(command.transferId);
        if (command.subjectId!==projected.subjectId || subject.admittedProofDigest!==projected.admittedProofDigest || subject.ownerReceizId!==actor.receizActorId || subject.head!==command.subjectHead
          || transfer.status!=="claimed" || transfer.subjectId!==command.subjectId || transfer.receiptId!==command.receiptId) throw Error("wilds_resource_package_receipt_binding_invalid");
        if (["listed","reserved","settling"].includes(packed.status)) {
          const {createResourcePackageMarketRepository}=await import("./resource-package-market-repository");
          const market=await createResourcePackageMarketRepository(rail).load();
          const trade=market.status==="ready" && packed.tradeId ? market.state.trades[packed.tradeId] : null;
          const listing=market.status==="ready" && packed.listingId ? market.state.listings[packed.listingId] : null;
          if(packed.status!=="settling" || !trade || !listing || trade.status!=="paid" || !trade.payment || trade.buyerReceizUserId!==actor.receizActorId
            || listing.packageId!==command.packageId || listing.packageHead!==packed.package.head || listing.subjectId!==projected.subjectId)throw Error("wilds_resource_package_market_payment_required");
          const ledger=await rail.walletLedger({limit:100});
          if(!ledger.events.some(event=>event.id===trade.payment!.ledgerEventId && event.kind==="transfer" && event.amountUsdCents===String(listing.priceCents)
            && canonicalPortableCardJson(event.proofBundle)===canonicalPortableCardJson(trade.payment!.proofBundle)))throw Error("wilds_resource_package_market_payment_unconfirmed");
        }
      } else if(command.type==="resource.package.cancel.begin"){
        if(!["offered","cancelling"].includes(packed.status) || !sameWildzPlayerCoordinate(packed.ownerReceizId,actor.handle)
          || packed.subjectId!==projected.subjectId || packed.offer?.transferId!==command.transferId)throw Error("wilds_resource_package_cancel_invalid");
        const subject=await rail.subjectStateV122(projected.subjectId),transfer=await rail.bearerTransferStatus(command.transferId);
        if(subject.admittedProofDigest!==projected.admittedProofDigest || subject.ownerReceizId!==actor.receizActorId
          || transfer.subjectId!==projected.subjectId || transfer.instrumentDigest!==packed.offer.artifactDigest
          || !["pending-acceptance","cancelled","expired"].includes(transfer.status))throw Error("wilds_resource_package_cancel_invalid");
      } else if(command.type==="resource.package.plan-transfer"){
        if(!current.snapshot().constitutionalCommandReceipts?.[command.commandId]){
          const subject=await rail.subjectStateV122(projected.subjectId),plan=command.plan;
          const recipient=command.targetHandle?await resolveWildsResourceRecipientIdentity(rail,command.targetHandle):null;
          if(plan.subjectId!==projected.subjectId || plan.subjectDigest!==projected.admittedProofDigest || plan.currentOwnerReceizId!==actor.receizActorId
            || plan.expectedSubjectHead!==subject.head || subject.ownerReceizId!==actor.receizActorId || plan.policy.recipientReceizId!==recipient
            || plan.policy.openBearer!==(command.targetHandle===null))throw Error("wilds_resource_package_plan_invalid");
        }
      } else if(command.type==="resource.package.abort-transfer"){
        if(packed.transferPlan){
          const transfer=await rail.bearerTransferStatus(packed.transferPlan.transferId);
          if(command.transferId!==packed.transferPlan.transferId || transfer.subjectId!==projected.subjectId || !["cancelled","expired"].includes(transfer.status))throw Error("wilds_resource_package_cancel_unconfirmed");
        }else if(command.transferId!==null || packed.transferProtocol!=="plan-before-issue-v1")throw Error("wilds_resource_package_cancel_unconfirmed");
      } else if (command.type === "resource.package.offer") {
        const subject=await rail.subjectStateV122(command.subjectId),transfer=await rail.bearerTransferStatus(command.offer.transferId);
        if (command.subjectId!==projected.subjectId || subject.admittedProofDigest!==projected.admittedProofDigest || subject.ownerReceizId!==actor.receizActorId
          || transfer.subjectId!==command.subjectId || transfer.instrumentDigest!==command.offer.artifactDigest || transfer.status!=="pending-acceptance") throw Error("wilds_resource_package_offer_invalid");
      } else if (command.type === "resource.package.cancel-transfer" || command.type === "resource.package.market.release") {
        if(command.type==="resource.package.market.release" && packed.status!=="packed"){
          const {createResourcePackageMarketRepository}=await import("./resource-package-market-repository");
          const market=await createResourcePackageMarketRepository(rail).load();
          if(market.status!=="ready")throw Error("wilds_resource_package_market_cancellation_unavailable");
          assertWildsResourcePackageCancelledListing(market.state,{record:packed,packageId:command.packageId,listingId:command.listingId,subjectId:projected.subjectId,sellerReceizId:actor.receizActorId,sellerHandle:actor.handle});
        }
        if (packed.status!=="packed") {
          if (!packed.offer) throw Error("wilds_resource_package_cancel_invalid");
          const transfer=await rail.bearerTransferStatus(packed.offer.transferId);
          if (!['cancelled','expired'].includes(transfer.status) || transfer.subjectId!==projected.subjectId || transfer.instrumentDigest!==packed.offer.artifactDigest) throw Error("wilds_resource_package_cancel_unconfirmed");
        }
      } else if (command.type === "resource.package.unpack" && packed.subjectId) {
        const subject=await rail.subjectStateV122(packed.subjectId);
        if(subject.subjectId!==projected.subjectId || subject.admittedProofDigest!==projected.admittedProofDigest || subject.ownerReceizId!==actor.receizActorId) throw Error("wilds_resource_package_owner_invalid");
      }
    }
    current = new WildsWorldService(before);
    result=current.execute(command,{actorId:actor.handle,canonical:true,pulse:now,occurredAt:now,uPulse:kai.uPulse,card});
  } else {
    result = current.execute(command, { actorId: actor.playerId, canonical: true, pulse: now, occurredAt: now, uPulse: kai.uPulse, card });
  }
  const record = { checkpoint: current.checkpoint(), eventTail: current.events() };
  if (actor.accessToken) {
    const conditionalCommit = conditionalBase ? await commitWildsConditionalWorldCandidate({ repository: repository(), sourceUrl: sourceUrl(request), actor, before: conditionalBase, candidate: current, install: world => { root()[serviceKey] = world; } }) : null;
    let publication = conditionalCommit?.publication ?? await publish(request, actor, current, {
      revision: before.checkpoint.revision,
      lastEventId: before.checkpoint.lastEventId
    });
    if (!publication.published) {
      if (conditionalCommit) {
        return { projection: conditionalCommit.world.snapshot(), mode: "receiz_recovery_pending" as const, events: [], constitution: { ...result.constitution, publicationStatus: "PENDING" as const }, publication };
      }
      if (publication.conflict && publication.record && !worldRecordContainsHead(record, {
        revision: publication.record.checkpoint.revision,
        lastEventId: publication.record.checkpoint.lastEventId
      })) {
        // Keep both branches visible. Publication cannot retroactively erase admitted source work.
        return { projection: result.projection, mode: "receiz_recovery_pending" as const, events: result.events,
          constitution: { ...result.constitution, publicationStatus: "DISPUTED" as const }, publication,
          constitutionalFork: { status: "FORK" as const, source: record, competing: publication.record, resolution: "UNRESOLVED" as const } };

      }
      // The source transition remains committed. The same command id can be
      // retried idempotently until its weaker global projection catches up.
      return { projection: result.projection, mode: "receiz_recovery_pending" as const, events: result.events, constitution: result.constitution, publication };
    }
    if (!await auditMajorEvents(request, actor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
    return { projection: result.projection, mode: publication.mode, events: result.events, constitution: result.constitution, publication };
  }
  return {
    projection: result.projection,
    mode: "kai_live" as const,
    events: result.events,
    constitution: result.constitution,
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
  const result = { projection: groves.projection, events: [...world.events, ...ecology.events, ...groves.events], constitution: [world.constitution, ecology.constitution, groves.constitution] };
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
    return { projection: result.projection, mode: "receiz_recovery_pending" as const, events: result.events, constitution: result.constitution, publication };
  }
  if (!await auditMajorEvents(request, pulseActor, result.events)) publication = { ...publication, mode: "receiz_recovery_pending" };
  return { projection: result.projection, mode: publication.mode, events: result.events, constitution: result.constitution, publication };
  });
}
