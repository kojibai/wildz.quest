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
import { checkpointWildsWorld, type WildsWorldProjection } from "./wilds-world-state";

export type WildsWorldOutboxEntry = {
  schema: "receiz.wilds_world_outbox_entry.v1";
  actorId: string;
  guestId: string;
  command: WildsWorldCommand;
  card?: PortableCardAsset;
  cardAdmission?: WildzVaultCardMembershipProof;
  queuedAt: string;
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
  return queue.snapshot().pending
    .filter((item) => item.kind === "wilds.world.command")
    .map((item) => item.payload.entry)
    .filter((entry): entry is WildsWorldOutboxEntry => validEntry(entry, actorId));
}

export async function enqueueWildsWorldCommand(entry: WildsWorldOutboxEntry, storage = defaultStorage(entry.actorId)) {
  const queue = await createReceizOfflineProofQueue({ ownerId: entry.actorId, storage });
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

export async function acknowledgeWildsWorldCommand(actorId: string, commandId: string, storage = defaultStorage(actorId)) {
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

export function projectWildsWorldOutbox(base: WildsWorldProjection, actorId: string, entries: WildsWorldOutboxEntry[]) {
  const world = new WildsWorldService({ checkpoint: checkpointWildsWorld(base) });
  for (const entry of entries) {
    try {
      world.execute(entry.command, {
        actorId,
        canonical: true,
        pulse: entry.queuedAt,
        occurredAt: entry.queuedAt,
        card: entry.card
      });
    } catch {
      // Preserve the exact command for canonical validation after remote
      // additions are recovered; never silently rewrite or discard it.
    }
  }
  return world.snapshot();
}
