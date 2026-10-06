type JsonWorkerReply =
  | { id: string; ok: true; json: string }
  | { id: string; ok: false; error: string };

type JsonWorker = {
  onmessage: ((event: MessageEvent<JsonWorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror?: ((event: MessageEvent) => void) | null;
  postMessage(message: { id: string; value: unknown }): void;
  terminate(): void;
};

export type WildzJsonSerializer = {
  serialize(value: unknown): Promise<string | null>;
  close(): void;
};

export function createWildzJsonSerializer<TimerHandle = ReturnType<typeof setTimeout>>(options: {
  createWorker?: () => JsonWorker;
  createId?: () => string;
  timeoutMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
} = {}): WildzJsonSerializer {
  let worker: JsonWorker | null = null;
  let unavailable = false;
  const timeoutMs = Math.max(100, Math.min(60_000, options.timeoutMs ?? 5_000));
  const setTimer = options.setTimer ?? ((callback: () => void, delayMs: number) => setTimeout(callback, delayMs) as TimerHandle);
  const clearTimer = options.clearTimer ?? ((handle: TimerHandle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const pending = new Map<string, { timer: TimerHandle; resolve(value: string | null): void; reject(cause: Error): void }>();

  const close = () => {
    worker?.terminate();
    worker = null;
    for (const request of pending.values()) { clearTimer(request.timer); request.resolve(null); }
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
      const failWorker = () => {
        if (worker !== created) return;
        unavailable = true;
        close();
      };
      created.onmessage = (event) => {
        if (worker !== created) return;
        const reply = event.data;
        if (!reply || typeof reply !== "object" || typeof reply.id !== "string"
          || (reply.ok === true ? typeof reply.json !== "string" : reply.ok !== false || typeof reply.error !== "string")) {
          failWorker();
          return;
        }
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        clearTimer(request.timer);
        if (event.data.ok) request.resolve(event.data.json);
        else request.reject(new Error(event.data.error));
      };
      created.onerror = (event) => {
        event.preventDefault?.();
        failWorker();
      };
      created.onmessageerror = failWorker;
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
        const timer = setTimer(() => {
          if (worker !== activeWorker || !pending.has(id)) return;
          // JSON production is read-only. Release the blocked queue through the
          // caller's existing checkpoint fallback, fencing all late replies.
          unavailable = true;
          close();
        }, timeoutMs);
        pending.set(id, { timer, resolve, reject });
        try {
          activeWorker.postMessage({ id, value });
        } catch {
          pending.delete(id);
          clearTimer(timer);
          resolve(null);
        }
      });
    },
    close
  };
}

export const wildzJsonSerializer = createWildzJsonSerializer();
