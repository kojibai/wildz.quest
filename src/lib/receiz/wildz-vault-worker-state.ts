import type { PortableCardAsset } from "../../features/play/portable-card";
import type { PlayState } from "../../features/play/game-state";

export type VaultWorkerDelta = {
  cards?: { order: string[]; changed: PortableCardAsset[] };
  playState: Partial<Omit<PlayState, "inventory">>;
};

/** Immutable runtime references make movement independent of vault size. */
export function createVaultWorkerDeltaWriter() {
  let previous: PlayState | undefined;
  let cards = new Map<string, PortableCardAsset>();
  return (state: PlayState): VaultWorkerDelta => {
    const delta: VaultWorkerDelta = { playState: {} };
    if (previous?.inventory !== state.inventory) {
      const changed = state.inventory.filter(card => cards.get(card.id) !== card);
      delta.cards = { order: state.inventory.map(card => card.id), changed };
      cards = new Map(state.inventory.map(card => [card.id, card]));
    }
    for (const key of Object.keys(state) as (keyof PlayState)[]) {
      if (key !== "inventory" && (!previous || previous[key] !== state[key])) {
        Object.assign(delta.playState, { [key]: state[key] });
      }
    }
    previous = state;
    return delta;
  };
}

export function createVaultWorkerDeltaReader() {
  let state: PlayState | undefined;
  let cards = new Map<string, PortableCardAsset>();
  return (delta: VaultWorkerDelta): PlayState => {
    let inventory = state?.inventory;
    if (delta.cards) {
      for (const card of delta.cards.changed) cards.set(card.id, card);
      inventory = delta.cards.order.map(id => {
        const card = cards.get(id);
        if (!card) throw new Error("wildz_vault_worker_card_missing");
        return card;
      });
      cards = new Map(inventory.map(card => [card.id, card]));
    }
    if (!inventory) throw new Error("wildz_vault_worker_state_missing");
    state = { ...state, ...delta.playState, inventory } as PlayState;
    return state;
  };
}
