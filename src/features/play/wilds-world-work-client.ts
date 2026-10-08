import type { WildsWorldWork } from "./wilds-world-work";
import { projectWildsWorldOutboxCooperatively, prepareAndPersistWildsWorldOutboxEntry, prepareWildsWorldOutboxEntry, persistWildsWorldCommandDurably, readExactWildsWorldOutboxEntry, readWildsWorldOutbox as readOutbox, acknowledgeWildsWorldCommand as acknowledgeOutbox, restoreWildsWorldEdgeSource as restoreOutbox } from "./wilds-world-outbox";
import type { WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { ReceizOfflineProofQueueStorage } from '@receiz/sdk';
import { prepareReceivedWildsWorldProofs } from "./wilds-received-proof-immutability";
import { emitWildsPlaytestDuration } from "./wilds-playtest-events";
import { cloneWildsWorldWorkerInput, decodeWildsWorldWorkerResult } from "./wilds-world-worker-transfer";

type Reply = { id: number; persistenceMs?: number } & ({ ok: true; value: unknown } | { ok: false; error: string });
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
  const pending = new Map<number, { work: WorkerWork; worker: WorkPort; preparing?: boolean; started: number; timer: ReturnType<typeof setTimeout>; resolve(value: unknown): void; reject(error: Error): void }>();
  const prepareResult = async (work: WorkerWork, value: unknown, cancelled?: () => boolean) => {
    const projection = work.kind === "restore" || work.kind === "project" ? value
      : (work.kind === "prepare" || work.kind === "prepare-persist") && value && typeof value === "object"
        ? Object.getOwnPropertyDescriptor(value, "projection")?.value : undefined;
    const started = performance.now();
    await prepareReceivedWildsWorldProofs(projection, { cancelled });
    if (projection) emitWildsPlaytestDuration('world-prewarm', performance.now() - started);
    return value;
  };
  const performOnMain = async (work: WorkerWork, uncertain = false): Promise<unknown> => {
    // Yield once before hashing/replaying on the main realm; never dispatch a new command identity.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (work.kind === 'project') return projectWildsWorldOutboxCooperatively(work.base, work.actorId, work.entries);
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
  const onMain = async (work: WorkerWork, uncertain = false) => {
    const started = performance.now();
    try { return await performOnMain(work, uncertain); }
    finally { emitWildsPlaytestDuration('world-fallback', performance.now() - started); }
  };
  const interrupt = (active: WorkPort, recover: boolean) => {
    if (worker !== active) return;
    worker = null; generation++;
    active.onmessage = null; active.onerror = null; active.onmessageerror = null;
    active.terminate();
    for (const [id, request] of pending) {
      if (request.worker !== active) continue;
      if (!request.preparing) emitWildsPlaytestDuration(recover ? 'world-worker-recovery' : 'world-worker', performance.now() - request.started);
      pending.delete(id); clearTimeout(request.timer);
      if (recover) void onMain(request.work, true).then(value => prepareResult(request.work, value)).then(request.resolve, request.reject);
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
            if (!request || request.worker !== active || request.preparing) return;
            clearTimeout(request.timer);
            emitWildsPlaytestDuration('world-worker', performance.now() - request.started);
            if (typeof data.persistenceMs === 'number') emitWildsPlaytestDuration('world-persist', data.persistenceMs);
            if (data.ok) {
              request.preparing = true;
              void Promise.resolve().then(() => decodeWildsWorldWorkerResult(request.work, data.value))
                .then(value => prepareResult(request.work, value, () => pending.get(data.id) !== request)).then(value => {
                if (pending.get(data.id) !== request) return;
                pending.delete(data.id); request.resolve(value);
              }, error => {
                if (pending.get(data.id) !== request) return;
                pending.delete(data.id); request.reject(error);
              });
            }
            else { pending.delete(data.id); request.reject(new Error(data.error)); }
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
    if (!worker) {
      const exact = cloneWildsWorldWorkerInput(work);
      return onMain(exact).then(value => prepareResult(exact, value));
    }
    const active = worker;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const started = performance.now();
      const exact = cloneWildsWorldWorkerInput(work);
      const timer = setTimeout(() => interrupt(active, true), deadlineMs);
      pending.set(id, { work: exact, worker: active, started, timer, resolve, reject });
      try { active.postMessage({ id, work: exact }); }
      catch (cause) { pending.delete(id); clearTimeout(timer); reject(cause instanceof Error ? cause : new Error("wilds_world_worker_dispatch_failed")); }
    });
  };
  return { run, close };
}

const client = createWildsWorldWorkerClient();
export const projectWildsWorldOutboxAsync = (base: WildsWorldProjection, actorId: string, entries: WildsWorldOutboxEntry[]) =>
  entries.length ? client.run({ kind: "project", base, actorId, entries }) as Promise<WildsWorldProjection> : Promise.resolve(base);
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
