import { wildzGameplayBackground } from "../../../lib/performance/wildz-gameplay-background";
import { validateWalletResourceIndex, type ResourceIndex, type ResourceIndexScope } from "./wilds-wallet-resource-index-validation";
type IndexWorker = Pick<Worker, "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate">;
/** Public presentation only. The worker receives no source, key file or token.
 * Positions select the retained transaction snapshot; callers fence its scope. */
export async function verifyWalletResourceIndexOffThread(index: ResourceIndex, input: ResourceIndexScope, createWorker?: () => IndexWorker, signal?: AbortSignal): Promise<number[]> {
  signal?.throwIfAborted();
  const fallback = () => validateWalletResourceIndex(index, input, () => wildzGameplayBackground.run(() => {signal?.throwIfAborted();}));
  if (!index?.entries?.length) return fallback();
  let worker: IndexWorker;
  try { worker = createWorker ? createWorker() : new Worker(new URL("./wilds-wallet-resource-index.worker.ts", import.meta.url), {type: "module"}); }
  catch { return fallback(); }
  const result = await new Promise<number[] | null>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(() => reject(Error("wallet_resource_index_timeout"))), 120_000);
    function finish(action: () => void) { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate(); worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; action(); }
    const abort = () => finish(() => reject(signal?.reason ?? Error("wallet_resource_index_aborted")));
    signal?.addEventListener("abort", abort, {once: true});
    if (signal?.aborted) {abort(); return;}
    const unavailable = () => finish(() => resolve(null));
    worker.onerror = event => {event.preventDefault?.(); unavailable();};
    worker.onmessageerror = unavailable;
    worker.onmessage = event => {
      const reply = event.data;
      if (reply?.ok === false) {finish(() => reject(Error("wallet_resource_index_invalid"))); return;}
      const positions: unknown = reply?.positions;
      if (reply?.ok !== true || !Array.isArray(positions) || positions.length > 256 || positions.some((position, i) => !Number.isInteger(position) || position < 0 || position >= index.entries.length || i > 0 && position <= positions[i - 1])) {
        finish(() => reject(Error("wallet_resource_index_reply_invalid"))); return;
      }
      finish(() => resolve(positions));
    };
    try { worker.postMessage({index, scope: {keyId: input.keyId, ownerHandle: input.ownerHandle}}); } catch {unavailable();}
  });
  return result ?? fallback();
}
