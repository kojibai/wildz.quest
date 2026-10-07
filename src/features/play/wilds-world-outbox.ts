import { createWildsExactProofCache } from "./wilds-exact-proof-cache";
import { mergeWildsConstructionPersistence } from "./wilds-construction-persistence";
import { constitutionalDigest, type ConstitutionalDecision } from "./wilds-constitution";
import {
  createReceizOfflineProofQueue,
  type JsonObject,
  type ReceizOfflineProofQueueSnapshot,
  type ReceizOfflineProofQueueStorage
} from "@receiz/sdk";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import { createWildzContinuityDatabase, type WildzContinuityTransaction } from "@/lib/storage/wildz-indexed-db";
import { canonicalPortableCardJson, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { WildsWorldService, type WildsWorldCommand } from "./wilds-world-service";
import { checkpointWildsWorld, reduceWildsWorldEvent, replayWildsWorld, type WildsWorldCheckpoint, type WildsWorldProjection } from "./wilds-world-state";

import type { WildsWorldEvent } from "./wilds-world-event";
import { constructionProofDigest, verifyWildsConstructionProject, verifyWildsConstructionChunk } from "./wilds-construction-project";
import { isWildsEdgeImmediateConstructionCommand } from "./wilds-world-authority";
import { creationWorldEventMatches, isWorldCreationSuccessor, type WildsCreationBuildCommand } from './creation/world-source';

export type WildsWorldAdmittedSource = { anchorId: string; checkpoint?: WildsWorldCheckpoint; events: WildsWorldEvent[] };
export type WildsWorldOutboxEntry = {
  schema: "receiz.wilds_world_outbox_entry.v1";
  actorId: string;
  guestId: string;
  command: WildsWorldCommand;
  card?: PortableCardAsset;
  cardAdmission?: WildzVaultCardMembershipProof;
  queuedAt: string;
  admittedSource?: WildsWorldAdmittedSource;
  /** Immutable publication identity only; never grants worker authority. */
  crewCommandDigest?: string;
};

/** Preserve the explicitly selected worker even when the source law does not
 * itself require a card. This metadata cannot authorize a command. */
export function bindWildsCrewOutboxIdentity(entry:WildsWorldOutboxEntry,card:PortableCardAsset):WildsWorldOutboxEntry {
 return {...entry,card,crewCommandDigest:constitutionalDigest(entry.command)};
}

/** Crew admissions publish the exact durable command after reload, even when the
 * canonical source has advanced. A conflict must be recovered, never replanned. */
export function prepareWildsWorldOutboxPublication(entry: WildsWorldOutboxEntry, replan: (command: Extract<WildsWorldCommand, {type:"resource.material.harvest"}>) => WildsWorldCommand): WildsWorldOutboxEntry {
  if (entry.crewCommandDigest !== undefined) {
    if (entry.crewCommandDigest !== constitutionalDigest(entry.command)) throw new Error("wilds_crew_queued_command_changed");
    return entry;
  }
  return entry.command.type === "resource.material.harvest" ? {...entry, command:replan(entry.command)} : entry;
}

const OUTBOX_META_PREFIX = "receiz:wilds-world-outbox:v1:";
const continuity = createWildzContinuityDatabase();
function isCreationBuild(command: WildsWorldCommand | undefined): command is WildsCreationBuildCommand {
  return command?.type === 'creation.construct' || command?.type === 'creation.evolve';
}

function queueKey(actorId: string) {
  return `${OUTBOX_META_PREFIX}${actorId}`;
}

function defaultStorage(actorId: string, transaction?: WildzContinuityTransaction): ReceizOfflineProofQueueStorage {
  const key = queueKey(actorId);
  let readSnapshot: ReceizOfflineProofQueueSnapshot | null = null;
  let readInTransaction = false;
  const write = async (tx: WildzContinuityTransaction, snapshot: ReceizOfflineProofQueueSnapshot) => {
    // The SDK has already read this exact queue in the same readwrite
    // transaction. No other realm can change it before this write commits.
    const before = readInTransaction ? readSnapshot : await tx.get<ReceizOfflineProofQueueSnapshot>("meta", key);
    assertWildsCreationOutboxContinuity(before, snapshot);
    const previousIds = new Set([...(before?.pending ?? []), ...(before?.settled ?? [])].map(item => item.id));
    for (const item of [...snapshot.pending, ...snapshot.settled]) {
      const entry = item.payload.entry as WildsWorldOutboxEntry | undefined;
      if (previousIds.has(item.id) || !entry || !isCreationBuild(entry.command)) continue;
      for (const source of entry.command.workerSources) {
        const workerId = `creature:${sha256PortableBasis(source.card.id).slice(0, 32)}`;
        if (await tx.get("meta", JSON.stringify(["wildz.crew.v1", actorId, "creation-lease", workerId]))) throw Error("creation_world_worker_reserved");
        if (await tx.get("meta", JSON.stringify(["wildz.crew.jobs.v1", actorId, "worker", workerId]))) throw Error("creation_world_worker_busy");
        const head = await tx.get<string>("meta", JSON.stringify(["wildz.crew.v1", actorId, "worker", workerId]));
        const event = head ? await tx.get<{phase:string}>("meta", JSON.stringify(["wildz.crew.v1", actorId, "event", head])) : null;
        if (event && ["proposed", "pending"].includes(event.phase)) throw Error("creation_world_worker_pending");
      }
    }
    await tx.put("meta", snapshot, key);
    readSnapshot = snapshot;
    readInTransaction = Boolean(transaction);
  };
  return {
    async read() {
      if (!transaction) return continuity.read<ReceizOfflineProofQueueSnapshot>("meta", key);
      readSnapshot = await transaction.get<ReceizOfflineProofQueueSnapshot>("meta", key);
      readInTransaction = true;
      return readSnapshot;
    },
    write: (snapshot) => transaction ? write(transaction, snapshot) : continuity.transaction(["meta"], "readwrite", tx => write(tx, snapshot)),
    remove: () => transaction ? transaction.delete("meta", key) : continuity.transaction(["meta"], "readwrite", (tx) => tx.delete("meta", key))
  };
}

/** The default IDB writer calls this inside its transaction, preventing stale tabs
 * from erasing an admitted creation or spending a persisted finite lot twice. */
export function assertWildsCreationOutboxContinuity(before: ReceizOfflineProofQueueSnapshot | null, next: ReceizOfflineProofQueueSnapshot) {
  const rows = (snapshot: ReceizOfflineProofQueueSnapshot | null) => [...(snapshot?.pending ?? []), ...(snapshot?.settled ?? [])].map(item => item.payload.entry).filter((entry): entry is WildsWorldOutboxEntry => Boolean(entry && typeof entry === "object" && (entry as WildsWorldOutboxEntry).command && isCreationBuild((entry as WildsWorldOutboxEntry).command)));
  const previous = rows(before), current = rows(next);
  // SDK flush retains the entries read in this transaction. Identical objects
  // already have identical contents; independently supplied rows still compare exact digests.
  for (const entry of previous) if (!current.some(candidate => candidate.command.commandId === entry.command.commandId
    && (candidate === entry || constructionProofDigest(candidate) === constructionProofDigest(entry)))) throw Error("creation_world_durable_source_changed");
  const spent = new Map<string, string>();
  for (const entry of current) {
    if (!isCreationBuild(entry.command)) continue;
    for (const resource of entry.command.resources) {
      const existing = spent.get(resource.id);
      if (existing && existing !== entry.command.commandId) throw Error("creation_world_durable_material_conflict");
      spent.set(resource.id, entry.command.commandId);
    }
  }
}

function validEntry(value: unknown, actorId: string): value is WildsWorldOutboxEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<WildsWorldOutboxEntry>;
  return entry.schema === "receiz.wilds_world_outbox_entry.v1"
    && entry.actorId === actorId
    && typeof entry.guestId === "string"
    && Boolean(entry.command && typeof entry.command.commandId === "string")
    && typeof entry.queuedAt === "string";
}

export async function readWildsWorldOutbox(actorId: string, storage = defaultStorage(actorId)) {
  const queue = await createReceizOfflineProofQueue({ ownerId: actorId, storage });
  const snapshot = queue.snapshot();
  const pending = snapshot.pending.filter(item => item.kind === "wilds.world.command");
  if (!pending.length) return [];
  const pendingIds = new Set(pending.map(item => item.id));
  const resolved = new Map<string, WildsWorldOutboxEntry>();
  await visitWildsWorldStoredSources(snapshot, actorId, (entry, source) => {
    if (!pendingIds.has(entry.command.commandId)) return;
    resolved.set(entry.command.commandId, source
      ? { ...entry, admittedSource: { ...entry.admittedSource!, checkpoint: checkpointWildsWorld(source.base) } }
      : entry);
  });
  return pending.map((item) => resolved.get(item.id) ?? item.payload.entry).filter((entry): entry is WildsWorldOutboxEntry => validEntry(entry, actorId));
}

/** After terminating an uncertain worker, this storage read is the barrier for
 * its already-started IDB transactions. Pending and settled rows both preserve
 * exact command identity; an envelope cannot authorize different retry bytes.
 */
export async function readExactWildsWorldOutboxEntry(entry: WildsWorldOutboxEntry, storage = defaultStorage(entry.actorId)): Promise<WildsWorldOutboxEntry | null> {
  const queue = await createReceizOfflineProofQueue({ ownerId: entry.actorId, storage });
  const rows = [...queue.snapshot().pending, ...queue.snapshot().settled].filter(row => row.id === entry.command.commandId);
  if (!rows.length) return null;
  const intent = (value: WildsWorldOutboxEntry) => { const copy = { ...value }; delete copy.admittedSource; return constructionProofDigest(copy); };
  const expected = intent(entry);
  for (const row of rows) {
    const saved = row.payload.entry;
    if (row.kind !== 'wilds.world.command' || !validEntry(saved, entry.actorId) || saved.command.commandId !== entry.command.commandId || intent(saved) !== expected
      || entry.admittedSource && constructionProofDigest(saved.admittedSource || null) !== constructionProofDigest(entry.admittedSource)) throw Error('wilds_world_outbox_command_conflict');
  }
  return structuredClone(rows[0].payload.entry) as WildsWorldOutboxEntry;
}

export async function enqueueWildsWorldCommand(entry: WildsWorldOutboxEntry, storage?: ReceizOfflineProofQueueStorage) {
  return withOutboxMutation(entry.actorId, storage, async (resolved) => enqueueUnlocked(entry, resolved));
}

async function enqueueUnlocked(entry: WildsWorldOutboxEntry, storage: ReceizOfflineProofQueueStorage) {
  await persistUnlocked(entry, storage);
  return readWildsWorldOutbox(entry.actorId, storage);
}

/** Admission needs the durable append, not a second read of the queue. */
export async function persistWildsWorldCommandDurably(entry: WildsWorldOutboxEntry, storage?: ReceizOfflineProofQueueStorage) {
  await withOutboxMutation(entry.actorId, storage, async (resolved) => persistUnlocked(entry, resolved));
}

async function persistUnlocked(entry: WildsWorldOutboxEntry, storage: ReceizOfflineProofQueueStorage) {
  const queue = await createReceizOfflineProofQueue({ ownerId: entry.actorId, storage });
  if (isCreationBuild(entry.command)) {
    const snapshot = queue.snapshot();
    const selectedIds = new Set(entry.command.resources.map(resource => resource.id));
    for (const item of [...snapshot.pending, ...snapshot.settled]) {
      const candidate = item.payload.entry as WildsWorldOutboxEntry | undefined;
      if (candidate && isCreationBuild(candidate.command) && candidate.command.commandId !== entry.command.commandId
        && candidate.command.resources.some(resource => selectedIds.has(resource.id))) throw Error("creation_world_durable_material_conflict");
    }
  }
  const previous = [...queue.snapshot().pending, ...queue.snapshot().settled].find((item) => item.id === entry.command.commandId);
  if (previous && constructionProofDigest(previous.payload.entry) !== constructionProofDigest(entry)) throw new Error("wilds_world_outbox_command_conflict");
  queue.enqueue({
    id: entry.command.commandId,
    kind: "wilds.world.command",
    payload: { entry: entry as unknown as JsonObject },
    idempotencyKey: entry.command.commandId,
    createdAt: entry.queuedAt
  });
  await queue.flush();
}

export async function acknowledgeWildsWorldCommand(actorId: string, commandId: string, storage?: ReceizOfflineProofQueueStorage) {
  return withOutboxMutation(actorId, storage, async (resolved) => acknowledgeUnlocked(actorId, commandId, resolved));
}

/** A confirmed response settles only the exact request that produced it. */
export async function acknowledgeWildsWorldPublication(entry: WildsWorldOutboxEntry, publication: { commandId: string; globallyPublished: boolean }, storage?: ReceizOfflineProofQueueStorage) {
  if (publication.commandId !== entry.command.commandId) throw new Error("wilds_world_published_head_mismatch");
  return publication.globallyPublished
    ? acknowledgeWildsWorldCommand(entry.actorId, entry.command.commandId, storage)
    : readWildsWorldOutbox(entry.actorId, storage);
}

async function acknowledgeUnlocked(actorId: string, commandId: string, storage: ReceizOfflineProofQueueStorage) {
  const queue = await createReceizOfflineProofQueue({ ownerId: actorId, storage });
  const snapshot = queue.snapshot();
  const accepted = snapshot.pending.find((item) => item.id === commandId);
  if (!accepted) return readWildsWorldOutbox(actorId, storage);
  await storage.write({
    ...snapshot,
    updatedAt: new Date().toISOString(),
    pending: snapshot.pending.filter((item) => item.id !== commandId),
    settled: [...snapshot.settled, { ...accepted, attempts: (accepted.attempts ?? 0) + 1, lastError: null }]
  });
  return readWildsWorldOutbox(actorId, storage);
}


// One lock for all wrappers using default actor storage; injected storage is keyed by identity.
const defaultMutationTails = new Map<string, Promise<unknown>>();
const storageMutationTails = new WeakMap<ReceizOfflineProofQueueStorage, Map<string, Promise<unknown>>>();
function withOutboxMutation<T>(actorId: string, storage: ReceizOfflineProofQueueStorage | undefined, action: (storage: ReceizOfflineProofQueueStorage) => Promise<T>): Promise<T> {
  let tails = defaultMutationTails;
  if (storage) {
    if (!storageMutationTails.has(storage)) storageMutationTails.set(storage, new Map());
    tails = storageMutationTails.get(storage)!;
  }
  const next = (tails.get(actorId) ?? Promise.resolve()).catch(() => undefined).then(() => storage
    ? action(storage)
    : continuity.transaction(["meta"], "readwrite", tx => action(defaultStorage(actorId, tx))));
  tails.set(actorId, next);
  void next.finally(() => { if (tails.get(actorId) === next) tails.delete(actorId); }).catch(() => undefined);
  return next;
}

export function verifyWildsWorldAdmittedSource(entry: WildsWorldOutboxEntry, context?: WildsWorldProjection) {
  const source = entry.admittedSource;
  if (!source || source.events.length !== 1) throw new Error("wilds_world_admitted_source_required");
  const event = source.events[0]!;
  const expectedKinds: Record<string, string> = { "creation.construct": "creation.constructed", "creation.evolve": "creation.evolved", "construction.component.maintain": "construction.component_maintained", "construction.project.create": "construction.project_created", "construction.component.place": "construction.component_placed", "construction.burrow.dig": "construction.burrow_dug", "construction.component.adjust": "construction.component_adjusted", "construction.component.deposit": "construction.material_contributed", "construction.component.work": "construction.work_contributed" };
  if (event.kind !== expectedKinds[entry.command.type]) throw new Error("wilds_world_admitted_source_kind_mismatch");
  if (event.actorId !== entry.actorId || event.causeId !== entry.command.commandId || (event.payload as { commandDigest?: unknown } | null)?.commandDigest !== constructionProofDigest(entry.command)) throw new Error("wilds_world_admitted_source_mismatch");
  const base = source.checkpoint ? replayWildsWorld([], source.checkpoint) : context;
  if (!base) throw new Error("wilds_world_source_anchor_missing");
  return reduceWildsWorldEvent(base, event);
}

export function prepareWildsWorldOutboxEntry(base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) {
  if (entry.admittedSource) {
    verifyWildsWorldAdmittedSource(entry, base);
    return { entry, projection: entry.admittedSource.events.reduce(reduceWildsWorldEvent, base), events: entry.admittedSource.events, constitution: undefined as ConstitutionalDecision | undefined };
  }
  const checkpoint = checkpointWildsWorld(base);
  const world = new WildsWorldService({ checkpoint });
  const result = world.execute(entry.command, { actorId: entry.actorId, canonical: true, pulse: entry.queuedAt, occurredAt: entry.queuedAt, card: entry.card });
  return {
    entry: isWildsEdgeImmediateConstructionCommand(entry.command) && result.events.length
      ? { ...entry, admittedSource: { anchorId: anchorId ?? entry.command.commandId, ...(anchorId ? {} : { checkpoint }), events: result.events } }
      : entry,
    projection: result.projection, events: result.events, constitution: result.constitution
  };
}

function compactWildsWorldAdmissionAnchor(entry: WildsWorldOutboxEntry, anchorId?: string | null) {
  return entry.admittedSource && anchorId
    ? { ...entry, admittedSource: { anchorId, events: entry.admittedSource.events } }
    : entry;
}

/** Prepare and durably queue one ordinary action in a single worker request.
 * The projection must never be shown until the queue write has completed. */
export async function prepareAndPersistWildsWorldOutboxEntry(
  base: WildsWorldProjection,
  entry: WildsWorldOutboxEntry,
  anchorId?: string | null,
  persist: (entry: WildsWorldOutboxEntry) => Promise<unknown> = persistWildsWorldCommandDurably
): Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>> {
  const prepared = prepareWildsWorldOutboxEntry(base, entry, anchorId);
  if (prepared.projection === base || prepared.projection.revision === base.revision) return prepared;
  const durable = compactWildsWorldAdmissionAnchor(prepared.entry, anchorId);
  try { await persist(durable); }
  catch (cause) { throw new Error("wilds_world_local_persistence_failed", { cause }); }
  return durable === prepared.entry ? prepared : { ...prepared, entry: durable };
}

export function admitWildsWorldOutboxEntry(base: WildsWorldProjection, entry: WildsWorldOutboxEntry) {
  return prepareWildsWorldOutboxEntry(base, entry).projection;
}

export function projectWildsWorldOutbox(base: WildsWorldProjection, actorId: string, entries: WildsWorldOutboxEntry[]) {
  let projection = base;
  for (const entry of entries) {
    if (entry.actorId !== actorId) continue;
    try { projection = admitWildsWorldOutboxEntry(projection, entry); }
    catch {
      // Exact durable local source remains available even when remote history diverges.
      if (entry.admittedSource) {
        try { projection = preserveWildsConstructionHistory(verifyWildsWorldAdmittedSource(entry), projection); } catch { /* Invalid envelopes never acquire authority. */ }
      }
    }
  }
  return projection;
}

const historyProofCache = createWildsExactProofCache();

export function preserveWildsConstructionHistory(current: WildsWorldProjection, candidate: WildsWorldProjection) {
  const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left ?? null) === canonicalPortableCardJson(right ?? null);
  for (const [id, source] of Object.entries(current.creations ?? {})) {
    const next = candidate.creations?.[id];
    if (same(source, next)) {
      if (!same(current.creationEvents?.[id], candidate.creationEvents?.[id])) return current;
    } else {
      const priorEvent = current.creationEvents?.[id];
      if (!next || !isWorldCreationSuccessor(source, next) || !priorEvent || !same(priorEvent, candidate.creationEvents?.[priorEvent.eventId])
        || !next.history?.some(prior => prior.instance.head === source.instance.head && prior.eventId === priorEvent.eventId)
        || !creationWorldEventMatches(next, candidate.creationEvents?.[id])) return current;
    }
    for (const resource of source.instance.embeddedResources) if (candidate.consumedMaterialLots[resource.id] !== id) return current;
  }
  for (const [id, event] of Object.entries(current.creationEvents ?? {})) if (!current.creations?.[id] && !same(event, candidate.creationEvents?.[id])) return current;
  for (const key of ["constructionCommandReceipts", "constructionMaterialContributions", "constructionWorkContributions"] as const) {
    for (const [id, proof] of Object.entries(current[key])) if (!same(candidate[key]?.[id], proof)) return current;
  }
  for (const [id, prior] of Object.entries(current.constructionConditions ?? {})) {
    const next = candidate.constructionConditions?.[id];
    if (!next || (!same(prior, next) && !next.priorHeads.includes(prior.head))) return current;
  }
  for (const [lotId, consumption] of Object.entries(current.consumedMaterialLots)) {
    if (consumption.startsWith("repair:") && candidate.consumedMaterialLots[lotId] !== consumption) return current;
  }
  for(const [id,p] of Object.entries(current.burrows??{}))if(!same(p,candidate.burrows?.[id]))return current;
  const merged = mergeWildsConstructionPersistence(current,candidate);
  for (const id of Object.keys(current.constructionComponents)) {
    if (merged.constructionComponents[id]?.head !== candidate.constructionComponents[id]?.head) return current;
  }
  for (const [id, proof] of Object.entries(current.constructionProjects)) {
    const next = candidate.constructionProjects?.[id];
    if (!next || !historyProofCache.verify(next, verifyWildsConstructionProject) || (!same(next, proof) && (next.parentHead !== proof.head || next.revision !== proof.revision + 1))) return current;
  }
  for (const [id, proof] of Object.entries(current.constructionChunks)) {
    const next = candidate.constructionChunks?.[id];
    if (!next || !historyProofCache.verify(next, verifyWildsConstructionChunk) || (!same(next, proof) && (next.parentHead !== proof.head || next.revision !== proof.revision + 1))) return current;
  }
  for (const contribution of Object.values(current.constructionMaterialContributions)) {
    const id = contribution.lotId;
    if (!same(current.materialLots[id], candidate.materialLots[id])) return current;
    const consumed = current.consumedMaterialLots[id];
    const reserved = current.reservedMaterialLots[id];
    if (consumed && candidate.consumedMaterialLots[id] !== consumed) return current;
    if (reserved && candidate.reservedMaterialLots[id] !== reserved && candidate.consumedMaterialLots[id] !== reserved) return current;
  }
  return candidate.revision < current.revision ? current : candidate;
}

export function createWildsWorldEdgeAdmissionQueue(input: {
  initialProjection: WildsWorldProjection;
  persist: (entry: WildsWorldOutboxEntry) => Promise<unknown>;
  prepare?: (base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) => Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>>;
  prepareAndPersist?: (base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) => Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>>;
  onAdmitted?: (projection: WildsWorldProjection, entry: WildsWorldOutboxEntry, events: readonly WildsWorldEvent[], constitution?: ConstitutionalDecision) => void;
}) {
  let projection = input.initialProjection;
  let tail: Promise<unknown> = Promise.resolve();
  let activeAdmissions = 0;
  let anchorId: string | null = null;
  return {
    current: () => projection,
    adopt(candidate: WildsWorldProjection) {
      if (!activeAdmissions) {
        const accepted = preserveWildsConstructionHistory(projection, candidate);
        if (accepted.cursor?.eventId !== projection.cursor?.eventId) anchorId = null;
        projection = accepted;
      }
      return projection;
    },
    admit(entry: WildsWorldOutboxEntry, admission?: Readonly<{
      beforeAdmit(entry:WildsWorldOutboxEntry):Promise<void>;
      onAdmitted?(projection:WildsWorldProjection,events:readonly WildsWorldEvent[]):void;
    }>): Promise<WildsWorldProjection> {
      // Clone intent now: callers cannot mutate an admission while storage is pending.
      const exact = structuredClone(entry);
      activeAdmissions += 1;
      const next = tail.catch(() => undefined).then(async () => {
        // Crew admissions have an intervening custody CAS, so their preparation
        // and persistence must remain separate. Other actions use one worker hop.
        const fused = !admission && Boolean(input.prepareAndPersist);
        const prepared = fused
          ? await input.prepareAndPersist!(projection, exact, anchorId)
          : await (input.prepare ?? prepareWildsWorldOutboxEntry)(projection, exact, anchorId);
        if (prepared.projection === projection || prepared.projection.revision === projection.revision) return projection;
        const durable = compactWildsWorldAdmissionAnchor(prepared.entry, anchorId);
        if(admission){
          // A crew intent remains cancellable throughout asynchronous source planning.
          // The callback commits its pending CAS; persistence follows with no other await.
          if(canonicalPortableCardJson(durable.command)!==canonicalPortableCardJson(exact.command))throw new Error("wilds_crew_source_command_changed");
          await admission.beforeAdmit(structuredClone(exact));
        }
        if (!fused) await input.persist(durable);
        if (durable.admittedSource) anchorId = durable.admittedSource.anchorId;
        else anchorId = null;
        projection = prepared.projection;
        input.onAdmitted?.(projection, durable, prepared.events, prepared.constitution);
        admission?.onAdmitted?.(projection,prepared.events);
        return projection;
      });
      tail = next;
      return next.finally(() => { activeAdmissions -= 1; });
    }
  };
}

export async function drainWildsWorldOutbox(actorId: string, publish: (entry: WildsWorldOutboxEntry) => Promise<{ commandId: string; globallyPublished: boolean }>, storage?: ReceizOfflineProofQueueStorage) {
  let entries = await readWildsWorldOutbox(actorId, storage);
  while (entries.length) {
    const entry = entries[0]!;
    const result = await publish(entry);
    if (result.commandId !== entry.command.commandId) throw new Error("wilds_world_published_head_mismatch");
    if (!result.globallyPublished) break;
    entries = await acknowledgeWildsWorldCommand(actorId, entry.command.commandId, storage);
  }
  return entries;
}

/** Settled SDK envelopes also retain edge source after successful publication. */
export async function restoreWildsWorldEdgeSource(base: WildsWorldProjection, actorId: string, storage = defaultStorage(actorId)) {
  const queue = await createReceizOfflineProofQueue({ ownerId: actorId, storage });
  const snapshot = queue.snapshot();
  let projection = base;
  await visitWildsWorldStoredSources(snapshot, actorId, (entry, source) => {
    try {
      // The durable source was verified against its exact anchor above. Apply
      // the same event law to the current world without manufacturing another
      // full checkpoint only to immediately hash and verify it again.
      projection = source
        ? entry.admittedSource!.events.reduce(reduceWildsWorldEvent, projection)
        : admitWildsWorldOutboxEntry(projection, entry);
    } catch {
      if (source) projection = preserveWildsConstructionHistory(source.projection, projection);
      else if (entry.admittedSource) {
        try { projection = preserveWildsConstructionHistory(verifyWildsWorldAdmittedSource(entry), projection); } catch { /* Invalid sources never acquire authority. */ }
      }
    }
  });
  return projection;
}

/** Resolve exact durable anchors once using shared projection references,
 * never a full synthesized checkpoint for every historical action. Yield also
 * in workers so recovery remains responsive if the worker is unavailable. */
async function visitWildsWorldStoredSources(
  snapshot: ReceizOfflineProofQueueSnapshot,
  actorId: string,
  visit: (entry: WildsWorldOutboxEntry, source?: { base: WildsWorldProjection; projection: WildsWorldProjection }) => void
) {
  const pendingIds = new Set(snapshot.pending.map(item => item.id));
  const anchors = new Map<string, WildsWorldProjection>();
  type Resolved = { entry: WildsWorldOutboxEntry; source?: { base: WildsWorldProjection; projection: WildsWorldProjection } };
  const resolved = new Map<string, Resolved>();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  let sliceStarted = performance.now();
  for (const row of [...snapshot.settled, ...snapshot.pending]) {
    if (row.kind !== "wilds.world.command" || !validEntry(row.payload.entry, actorId)) continue;
    const entry = row.payload.entry;
    const source = entry.admittedSource;
    if (!source && !pendingIds.has(entry.command.commandId)) continue;
    let verified: { base: WildsWorldProjection; projection: WildsWorldProjection } | undefined;
    if (source) {
      try {
        const sourceBase = source.checkpoint ? replayWildsWorld([], source.checkpoint) : anchors.get(source.anchorId);
        if (!sourceBase) throw Error("wilds_world_source_anchor_missing");
        verified = { base: sourceBase, projection: verifyWildsWorldAdmittedSource(entry, sourceBase) };
        anchors.set(source.anchorId, verified.projection);
      } catch { /* Retain unresolved exact entries without granting an anchor. */ }
    }
    // Imported SDK snapshots can contain duplicate command IDs. Preserve the
    // existing last-source precedence and first-insertion replay order.
    resolved.set(entry.command.commandId, { entry, source: verified });
    if (performance.now() - sliceStarted >= 8) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      sliceStarted = performance.now();
    }
  }
  for (const value of resolved.values()) {
    visit(value.entry, value.source);
    if (performance.now() - sliceStarted >= 8) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      sliceStarted = performance.now();
    }
  }
}

/** Durable storage is still read on every call; only an exact unchanged source prefix is reused. */
export function createWildsWorldSourceResolver(options: { maxEntries?: number; maxBytes?: number } = {}) {
  type Cached = { key: string; value: string };
  type Resolved = { entry: WildsWorldOutboxEntry | null; projection?: WildsWorldProjection };
  let actor: string | null = null;
  let cached: Cached[] = [];
  let verifications = 0;
  let reused = 0;
  const maxEntries = options.maxEntries ?? 64;
  const maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  return {
    stats: () => ({ verifications, reused, entries: cached.length }),
    resolve(actorId: string, entries: readonly WildsWorldOutboxEntry[], pendingIds: ReadonlySet<string>) {
      if (actor !== actorId) { actor = actorId; cached = []; }
      const anchors = new Map<string, WildsWorldProjection>();
      const resolved = new Map<string, WildsWorldOutboxEntry>();
      const nextCache: Cached[] = [];
      let matchingPrefix = true;
      let bytes = 0;
      for (const [index, entry] of entries.entries()) {
        const source = entry.admittedSource;
        const key = JSON.stringify([entry, source ? null : pendingIds.has(entry.command.commandId)]);
        const prior = cached[index];
        let value: Resolved;
        if (matchingPrefix && prior?.key === key) {
          // Retain serialized values so callers cannot mutate cached proof authority.
          value = JSON.parse(prior.value) as Resolved;
          reused++;
        } else {
          matchingPrefix = false;
          value = { entry: source || pendingIds.has(entry.command.commandId) ? entry : null };
          if (source) {
            try {
              const base = source.checkpoint ? replayWildsWorld([], source.checkpoint) : anchors.get(source.anchorId);
              if (!base) throw new Error("wilds_world_source_anchor_missing");
              verifications++;
              const projection = verifyWildsWorldAdmittedSource(entry, base);
              value = { projection, entry: { ...entry, admittedSource: { ...source, checkpoint: checkpointWildsWorld(base) } } };
            } catch {
              // Unresolved entries retain their exact source and cannot acquire a cached anchor.
            }
          }
        }
        if (source && value.projection) anchors.set(source.anchorId, value.projection);
        if (value.entry) resolved.set(entry.command.commandId, value.entry);
        if (index === nextCache.length && index < maxEntries) {
          const serialized = matchingPrefix && prior?.key === key ? prior.value : JSON.stringify(value);
          const size = (key.length + serialized.length) * 2;
          if (bytes + size <= maxBytes) { nextCache.push({ key, value: serialized }); bytes += size; }
        }
      }
      cached = nextCache;
      return resolved;
    }
  };
}
