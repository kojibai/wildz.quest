/// <reference lib="webworker" />

import type { ReceizKeyFile } from "@receiz/sdk";
import { embedPortableVaultInPng } from "../../features/play/card-export";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { createWildsPlayerVault, type WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { createWildzIdentityBoundPlayerVault } from "./wildz-identity-vault-binding";

type ExportWorkerRequest = {
  id: string;
  artwork: ArrayBuffer;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload | Parameters<typeof createWildsPlayerVault>[0];
  keyFile: ReceizKeyFile;
  passphrase?: string;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<ExportWorkerRequest>) => {
  const input = event.data;
  void (async () => {
    try {
      const player = "payloadDigest" in input.player ? input.player : createWildsPlayerVault(input.player);
      const vaultBytes = embedPortableVaultInPng(new Uint8Array(input.artwork), input.assets, player);
      const bytes = await createWildzIdentityBoundPlayerVault({
        keyFile: input.keyFile,
        vaultBytes,
        ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
      });
      workerScope.postMessage({ id: input.id, ok: true, bytes: bytes.buffer }, [bytes.buffer]);
    } catch (cause) {
      workerScope.postMessage({
        id: input.id,
        ok: false,
        error: cause instanceof Error ? cause.message : "wildz_identity_export_worker_failed"
      });
    }
  })();
});
