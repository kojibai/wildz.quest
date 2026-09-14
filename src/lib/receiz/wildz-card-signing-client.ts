import { signWildzCardPublication, type WildzCardSigningInput } from "./wildz-card-signing";
import { wildzGameplayBackground } from "../performance/wildz-gameplay-background";

export async function prepareWildzCardPublication(input: WildzCardSigningInput, signal?: AbortSignal,
  createWorker = () => new Worker(new URL("./wildz-card-signing.worker.ts", import.meta.url), { type: "module" })
): Promise<string> {
  signal?.throwIfAborted();
  const signingInput = { ...input, keyFile: { ...input.keyFile, portableState: null } };
  let worker: Worker | undefined;
  if (typeof Worker !== "undefined") {
    try { worker = createWorker(); } catch { /* Older browsers retain the SDK fallback. */ }
  }
  if (worker) {
    const active = worker;
    const body = await new Promise<string | null>((resolve, reject) => {
      const finish = () => { active.terminate(); signal?.removeEventListener("abort", abort); };
      const abort = () => { finish(); reject(signal?.reason); };
      signal?.addEventListener("abort", abort, { once: true });
      active.onmessage = (event: MessageEvent<{ ok: boolean; body: string; error: string }>) => {
        finish();
        if (event.data.ok) resolve(event.data.body);
        else reject(new Error(event.data.error));
      };
      active.onerror = event => { event.preventDefault(); finish(); resolve(null); };
      if (signal?.aborted) { abort(); return; }
      try { active.postMessage(signingInput); } catch { finish(); resolve(null); }
    });
    if (body !== null) return body;
  }
  signal?.throwIfAborted();
  return wildzGameplayBackground.run(() => { signal?.throwIfAborted(); return signWildzCardPublication(signingInput); });
}
