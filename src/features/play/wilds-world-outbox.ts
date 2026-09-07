import {
  createReceizOfflineProofQueue,
  type JsonObject,
  type ReceizOfflineProofQueueSnapshot,
  type ReceizOfflineProofQueueStorage
} from "@receiz/sdk";
import type { WildzVaultCardMembershipProof } from "@/lib/receiz/wildz-vault-card-admission";
import { createWildzContinuityDatabase } from "@/lib/storage/wildz-indexed-db";
import type { PortableCardAsset } from "./portable-card";
import { WildsWorldService, type WildsWorldCommand } from "./wilds-world-service";
import { checkpointWildsWorld, reduceWildsWorldEvent, replayWildsWorld, type WildsWorldCheckpoint, type WildsWorldProjection } from "./wilds-world-state";

import type { WildsWorldEvent } from "./wilds-world-event";
import { constructionProofDigest, verifyWildsConstructionProject, verifyWildsConstructionChunk } from "./wilds-construction-project";
import { isWildsEdgeImmediateConstructionCommand } from "./wilds-world-authority";

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
};

const OUTBOX_META_PREFIX = "receiz:wilds-world-outbox:v1:";
const continuity = createWildzContinuityDatabase();

function queueKey(actorId: string) {
  return `${OUTBOX_META_PREFIX}${actorId}`;
}

function defaultStorage(actorId: string): ReceizOfflineProofQueueStorage {
  const key = queueKey(actorId);
  return {
    read: () => continuity.read<ReceizOfflineProofQueueSnapshot>("meta", key),
    write: (snapshot) => continuity.transaction(["meta"], "readwrite", (tx) => tx.put("meta", snapshot, key)),
    remove: () => continuity.transaction(["meta"], "readwrite", (tx) => tx.delete("meta", key))
  };
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
  const resolved = resolveOutboxSources(snapshot, actorId);
  return snapshot.pending.filter((item) => item.kind === "wilds.world.command").map((item) => resolved.get(item.id) ?? item.payload.entry).filter((entry): entry is WildsWorldOutboxEntry => validEntry(entry, actorId));
}

export async function enqueueWildsWorldCommand(entry: WildsWorldOutboxEntry, storage?: ReceizOfflineProofQueueStorage) {
  return withOutboxMutation(entry.actorId, storage, async (resolved) => enqueueUnlocked(entry, resolved));
}

async function enqueueUnlocked(entry: WildsWorldOutboxEntry, storage: ReceizOfflineProofQueueStorage) {
  const queue = await createReceizOfflineProofQueue({ ownerId: entry.actorId, storage });
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
  return readWildsWorldOutbox(entry.actorId, storage);
}

export async function acknowledgeWildsWorldCommand(actorId: string, commandId: string, storage?: ReceizOfflineProofQueueStorage) {
  return withOutboxMutation(actorId, storage, async (resolved) => acknowledgeUnlocked(actorId, commandId, resolved));
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
  const next = (tails.get(actorId) ?? Promise.resolve()).catch(() => undefined).then(() => action(storage ?? defaultStorage(actorId)));
  tails.set(actorId, next);
  void next.finally(() => { if (tails.get(actorId) === next) tails.delete(actorId); }).catch(() => undefined);
  return next;
}

export function verifyWildsWorldAdmittedSource(entry: WildsWorldOutboxEntry, context?: WildsWorldProjection) {
  const source = entry.admittedSource;
  if (!source || source.events.length !== 1) throw new Error("wilds_world_admitted_source_required");
  const event = source.events[0]!;
  const expectedKinds: Record<string, string> = { "construction.project.create": "construction.project_created", "construction.component.place": "construction.component_placed", "construction.component.deposit": "construction.material_contributed", "construction.component.work": "construction.work_contributed" };
  if (event.kind !== expectedKinds[entry.command.type]) throw new Error("wilds_world_admitted_source_kind_mismatch");
  if (event.actorId !== entry.actorId || event.causeId !== entry.command.commandId || (event.payload as { commandDigest?: unknown } | null)?.commandDigest !== constructionProofDigest(entry.command)) throw new Error("wilds_world_admitted_source_mismatch");
  const base = source.checkpoint ? replayWildsWorld([], source.checkpoint) : context;
  if (!base) throw new Error("wilds_world_source_anchor_missing");
  return reduceWildsWorldEvent(base, event);
}

function prepareWildsWorldOutboxEntry(base: WildsWorldProjection, entry: WildsWorldOutboxEntry) {
  if (entry.admittedSource) {
    verifyWildsWorldAdmittedSource(entry, base);
    return { entry, projection: entry.admittedSource.events.reduce(reduceWildsWorldEvent, base) };
  }
  const world = new WildsWorldService({ checkpoint: checkpointWildsWorld(base) });
  const result = world.execute(entry.command, { actorId: entry.actorId, canonical: true, pulse: entry.queuedAt, occurredAt: entry.queuedAt, card: entry.card });
  return {
    entry: isWildsEdgeImmediateConstructionCommand(entry.command) && result.events.length
      ? { ...entry, admittedSource: { anchorId: entry.command.commandId, checkpoint: checkpointWildsWorld(base), events: result.events } }
      : entry,
    projection: result.projection
  };
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

export function preserveWildsConstructionHistory(current: WildsWorldProjection, candidate: WildsWorldProjection) {
  const same = (left: unknown, right: unknown) => constructionProofDigest(left ?? null) === constructionProofDigest(right ?? null);
  for (const key of ["constructionCommandReceipts", "constructionComponents", "constructionMaterialContributions", "constructionWorkContributions"] as const) {
    for (const [id, proof] of Object.entries(current[key])) if (!same(candidate[key]?.[id], proof)) return current;
  }
  for (const [id, proof] of Object.entries(current.constructionProjects)) {
    const next = candidate.constructionProjects?.[id];
    if (!next || !verifyWildsConstructionProject(next) || (!same(next, proof) && (next.parentHead !== proof.head || next.revision !== proof.revision + 1))) return current;
  }
  for (const [id, proof] of Object.entries(current.constructionChunks)) {
    const next = candidate.constructionChunks?.[id];
    if (!next || !verifyWildsConstructionChunk(next) || (!same(next, proof) && (next.parentHead !== proof.head || next.revision !== proof.revision + 1))) return current;
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
  onAdmitted?: (projection: WildsWorldProjection) => void;
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
    admit(entry: WildsWorldOutboxEntry): Promise<WildsWorldProjection> {
      // Clone intent now: callers cannot mutate an admission while storage is pending.
      const exact = structuredClone(entry);
      activeAdmissions += 1;
      const next = tail.catch(() => undefined).then(async () => {
        const prepared = prepareWildsWorldOutboxEntry(projection, exact);
        if (prepared.projection === projection || prepared.projection.revision === projection.revision) return projection;
        let durable = prepared.entry;
        if (durable.admittedSource && anchorId) durable = { ...durable, admittedSource: { anchorId, events: durable.admittedSource.events } };
        await input.persist(durable);
        if (durable.admittedSource) anchorId = durable.admittedSource.anchorId;
        else anchorId = null;
        projection = prepared.projection;
        input.onAdmitted?.(projection);
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
  const entries = [...resolveOutboxSources(snapshot, actorId).values()];
  return projectWildsWorldOutbox(base, actorId, entries);
}

/** Resolve the shared anchor transiently. Persisted successor envelopes contain only exact events. */
function resolveOutboxSources(snapshot: ReceizOfflineProofQueueSnapshot, actorId: string) {
  const entries = [...snapshot.settled, ...snapshot.pending].filter((item) => item.kind === "wilds.world.command").map((item) => item.payload.entry).filter((entry): entry is WildsWorldOutboxEntry => validEntry(entry, actorId));
  const anchors = new Map<string, WildsWorldProjection>();
  const resolved = new Map<string, WildsWorldOutboxEntry>();
  for (const entry of entries) {
    const source = entry.admittedSource;
    if (!source) { resolved.set(entry.command.commandId, entry); continue; }
    try {
      const base = source.checkpoint ? replayWildsWorld([], source.checkpoint) : anchors.get(source.anchorId);
      if (!base) throw new Error("wilds_world_source_anchor_missing");
      const projection = verifyWildsWorldAdmittedSource(entry, base);
      anchors.set(source.anchorId, projection);
      resolved.set(entry.command.commandId, { ...entry, admittedSource: { ...source, checkpoint: checkpointWildsWorld(base) } });
    } catch {
      // Keep unresolved source pending, never replace it with reconstructed intent.
      resolved.set(entry.command.commandId, entry);
    }
  }
  return resolved;
}
