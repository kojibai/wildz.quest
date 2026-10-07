import type { PlayState } from "../../features/play/game-state";
import { isAdmittedWildsCard, retainAdmittedWildsInventory, verifyAndAdmitWildsCard } from "../../features/play/admitted-inventory";
import { wildzGameplayBackground } from "./wildz-gameplay-background";
import { wildzInventoryPinsMatch, type WildzDurableSaveInput, type WildzDurableSaveMessage, type WildzDurableSaveReply } from "./wildz-durable-save-projection";

type DurableSaveWorker = {
  onmessage: ((event: MessageEvent<WildzDurableSaveReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror?: ((event: MessageEvent) => void) | null;
  postMessage(message: WildzDurableSaveMessage): void;
  terminate(): void;
};
export type WildzDurablePlayStateSaver = {
  save(input: WildzDurableSaveInput, fallback: () => Promise<PlayState>): Promise<PlayState>;
  close(): void;
};

/** One in-flight save, awaited by the existing identity-operation queue. Only
 * a failure before dispatch uses the caller's saver. An unknown commit outcome
 * rejects without issuing a second write, so the scheduler can retain its retry. */
export function createWildzDurablePlayStateSaver(options: {
  createWorker?: () => DurableSaveWorker;
  createId?: () => string;
  timeoutMs?: number;
} = {}): WildzDurablePlayStateSaver {
  let worker: DurableSaveWorker | null = null, unavailable = false;
  let lastInventory: PlayState["inventory"] | null = null, lastScope: string | null = null, lastVersion: string | null = null;
  let pending: { id: string; input: WildzDurableSaveInput; fallback(): Promise<PlayState>; resolve(value: PlayState): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> } | null = null;
  const resetInventory = () => { lastInventory = null; lastScope = null; lastVersion = null; };
  const close = () => {
    worker?.terminate(); worker = null; resetInventory();
    if (pending) { clearTimeout(pending.timer); pending.reject(Error("wildz_durable_save_outcome_unknown")); pending = null; }
  };
  const ensureWorker = () => {
    if (worker || unavailable) return worker;
    if (!options.createWorker && (typeof window === "undefined" || typeof Worker === "undefined")) return null;
    try {
      const created = options.createWorker ? options.createWorker() : new Worker(new URL("./wildz-durable-save.worker.ts", import.meta.url), { type: "module" }) as unknown as DurableSaveWorker;
      worker = created;
      const failWorker = () => { if (worker === created) { unavailable = true; close(); } };
      created.onerror = event => { event.preventDefault?.(); failWorker(); };
      created.onmessageerror = failWorker;
      created.onmessage = event => {
        if (worker !== created || !pending) return;
        const reply = event.data, request = pending;
        if (!reply || reply.id !== request.id || typeof reply.ok !== "boolean") { failWorker(); return; }
        clearTimeout(request.timer); pending = null;
        if (!reply.ok) {
          resetInventory();
          if (reply.fallbackSafe === true && reply.error === "wildz_durable_save_worker_storage_unavailable") {
            unavailable = true; created.terminate(); worker = null;
            void wildzGameplayBackground.run(request.fallback).then(request.resolve, request.reject);
          } else request.reject(Error(reply.error));
          return;
        }
        try {
          if (!reply.playState || !Array.isArray(reply.inventoryPins) || !Array.isArray(reply.playState.inventory)) throw Error("wildz_durable_save_reply_invalid");
          const incoming = request.input.playState.inventory;
          const exactInventory = incoming.every(isAdmittedWildsCard) && wildzInventoryPinsMatch(reply.inventoryPins, incoming);
          let inventory: PlayState["inventory"];
          if (exactInventory) inventory = incoming;
          else {
            if (!reply.includesInventory || !wildzInventoryPinsMatch(reply.inventoryPins, reply.playState.inventory)) throw Error("wildz_durable_save_reply_inventory_invalid");
            inventory = reply.playState.inventory;
            for (const card of inventory) if (!verifyAndAdmitWildsCard(card)) throw Error("wildz_durable_save_reply_card_invalid");
            inventory = retainAdmittedWildsInventory(inventory);
          }
          if (exactInventory && reply.inventoryVersion === request.id) {
            lastInventory = incoming.slice(); lastScope = `${encodeURIComponent(request.input.session.keyId)}:${encodeURIComponent(request.input.session.actorId)}`; lastVersion = reply.inventoryVersion;
          } else resetInventory();
          request.resolve({ ...reply.playState, inventory });
        } catch (cause) { resetInventory(); request.reject(cause instanceof Error ? cause : Error("wildz_durable_save_reply_invalid")); }
      };
      return created;
    } catch { unavailable = true; return null; }
  };
  return {
    save(input, fallback) {
      if (pending) return Promise.reject(Error("wildz_durable_save_busy"));
      const activeWorker = ensureWorker();
      if (!activeWorker) return wildzGameplayBackground.run(fallback);
      const id = options.createId?.() ?? crypto.randomUUID();
      const inventory = input.playState.inventory, scope = `${encodeURIComponent(input.session.keyId)}:${encodeURIComponent(input.session.actorId)}`;
      const admitted = inventory.every(isAdmittedWildsCard), sameScope = lastScope === scope;
      const reuseInventory = admitted && sameScope && lastInventory && inventory.length === lastInventory.length && inventory.every((card, index) => card === lastInventory![index]);
      const inventoryDelta = !reuseInventory && admitted && sameScope && lastInventory ? { length: inventory.length, changes: inventory.flatMap((card, index) => card === lastInventory![index] ? [] : [{ index, card }]) } : undefined;
      return new Promise<PlayState>((resolve, reject) => {
        const timer = setTimeout(() => { if (pending?.id === id) { unavailable = true; close(); } }, Math.max(100, Math.min(60_000, options.timeoutMs ?? 30_000)));
        pending = { id, input, fallback, resolve, reject, timer };
        try {
          activeWorker.postMessage({ id, input: reuseInventory || inventoryDelta ? { ...input, playState: { ...input.playState, inventory: [] } } : input, inventoryVersion: id, ...(reuseInventory ? { reuseInventory: true } : {}), ...(inventoryDelta ? { inventoryDelta } : {}), ...(reuseInventory || inventoryDelta ? { baseInventoryVersion: lastVersion! } : {}), returnInventory: !admitted });
        } catch {
          clearTimeout(timer); pending = null; resetInventory(); unavailable = true; activeWorker.terminate(); worker = null;
          // postMessage throws before delivery (for example, structured-clone failure).
          void wildzGameplayBackground.run(fallback).then(resolve, reject);
        }
      });
    },
    close
  };
}

export const wildzDurablePlayStateSaver = createWildzDurablePlayStateSaver();
