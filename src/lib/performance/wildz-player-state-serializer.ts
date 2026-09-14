import type { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import type { WildzPlayerProjectionMessage } from "./wildz-player-state-projection";
import { isAdmittedWildsCard } from "../../features/play/admitted-inventory";

export type WildzPlayerStateProjectionInput = Parameters<typeof createWildsPlayerVault>[0];

type WorkerReply =
  | { id: string; ok: true; body: string }
  | { id: string; ok: false; error: string };

type ProjectionWorker = {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WildzPlayerProjectionMessage): void;
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
  let lastInventory: WildzPlayerStateProjectionInput["playState"]["inventory"] | undefined;
  const pending = new Map<string, { resolve(value: string | null): void; reject(cause: Error): void }>();

  const close = () => {
    worker?.terminate();
    worker = null;
    lastInventory = undefined;
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
        else {
          lastInventory = undefined;
          request.reject(new Error(event.data.error));
        }
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
          const inventory = input.playState?.inventory;
          // Structured cloning a restored Vault on every movement sync blocks
          // the caller even though JSON is generated in a worker. Send those
          // exact immutable cards only when the inventory actually changes.
          const reuseInventory = inventory !== undefined && lastInventory !== undefined
            && inventory.length === lastInventory.length
            && inventory.every((asset, index) => asset === lastInventory![index] && isAdmittedWildsCard(asset));
          activeWorker.postMessage({ id, input: reuseInventory
            ? { ...input, playState: { ...input.playState, inventory: [] } }
            : input, ...(reuseInventory ? { reuseInventory: true } : {}) });
          lastInventory = inventory?.slice();
        } catch {
          pending.delete(id);
          lastInventory = undefined;
          resolve(null);
        }
      });
    },
    close
  };
}

export const wildzPlayerStateSerializer = createWildzPlayerStateSerializer();
