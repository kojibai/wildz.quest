import { signWildzProfilePublication, type WildzProfileSigningInput } from "./wildz-profile-signing";
import { wildzGameplayBackground } from "../performance/wildz-gameplay-background";
import { isAdmittedWildsCard } from "../../features/play/admitted-inventory";

type Result = Awaited<ReturnType<typeof signWildzProfilePublication>>;

export async function prepareWildzProfilePublication(input: WildzProfileSigningInput, signal?: AbortSignal,
  createWorker = () => new Worker(new URL("./wildz-profile-signing.worker.ts", import.meta.url), { type: "module" })
): Promise<Result> {
  signal?.throwIfAborted();
  // Only exact, deeply frozen objects held by runtime admission qualify. This
  // is public projection preparation, never a new card/ownership admission.
  const admittedCards = input.assets !== undefined && input.assets.every(isAdmittedWildsCard);
  // A signing operation needs the key, not the entire portable account archive.
  // Structured cloning that archive would block the gameplay thread before the
  // worker even starts. The verified source stays intact in local custody.
  let signingInput = input.keyFile
    ? { ...input, keyFile: { ...input.keyFile, portableState: null } }
    : input;
  if (admittedCards) {
    const assets = new Map(input.assets!.map(asset => [asset.id, asset]));
    for (const entry of input.profile.vault) {
      if (assets.get(entry.id)?.proof.digest !== entry.proofDigest) throw new Error("wildz_public_profile_card_unverified");
    }
    signingInput = { ...signingInput, assets: undefined };
  }
  let worker: Worker | undefined;
  if (typeof Worker !== "undefined") {
    try { worker = createWorker(); } catch { /* Unsupported worker: retain SDK verification below. */ }
  }
  if (worker) {
    const activeWorker = worker;
    const result = await new Promise<Result | null>((resolve, reject) => {
      const finish = () => { activeWorker.terminate(); signal?.removeEventListener("abort", abort); };
      const abort = () => { finish(); reject(signal?.reason); };
      signal?.addEventListener("abort", abort, { once: true });
      activeWorker.onmessage = (event: MessageEvent<{ ok: boolean; result: Result; error: string }>) => {
        finish();
        if (event.data.ok) resolve(event.data.result);
        else reject(new Error(event.data.error));
      };
      activeWorker.onerror = event => { event.preventDefault(); finish(); resolve(null); };
      if (signal?.aborted) { abort(); return; }
      try { activeWorker.postMessage({ input: signingInput, admittedCards }); } catch { finish(); resolve(null); }
    });
    if (result) return result;
  }
  signal?.throwIfAborted();
  return wildzGameplayBackground.run(() => { signal?.throwIfAborted(); return signWildzProfilePublication(signingInput, admittedCards); });
}
