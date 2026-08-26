import type { ReceizKeyFile } from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";

type ExportWorkerReply =
  | { id: string; ok: true; bytes: ArrayBuffer }
  | { id: string; ok: false; error: string };

export async function createWildzIdentityPlayerCardOffThread(input: {
  artwork: Uint8Array;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload;
  keyFile: ReceizKeyFile;
  passphrase?: string;
}): Promise<Uint8Array | null> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./wildz-identity-export.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  const id = crypto.randomUUID();
  return new Promise<Uint8Array | null>((resolve, reject) => {
    const finish = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<ExportWorkerReply>) => {
      if (event.data.id !== id) return;
      finish();
      if (!event.data.ok) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(new Uint8Array(event.data.bytes));
    };
    worker.onerror = (event) => {
      finish();
      // A browser that cannot load module workers keeps the exact inline path.
      // Proof/authority errors arrive as structured worker replies above.
      event.preventDefault();
      resolve(null);
    };
    try {
      const transferableArtwork = input.artwork.slice();
      worker.postMessage({ id, ...input, artwork: transferableArtwork.buffer }, [transferableArtwork.buffer]);
    } catch {
      finish();
      resolve(null);
    }
  });
}
