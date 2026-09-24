import type { createReceizOfflineSealer } from "@receiz/sdk/offline";
import { createWildzIdentityRepository } from "../wildz-identity-repository";
import type { WildzGameImageKind } from "../wildz-game-image-export";
import { sealWildzCardLocally } from "./seal-card";

type Sealer = ReturnType<typeof createReceizOfflineSealer>;
let worker: Worker | undefined;
let sequence = 0;
const pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
function request(command: "ready" | "enroll" | "seal", input?: Parameters<Sealer["seal"]>[0]): Promise<unknown> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("wildz_local_signer_storage_unavailable"));
  if (!worker) {
    worker = new Worker(new URL("./seal.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = event => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id); clearTimeout(entry.timer);
      if (event.data.error) entry.reject(new Error(event.data.error)); else entry.resolve(event.data.result);
    };
    worker.onerror = (event) => reset(new Error(`wildz_local_seal_worker_failed${event.message ? `: ${event.message}` : ""}`));
    worker.onmessageerror = () => reset(new Error("wildz_local_seal_worker_failed"));
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reset(new Error("wildz_local_seal_timeout")), 120_000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, command, ...(input ? { input } : {}) });
  });
}
function reset(error: Error) {
  worker?.terminate(); worker = undefined;
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
  pending.clear();
}
/** Warm packaged resources after first paint. This never enrolls a device. */
export async function readWildzLocalSealerReadiness() { return Boolean(await request("ready")); }
export async function prewarmWildzLocalSealer() { await readWildzLocalSealerReadiness(); }
/** Explicit Save setup only; background preparation must already have custody. */
export async function prepareWildzLocalCardSealer() {
  if (!await request("ready")) await request("enroll");
}
export async function sealWildzOwnedCardBlob(payload: Blob, filename: string, kind: WildzGameImageKind, options: { allowEnrollment?: boolean } = {}) {
  if (options.allowEnrollment !== false) await prepareWildzLocalCardSealer();
  else if (!await request("ready")) throw new Error("offline_seal_enrollment_required");
  const session = await createWildzIdentityRepository().active();
  return sealWildzCardLocally({ kind, mapOwner: session?.username ?? undefined,
    payload: new Uint8Array(await payload.arrayBuffer()), filename,
    sealer: { seal: async input => await request("seal", input) as Awaited<ReturnType<Sealer["seal"]>> } });
}
