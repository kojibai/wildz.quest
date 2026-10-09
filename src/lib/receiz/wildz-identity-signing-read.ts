import { parseReceizIdentityArtifactText, type ReceizKeyFile } from "@receiz/sdk";
import { defaultIdentityRepository } from "./wildz-active-identity";
import { wildzGameplayBackground } from "../performance/wildz-gameplay-background";

type SigningWorker = Pick<Worker, "onmessage" | "onerror" | "onmessageerror" | "postMessage" | "terminate">;

/** The private signing portion is small; decoding its account archive is not. */
export async function readWildzIdentityForSigning(keyId: string, signal?: AbortSignal, options: {
  createWorker?: () => SigningWorker;
  readLocally?: (keyId: string) => Promise<ReceizKeyFile>;
} = {}): Promise<ReceizKeyFile> {
  signal?.throwIfAborted();
  const fallback = () => wildzGameplayBackground.run(async () => {
    signal?.throwIfAborted();
    const keyFile = await (options.readLocally ?? (key => defaultIdentityRepository.withKeyFile(key, async file => file)))(keyId);
    signal?.throwIfAborted();
    return { ...keyFile, portableState: null };
  });
  let worker: SigningWorker;
  try {
    if (options.createWorker) worker = options.createWorker();
    else if (typeof Worker === "undefined") return fallback();
    else worker = new Worker(new URL("./wildz-identity-signing-read.worker.ts", import.meta.url), { type: "module" });
  } catch { return fallback(); }
  const result = await new Promise<ReceizKeyFile | null>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => fail(new Error("wildz_identity_signing_read_timeout")), 120_000);
    const finish = () => {
      if (finished) return false;
      finished = true; clearTimeout(timer); worker.terminate(); signal?.removeEventListener("abort", abort);
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      return true;
    };
    const fail = (cause: unknown) => { if (finish()) reject(cause); };
    const abort = () => fail(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = event => {
      const reply = event.data as { ok?: boolean; text?: string; error?: string; fallbackSafe?: boolean };
      if (reply?.ok === false) {
        if (reply.fallbackSafe === true && reply.error === "wildz_identity_signing_worker_storage_unavailable") {
          if (finish()) resolve(null);
        } else fail(new Error(reply.error ?? "wildz_identity_signing_read_failed"));
        return;
      }
      try {
        if (reply?.ok !== true || typeof reply.text !== "string") throw new Error();
        const keyFile = parseReceizIdentityArtifactText(reply.text);
        if (keyFile.keyId !== keyId || keyFile.portableState !== null) throw new Error();
        if (finish()) resolve(keyFile);
      } catch { fail(new Error("wildz_identity_signing_read_invalid")); }
    };
    const unavailable = () => { if (finish()) resolve(null); };
    worker.onerror = event => { event.preventDefault?.(); unavailable(); };
    worker.onmessageerror = unavailable;
    if (signal?.aborted) { abort(); return; }
    try { worker.postMessage({ command: "signing-key", keyId }); } catch { unavailable(); }
  });
  signal?.throwIfAborted();
  return result ?? fallback();
}
