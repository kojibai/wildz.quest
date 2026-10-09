import { projectWildsWalletSourceAuthorityLocally } from "./wilds-wallet-source-projection";
import { admitWildsWalletReadResponse, type WildsWalletReadResponse } from "./wilds-wallet-controller";
import { wildzGameplayBackground } from "@/lib/performance/wildz-gameplay-background";

type SourceWorker = Pick<Worker, "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate">;
type Reply = { keyId: string; ok: boolean; result?: WildsWalletReadResponse | null; error?: string; fallbackSafe?: boolean };

/** Read/decrypt the archive in its worker; only the small wallet view crosses. */
export async function projectWildsWalletSourceAuthority(keyId: string, options: {
  createWorker?: () => SourceWorker;
  projectLocally?: typeof projectWildsWalletSourceAuthorityLocally;
} = {}): Promise<WildsWalletReadResponse | null> {
  const fallback = () => wildzGameplayBackground.run(() =>
    (options.projectLocally ?? projectWildsWalletSourceAuthorityLocally)(keyId));
  let worker: SourceWorker;
  try {
    if (options.createWorker) worker = options.createWorker();
    else if (typeof Worker === "undefined") return fallback();
    else worker = new Worker(new URL("./wilds-wallet-source.worker.ts", import.meta.url), { type: "module" });
  } catch { return fallback(); }
  const outcome = await new Promise<{ result: WildsWalletReadResponse | null } | null>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => fail(new Error("wilds_wallet_source_worker_timeout")), 120_000);
    const finish = () => {
      if (finished) return false;
      finished = true; clearTimeout(timer); worker.terminate();
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      return true;
    };
    const fail = (cause: Error) => { if (finish()) reject(cause); };
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (!reply || reply.keyId !== keyId || typeof reply.ok !== "boolean") {
        fail(new Error("wilds_wallet_source_worker_reply_invalid")); return;
      }
      if (!reply.ok) {
        if (reply.fallbackSafe === true && reply.error === "wilds_wallet_source_worker_storage_unavailable") {
          if (finish()) resolve(null);
        } else fail(new Error(reply.error ?? "wilds_wallet_source_projection_failed"));
        return;
      }
      try {
        const result = reply.result === null ? null : admitWildsWalletReadResponse(reply.result);
        if (finish()) resolve({ result });
      } catch { fail(new Error("wilds_wallet_source_worker_reply_invalid")); }
    };
    const unavailable = () => { if (finish()) resolve(null); };
    worker.onerror = event => { event.preventDefault?.(); unavailable(); };
    worker.onmessageerror = unavailable;
    try { worker.postMessage({ keyId }); } catch { unavailable(); }
  });
  return outcome ? outcome.result : fallback();
}
