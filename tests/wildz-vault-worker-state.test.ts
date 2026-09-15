import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createVaultWorkerDeltaReader, createVaultWorkerDeltaWriter } from "../src/lib/receiz/wildz-vault-worker-state";

test("vault worker retains cards across movement and sends only changed additions", () => {
  const original = createOwnerBoundInitialPlayState("owner", "2026-09-15T00:00:00.000Z");
  assert.ok(original.inventory.length);
  const write = createVaultWorkerDeltaWriter(), read = createVaultWorkerDeltaReader();
  const first = read(structuredClone(write(original)));
  const moved = { ...original, player: { ...original.player, x: original.player.x + 1 } };
  const delta = write(moved);
  assert.equal(delta.cards, undefined);
  assert.deepEqual(Object.keys(delta.playState), ["player"]);
  const next = read(structuredClone(delta));
  assert.equal(next.inventory, first.inventory);
  assert.equal(next.inventory[0], first.inventory[0]);
  assert.deepEqual(next, moved);
  const changed = { ...moved.inventory[0], synchronizedAt: "2026-09-15T01:00:00.000Z" };
  const updated = { ...moved, inventory: [changed, ...moved.inventory.slice(1)] };
  const change = write(updated);
  assert.deepEqual(change.cards?.changed, [changed]);
  assert.deepEqual(read(structuredClone(change)), updated);
  const removed = { ...updated, inventory: updated.inventory.slice(1) };
  const removal = write(removed);
  assert.deepEqual(removal.cards?.changed, []);
  assert.deepEqual(read(structuredClone(removal)), removed);
});
