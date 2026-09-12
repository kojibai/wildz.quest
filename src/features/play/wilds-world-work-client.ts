import { performWildsWorldWork, type WildsWorldWork } from "./wilds-world-work";
import type { prepareWildsWorldOutboxEntry, WildsWorldOutboxEntry } from "./wilds-world-outbox";
import type { WildsWorldProjection } from "./wilds-world-state";

type Reply = { id: number } & ({ ok: true; value: unknown } | { ok: false; error: string });
type WorkPort = {
  onmessage: ((event: MessageEvent<Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { id: number; work: WildsWorldWork }): void;
  terminate(): void;
};

/** Keep checkpoint hashing, source replay and IndexedDB envelope cloning off the rendering thread. */
export function createWildsWorldWorkerClient(createWorker?: () => WorkPort) {
  let worker: WorkPort | null = null;
  let unavailable = false;
  let sequence = 0;
  const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  const close = () => {
    worker?.terminate();
    worker = null;
    for (const request of pending.values()) request.reject(new Error("wilds_world_worker_interrupted"));
    pending.clear();
  };
  const run = (work: WildsWorldWork): Promise<unknown> => {
    if (!worker && !unavailable) {
      try {
        worker = createWorker ? createWorker() : typeof window !== "undefined" && typeof Worker !== "undefined"
          ? new Worker(new URL("./wilds-world-work.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkPort
          : null;
        if (!worker) unavailable = true;
        else {
          worker.onmessage = ({ data }) => {
            const request = pending.get(data.id);
            if (!request) return;
            pending.delete(data.id);
            if (data.ok) request.resolve(data.value);
            else request.reject(new Error(data.error));
          };
          worker.onerror = (event) => {
            event.preventDefault?.();
            unavailable = true;
            // Never replay an in-flight write after an uncertain worker failure.
            close();
          };
        }
      } catch { unavailable = true; }
    }
    if (!worker) return new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => performWildsWorldWork(work));
    const active = worker;
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      try { active.postMessage({ id, work }); }
      catch (cause) { pending.delete(id); reject(cause instanceof Error ? cause : new Error("wilds_world_worker_dispatch_failed")); }
    });
  };
  return { run, close };
}

const client = createWildsWorldWorkerClient();
export const prepareWildsWorldOutboxEntryAsync = (base: WildsWorldProjection, entry: WildsWorldOutboxEntry, anchorId?: string | null) =>
  client.run({ kind: "prepare", base, entry, anchorId }) as Promise<ReturnType<typeof prepareWildsWorldOutboxEntry>>;
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
