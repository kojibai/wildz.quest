import type { PlayState } from "../../features/play/game-state";
import { retainAdmittedWildsInventory, verifyAndAdmitWildsCard } from "../../features/play/admitted-inventory";
import { saveWildzRestoredPlayState, type WildzPlayerContinuity } from "../../features/identity/wildz-restore";
import type { WildzCharacterGenesis } from "../../features/identity/wildz-genesis";
import type { WildzIdentitySession } from "../receiz/wildz-identity-repository";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";

export type WildzDurableSaveInput = {
  session: WildzIdentitySession;
  playState: PlayState;
  player?: WildzPlayerContinuity | null;
  character?: WildzCharacterGenesis | null;
};
export type WildzInventoryPin = { id: string; digest: string };
export type WildzDurableSaveMessage = {
  id: string;
  input: WildzDurableSaveInput;
  inventoryVersion: string;
  baseInventoryVersion?: string;
  reuseInventory?: boolean;
  inventoryDelta?: { length: number; changes: Array<{ index: number; card: PlayState["inventory"][number] }> };
  returnInventory?: boolean;
};
export type WildzDurableSaveReply =
  | { id: string; ok: true; playState: PlayState; inventoryPins: WildzInventoryPin[]; inventoryVersion: string | null; includesInventory: boolean }
  | { id: string; ok: false; error: string; fallbackSafe?: true };

export const wildzInventoryPins = (inventory: PlayState["inventory"]) => inventory.map(card => ({ id: card.id, digest: card.proof.digest }));
export function wildzInventoryPinsMatch(pins: readonly WildzInventoryPin[], inventory: PlayState["inventory"]) {
  return pins.length === inventory.length && pins.every((pin, index) => pin.id === inventory[index]?.id && pin.digest === inventory[index]?.proof.digest);
}

/** The worker verifies changed source bytes, then saves through the existing
 * owner-state transaction. Cache only a committed, admitted exact inventory. */
export function createWildzDurableSaveProcessor(database: WildzContinuityDatabase) {
  let cached: { scope: string; version: string; inventory: PlayState["inventory"] } | null = null;
  let saving = false;
  return async (message: WildzDurableSaveMessage): Promise<Extract<WildzDurableSaveReply, { ok: true }>> => {
    if (saving) throw Error("wildz_durable_save_busy");
    saving = true;
    try {
      const input = message.input, scope = `${encodeURIComponent(input.session.keyId)}:${encodeURIComponent(input.session.actorId)}`;
      if (!message.id || !message.inventoryVersion || !Array.isArray(input.playState.inventory)) throw Error("wildz_durable_save_message_invalid");
      if (message.reuseInventory && message.inventoryDelta) throw Error("wildz_durable_save_inventory_invalid");
      let inventory = input.playState.inventory;
      if (message.reuseInventory || message.inventoryDelta) {
        if (inventory.length || !cached || cached.scope !== scope || cached.version !== message.baseInventoryVersion) throw Error("wildz_durable_save_inventory_version_invalid");
        inventory = cached.inventory;
      }
      if (message.inventoryDelta) {
        const { length, changes } = message.inventoryDelta;
        if (!Number.isSafeInteger(length) || length < 0 || !Array.isArray(changes)) throw Error("wildz_durable_save_inventory_delta_invalid");
        inventory = inventory.slice(0, length);
        const indices = new Set<number>();
        for (const { index, card } of changes) {
          if (!Number.isSafeInteger(index) || index < 0 || index >= length || indices.has(index) || !card || !verifyAndAdmitWildsCard(card)) throw Error("wildz_durable_save_inventory_delta_invalid");
          indices.add(index); inventory[index] = card;
        }
        if (inventory.length !== length || Array.from(inventory).some(card => !card)) throw Error("wildz_durable_save_inventory_delta_invalid");
        inventory = retainAdmittedWildsInventory(inventory);
      } else if (!message.reuseInventory) {
        for (const card of inventory) if (!card || !verifyAndAdmitWildsCard(card)) throw Error("wildz_durable_save_card_invalid");
        inventory = retainAdmittedWildsInventory(inventory);
      }
      const playState = await saveWildzRestoredPlayState({ database, ...input, playState: { ...input.playState, inventory } });
      const pins = wildzInventoryPins(playState.inventory), matches = wildzInventoryPinsMatch(pins, inventory);
      cached = matches ? { scope, version: message.inventoryVersion, inventory: playState.inventory } : null;
      const includesInventory = Boolean(message.returnInventory || !matches);
      return { id: message.id, ok: true, playState: includesInventory ? playState : { ...playState, inventory: [] }, inventoryPins: pins, inventoryVersion: cached?.version ?? null, includesInventory };
    } finally { saving = false; }
  };
}
