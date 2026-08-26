import type { createWildsPlayerVault } from "../../features/play/wilds-player-vault";

export type WildzPlayerStateProjectionInput = Parameters<typeof createWildsPlayerVault>[0];

type WorkerReply =
  | { id: string; ok: true; body: string }
  | { id: string; ok: false; error: string };

type ProjectionWorker = {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { id: string; input: WildzPlayerStateProjectionInput }): void;
  terminate(): void;
};

export type WildzPlayerStateSerializer = {
  serialize(input: WildzPlayerStateProjectionInput): Promise<string | null>;
  close(): void;
};

export function createWildzPlayerStateSerializer(options: {
  createWorker?: () => ProjectionWorker;
  createId?: () => string;
} = {}): WildzPlayerStateSerializer {
  let worker: ProjectionWorker | null = null;
  let unavailable = false;
  const pending = new Map<string, { resolve(value: string | null): void; reject(cause: Error): void }>();

  const close = () => {
    worker?.terminate();
    worker = null;
    for (const request of pending.values()) request.resolve(null);
    pending.clear();
  };

  const ensureWorker = () => {
    if (worker || unavailable) return worker;
    if (!options.createWorker && (typeof window === "undefined" || typeof Worker === "undefined")) return null;
    try {
      const created = options.createWorker
        ? options.createWorker()
        : new Worker(new URL("./wildz-player-state-serializer.worker.ts", import.meta.url), { type: "module" }) as unknown as ProjectionWorker;
      worker = created;
      created.onmessage = (event) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        if (event.data.ok) request.resolve(event.data.body);
        else request.reject(new Error(event.data.error));
      };
      created.onerror = (event) => {
        event.preventDefault?.();
        unavailable = true;
        close();
      };
      return created;
    } catch {
      unavailable = true;
      return null;
    }
  };

  return {
    serialize(input) {
      const activeWorker = ensureWorker();
      if (!activeWorker) return Promise.resolve(null);
      const id = options.createId?.() ?? crypto.randomUUID();
      return new Promise<string | null>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          activeWorker.postMessage({ id, input });
        } catch {
          pending.delete(id);
          resolve(null);
        }
      });
    },
    close
  };
}

export const wildzPlayerStateSerializer = createWildzPlayerStateSerializer();
