/// <reference lib="webworker" />

import type { ReceizKeyFile } from "@receiz/sdk";
import { embedPortableVaultInPng } from "../../features/play/card-export";
import { verifyAnyWildsCard, rememberAdmittedWildsCardVerification } from "../../features/play/portable-card";
import { createVaultWorkerDeltaReader, type VaultWorkerDelta } from "./wildz-vault-worker-state";
import { createWildsPlayerVault, type WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { createWildzIdentityBoundPlayerVault } from "./wildz-identity-vault-binding";

type ExportWorkerRequest = {
  id: string;
  artwork: ArrayBuffer;
  assetIds: string[];
  delta: VaultWorkerDelta;
  player: Omit<WildsPlayerVaultPayload, "playState"> | Omit<Parameters<typeof createWildsPlayerVault>[0], "playState">;
  keyFile: ReceizKeyFile;
  passphrase?: string;
};

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const applyDelta = createVaultWorkerDeltaReader();

workerScope.addEventListener("message", (event: MessageEvent<ExportWorkerRequest>) => {
  const input = event.data;
  void (async () => {
    try {
      for (const card of input.delta.cards?.changed ?? []) {
        if (!verifyAnyWildsCard(card).ok) throw new Error("wilds_vault_cards_invalid");
        rememberAdmittedWildsCardVerification(card);
      }
      const playState = applyDelta(input.delta);
      const raw = { ...input.player, playState };
      const player = "payloadDigest" in raw ? raw : createWildsPlayerVault(raw);
      const cards = new Map(playState.inventory.map(card => [card.id, card]));
      const assets = input.assetIds.map(id => {
        const card = cards.get(id);
        if (!card) throw new Error("wildz_vault_worker_card_missing");
        return card;
      });
      const vaultBytes = embedPortableVaultInPng(new Uint8Array(input.artwork), assets, player);
      const bytes = await createWildzIdentityBoundPlayerVault({
        keyFile: input.keyFile,
        vaultBytes,
        ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
      });
      workerScope.postMessage({ id: input.id, ok: true, bytes: bytes.buffer, playerPayloadDigest: player.payloadDigest }, [bytes.buffer]);
    } catch (cause) {
      workerScope.postMessage({
        id: input.id,
        ok: false,
        error: cause instanceof Error ? cause.message : "wildz_identity_export_worker_failed"
      });
    }
  })();
});
