type JsonWorkerReply =
  | { id: string; ok: true; json: string }
  | { id: string; ok: false; error: string };

type JsonWorker = {
  onmessage: ((event: MessageEvent<JsonWorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: { id: string; value: unknown }): void;
  terminate(): void;
};

export type WildzJsonSerializer = {
  serialize(value: unknown): Promise<string | null>;
  close(): void;
};

export function createWildzJsonSerializer(options: {
  createWorker?: () => JsonWorker;
  createId?: () => string;
} = {}): WildzJsonSerializer {
  let worker: JsonWorker | null = null;
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
        : new Worker(new URL("./wildz-json-serializer.worker.ts", import.meta.url), { type: "module" }) as unknown as JsonWorker;
      worker = created;
      created.onmessage = (event) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        if (event.data.ok) request.resolve(event.data.json);
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
    serialize(value) {
      const activeWorker = ensureWorker();
      if (!activeWorker) return Promise.resolve(null);
      const id = options.createId?.() ?? crypto.randomUUID();
      return new Promise<string | null>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        try {
          activeWorker.postMessage({ id, value });
        } catch {
          pending.delete(id);
          resolve(null);
        }
      });
    },
    close
  };
}

export const wildzJsonSerializer = createWildzJsonSerializer();
