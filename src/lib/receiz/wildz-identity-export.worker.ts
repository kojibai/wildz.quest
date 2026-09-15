/// <reference lib="webworker" />

import type { ReceizKeyFile } from "@receiz/sdk";
import { createRetainedPortableVaultWriter } from "../../features/play/card-export";
import { verifyAndAdmitWildsCard, retainAdmittedWildsInventory } from "../../features/play/admitted-inventory";
import { createVaultWorkerDeltaReader, type VaultWorkerDelta } from "./wildz-vault-worker-state";
import type { createWildsPlayerVault, WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import { createWildzIdentityBoundPreparedVault } from "./wildz-identity-vault-binding";

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
const vaultWriter = createRetainedPortableVaultWriter();

workerScope.addEventListener("message", (event: MessageEvent<ExportWorkerRequest>) => {
  const input = event.data;
  void (async () => {
    try {
      for (const card of input.delta.cards?.changed ?? []) {
        if (!verifyAndAdmitWildsCard(card)) throw new Error("wilds_vault_cards_invalid");
      }
      const playState = applyDelta(input.delta);
      retainAdmittedWildsInventory(playState.inventory);
      const raw = { ...input.player, playState };
      const cards = new Map(playState.inventory.map(card => [card.id, card]));
      const assets = input.assetIds.map(id => {
        const card = cards.get(id);
        if (!card) throw new Error("wildz_vault_worker_card_missing");
        return card;
      });
      const { prepared, playerPayloadDigest } = vaultWriter.prepare(new Uint8Array(input.artwork), assets, raw);
      const bytes = await createWildzIdentityBoundPreparedVault({
        keyFile: input.keyFile,
        prepared,
        ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
      });
      workerScope.postMessage({ id: input.id, ok: true, bytes: bytes.buffer, playerPayloadDigest }, [bytes.buffer]);
    } catch (cause) {
      workerScope.postMessage({
        id: input.id,
        ok: false,
        error: cause instanceof Error ? cause.message : "wildz_identity_export_worker_failed"
      });
    }
  })();
});
