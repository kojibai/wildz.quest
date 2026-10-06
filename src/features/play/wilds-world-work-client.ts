import type { WildsWorldWork } from "./wilds-world-work";
import { prepareAndPersistWildsWorldOutboxEntry, prepareWildsWorldOutboxEntry, persistWildsWorldCommandDurably, readExactWildsWorldOutboxEntry, readWildsWorldOutbox as readOutbox, acknowledgeWildsWorldCommand as acknowledgeOutbox, restoreWildsWorldEdgeSource as restoreOutbox } from "./wilds-world-outbox";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { ReceizOfflineProofQueueStorage } from '@receiz/sdk';

type Reply = { id: number } & ({ ok: true; value: unknown } | { ok: false; error: string });
type FusedAdmissionWork = { kind: "prepare-persist"; base: WildsWorldProjection; entry: WildsWorldOutboxEntry; anchorId?: string | null };
type WorkerWork = WildsWorldWork | FusedAdmissionWork;
type WorkPort = {
  onmessage: ((event: MessageEvent<Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror?: ((event: MessageEvent) => void) | null;
  postMessage(message: { id: number; work: WorkerWork }): void;
  terminate(): void;
};

/** Keep checkpoint hashing, source replay and IndexedDB envelope cloning off the rendering thread. */
export function createWildsWorldWorkerClient(createWorker?: () => WorkPort, options: { deadlineMs?: number; storage?: ReceizOfflineProofQueueStorage } = {}) {
  const deadlineMs = options.deadlineMs ?? 15000;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > 300000) throw Error('wilds_world_worker_deadline_invalid');
  let worker: WorkPort | null = null;
  let unavailable = false;
  let sequence = 0;
  let generation = 0;
  const pending = new Map<number, { work: WorkerWork; worker: WorkPort; timer: ReturnType<typeof setTimeout>; resolve(value: unknown): void; reject(error: Error): void }>();
  const onMain = async (work: WorkerWork, uncertain = false): Promise<unknown> => {
    // Yield once before hashing/replaying on the main realm; never dispatch a new command identity.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (work.kind === 'prepare-persist') {
      const saved = uncertain ? await readExactWildsWorldOutboxEntry(work.entry, options.storage) : null;
      return saved ? prepareWildsWorldOutboxEntry(work.base, saved, work.anchorId)
        : prepareAndPersistWildsWorldOutboxEntry(work.base, work.entry, work.anchorId, entry => persistWildsWorldCommandDurably(entry, options.storage));
    }
    if (work.kind === 'persist') {
      const saved = uncertain ? await readExactWildsWorldOutboxEntry(work.entry, options.storage) : null;
      if (!saved) await persistWildsWorldCommandDurably(work.entry, options.storage);
      return undefined;
    }
    if (work.kind === 'prepare') return prepareWildsWorldOutboxEntry(work.base, work.entry, work.anchorId);
    if (work.kind === 'read') return readOutbox(work.actorId, options.storage);
    if (work.kind === 'acknowledge') return acknowledgeOutbox(work.actorId, work.commandId, options.storage);
    return restoreOutbox(work.base, work.actorId, options.storage);
  };
  const interrupt = (active: WorkPort, recover: boolean) => {
    if (worker !== active) return;
    worker = null; generation++;
    active.onmessage = null; active.onerror = null; active.onmessageerror = null;
    active.terminate();
    for (const [id, request] of pending) {
      if (request.worker !== active) continue;
      pending.delete(id); clearTimeout(request.timer);
      if (recover) void onMain(request.work, true).then(request.resolve, request.reject);
      else request.reject(new Error('wilds_world_worker_interrupted'));
    }
  };
  const close = () => {
    if (worker) interrupt(worker, false);
  };
  const run = (work: WorkerWork): Promise<unknown> => {
    if (!worker && !unavailable) {
      try {
        worker = createWorker ? createWorker() : typeof window !== "undefined" && typeof Worker !== "undefined"
          ? new Worker(new URL("./wilds-world-work.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkPort
          : null;
        if (!worker) unavailable = true;
        else {
          const active = worker, epoch = ++generation;
          active.onmessage = ({ data }) => {
            if (worker !== active || generation !== epoch) return;
            if (!data || !Number.isSafeInteger(data.id) || typeof data.ok !== 'boolean') { interrupt(active, true); return; }
            const request = pending.get(data.id);
            if (!request || request.worker !== active) return;
            pending.delete(data.id); clearTimeout(request.timer);
            if (data.ok) request.resolve(data.value);
            else request.reject(new Error(data.error));
          };
          active.onerror = (event) => {
            event.preventDefault?.();
            // Never replay an in-flight write after an uncertain worker failure.
            interrupt(active, false);
          };
          active.onmessageerror = () => interrupt(active, true);
        }
      } catch { unavailable = true; }
    }
    if (!worker) return onMain(structuredClone(work));
    const active = worker;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const exact = structuredClone(work);
      const timer = setTimeout(() => interrupt(active, true), deadlineMs);
      pending.set(id, { work: exact, worker: active, timer, resolve, reject });
      try { active.postMessage({ id, work: exact }); }
      catch (cause) { pending.delete(id); clearTimeout(timer); reject(cause instanceof Error ? cause : new Error("wilds_world_worker_dispatch_failed")); }
    });
  };
  return { run, close };
}

const client = createWildsWorldWorkerClient();
export const prepareWildsWorldOutboxEntryAsync = (base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) =>
  client.run({ kind: "prepare", base, entry, anchorId }) as Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>>;
export const prepareAndPersistWildsWorldOutboxEntryAsync = (base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) =>
  client.run({ kind: "prepare-persist", base, entry, anchorId }) as Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>>;
export const persistWildsWorldCommand = (entry: WildsWorldOutboxEntry) =>
  client.run({ kind: "persist", entry }) as Promise<void>;
export const readWildsWorldOutbox = (actorId: string) =>
  client.run({ kind: "read", actorId }) as Promise<WildsWorldOutboxEntry[]>;
export const restoreWildsWorldEdgeSource = (base: WildsWorldProjection, actorId: string) =>
  client.run({ kind: "restore", base, actorId }) as Promise<WildsWorldProjection>;
export const acknowledgeWildsWorldCommand = (actorId: string, commandId: string) =>
  client.run({ kind: "acknowledge", actorId, commandId }) as Promise<WildsWorldOutboxEntry[]>;
export function acknowledgeWildsWorldPublication(entry: WildsWorldOutboxEntry, publication: { commandId: string; globallyPublished: boolean }) {
  if (publication.commandId !== entry.command.commandId) return Promise.reject(new Error("wilds_world_published_head_mismatch"));
  return publication.globallyPublished ? acknowledgeWildsWorldCommand(entry.actorId, entry.command.commandId) : readWildsWorldOutbox(entry.actorId);
}
