import { signWildzProfilePublication, type WildzProfileSigningInput } from "./wildz-profile-signing";
import { wildzGameplayBackground } from "../performance/wildz-gameplay-background";
import { isAdmittedWildsCard } from "../../features/play/admitted-inventory";
import type { PortableCardAsset } from "../../features/play/portable-card";

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
  let publicCards: readonly PortableCardAsset[] | undefined;
  if (admittedCards) {
    const assets = new Map(input.assets!.map(asset => [asset.id, asset]));
    publicCards = input.profile.vault.map(entry => {
      const asset = assets.get(entry.id);
      if (asset?.proof.digest !== entry.proofDigest) throw new Error("wildz_public_profile_card_unverified");
      return asset;
    });
    signingInput = { ...signingInput, assets: undefined };
  }
  let worker: Worker | undefined;
  if (typeof Worker !== "undefined") {
    try { worker = createWorker(); } catch { /* Unsupported worker: retain SDK verification below. */ }
  }
  if (worker) {
    const activeWorker = worker;
    const result = await new Promise<Result | null>((resolve, reject) => {
      let stopped = false;
      const finish = () => { stopped = true; activeWorker.terminate(); signal?.removeEventListener("abort", abort); };
      const abort = () => { finish(); reject(signal?.reason); };
      signal?.addEventListener("abort", abort, { once: true });
      activeWorker.onmessage = (event: MessageEvent<{ ok: boolean; result: Result; error: string }>) => {
        finish();
        if (event.data.ok) resolve(event.data.result);
        else reject(new Error(event.data.error));
      };
      activeWorker.onerror = event => { event.preventDefault(); finish(); resolve(null); };
      if (signal?.aborted) { abort(); return; }
      try { activeWorker.postMessage({ input: signingInput, admittedCards, ...(publicCards ? { cardCount: publicCards.length } : {}) }); } catch { finish(); resolve(null); }
      if (publicCards?.length) void (async () => {
        for (const card of publicCards) {
          const sent = await wildzGameplayBackground.run(() => {
            if (stopped || signal?.aborted) return false;
            activeWorker.postMessage({ card });
            return true;
          });
          if (!sent) break;
        }
      })().catch(() => { if (!stopped) { finish(); resolve(null); } });
    });
    if (result) return result;
  }
  signal?.throwIfAborted();
  return wildzGameplayBackground.run(() => { signal?.throwIfAborted(); return signWildzProfilePublication(publicCards ? { ...signingInput, assets: publicCards } : signingInput, admittedCards); });
}
