import type { ReceizKeyFile } from "@receiz/sdk";
import type { PortableCardAsset } from "../../features/play/portable-card";
import type { createWildsPlayerVault, WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { createVaultWorkerDeltaWriter } from "./wildz-vault-worker-state";

type Bundle = { bytes: Uint8Array; playerPayloadDigest: string };
type ExportWorkerReply =
  | { id: string; ok: true; bytes: ArrayBuffer; playerPayloadDigest: string }
  | { id: string; ok: false; error: string };
type Input = {
  artwork: Uint8Array;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload | Parameters<typeof createWildsPlayerVault>[0];
  keyFile: ReceizKeyFile;
  passphrase?: string;
};

let active: { worker: Worker; keyId: string; delta: ReturnType<typeof createVaultWorkerDeltaWriter>; assets?: PortableCardAsset[]; assetIds?: string[] } | null = null;
const pending = new Map<string, { resolve: (value: Bundle | null) => void; reject: (error: Error) => void }>();
function closeWorker() {
  active?.worker.terminate();
  active = null;
  for (const request of pending.values()) request.resolve(null);
  pending.clear();
}

/** Retain admitted cards in one worker; only new/replaced cards cross again. */
export async function createWildzIdentityPlayerCardBundleOffThread(input: Input): Promise<Bundle | null> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  if (active?.keyId !== input.keyFile.keyId) closeWorker();
  if (!active) {
    try {
      const worker = new Worker(new URL("./wildz-identity-export.worker.ts", import.meta.url), { type: "module" });
      active = { worker, keyId: input.keyFile.keyId, delta: createVaultWorkerDeltaWriter() };
      worker.onmessage = (event: MessageEvent<ExportWorkerReply>) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        if (!event.data.ok) { request.reject(new Error(event.data.error)); closeWorker(); }
        else request.resolve({ bytes: new Uint8Array(event.data.bytes), playerPayloadDigest: event.data.playerPayloadDigest });
      };
      worker.onerror = event => { event.preventDefault(); closeWorker(); };
    } catch { return null; }
  }
  const session = active;
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      const artwork = input.artwork.slice();
      const { playState, ...player } = input.player;
      // Player continuity and the exported card set normally share inventory.
      // Individual-card exports can carry a subset; preserve that distinction.
      const delta = session.delta(playState);
      if (session.assets !== input.assets) {
        session.assets = input.assets;
        session.assetIds = input.assets.map(asset => asset.id);
      }
      session.worker.postMessage({ id, artwork: artwork.buffer, delta, player,
        assetIds: session.assetIds, keyFile: input.keyFile, passphrase: input.passphrase }, [artwork.buffer]);
    } catch { closeWorker(); }
  });
}

export async function createWildzIdentityPlayerCardOffThread(input: Input) {
  return (await createWildzIdentityPlayerCardBundleOffThread(input))?.bytes ?? null;
}
