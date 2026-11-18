import assert from "node:assert/strict";
import test from "node:test";
import { createWildzPlayerStateSerializer } from "../src/lib/performance/wildz-player-state-serializer";

test("player-state projection serialization completes through the worker without main-thread JSON work", async () => {
  const posted: unknown[] = [];
  const worker = {
    onmessage: null as ((event: MessageEvent<
      { id: string; ok: true; body: string } | { id: string; ok: false; error: string }
    >) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: { id: string }) {
      posted.push(message);
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: true, body: "{\"player\":true}" } } as MessageEvent));
    },
    terminate() {}
  };
  const serializer = createWildzPlayerStateSerializer({
    createWorker: () => worker,
    createId: () => "projection-1"
  });

  const body = await serializer.serialize({ playerId: "wildz" } as never);

  assert.equal(body, "{\"player\":true}");
  assert.equal((posted[0] as { id: string }).id, "projection-1");
});

test("movement messages retain unchanged admitted inventory and replace it after a capture", async () => {
  const { createWildzPlayerProjectionEncoder } = await import("../src/lib/performance/wildz-player-state-projection");
  const { createOwnerBoundInitialPlayState } = await import("../src/features/play/game-state");
  const { sealCollectedCard, wildsCardVerificationDiagnostics } = await import("../src/features/play/portable-card");
  const { admitLocallySealedWildsInventory } = await import("../src/features/play/admitted-inventory");
  const messages: Array<{ input: { playState: { inventory: unknown[] } }; reuseInventory?: boolean; inventoryDelta?: { length: number; changes: Array<{ index: number; card: unknown }> } }> = [];
  const encode = createWildzPlayerProjectionEncoder();
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: Parameters<typeof encode>[0]) {
      messages.push(message);
      const body = encode(structuredClone(message));
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: true, body } } as MessageEvent));
    }, terminate() {}
  };
  let id = 0;
  const serializer = createWildzPlayerStateSerializer({ createWorker: () => worker, createId: () => String(++id) });
  const input = { playerId: "movement_inventory", exportedAt: "2026-09-14T12:00:00.000Z", playState: createOwnerBoundInitialPlayState("movement_inventory", "2026-09-14T12:00:00.000Z"), settings: { avatarStyle: null, movementMode: "walk" as const, audio: {} }, personalEvents: [], receipts: [], canonicalCursor: { worldId: "wilds:global:v3" as const, revision: 0, eventId: null } };
  Object.freeze(input.playState.inventory);
  await serializer.serialize(input);
  const before = wildsCardVerificationDiagnostics().executions;
  const moved = JSON.parse((await serializer.serialize({ ...input, playState: { ...input.playState, player: { x: 3, z: 5 } } }))!);
  assert.equal(messages[1]!.reuseInventory, true);
  assert.deepEqual(messages[1]!.input.playState.inventory, []);
  assert.equal(moved.player.playState.inventory[0].id, input.playState.inventory[0]!.id);
  assert.deepEqual(moved.player.playState.player, { x: 3, z: 5 });
  assert.equal(wildsCardVerificationDiagnostics().executions, before);
  const caught = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: input.playerId, encounterId: "movement-new-card", capturedAt: input.exportedAt });
  const inventory = admitLocallySealedWildsInventory([...input.playState.inventory, caught]);
  const updated = JSON.parse((await serializer.serialize({ ...input, playState: { ...input.playState, inventory } }))!);
  assert.equal(messages[2]!.reuseInventory, undefined);
  assert.equal(updated.player.playState.inventory.length, 2);
  assert.deepEqual(messages[2]!.input.playState.inventory, []);
  assert.equal(messages[2]!.inventoryDelta!.changes.length, 1);
  assert.equal(messages[2]!.inventoryDelta!.changes[0]!.card, caught);
  const removed = JSON.parse((await serializer.serialize({ ...input, playState: { ...input.playState, inventory: input.playState.inventory } }))!);
  assert.equal(removed.player.playState.inventory.length, 1);
  assert.equal(removed.player.playState.inventory[0].id, input.playState.inventory[0]!.id);
  assert.deepEqual(messages[3]!.inventoryDelta, { length: 1, changes: [] });
  serializer.close();
  await serializer.serialize(input);
  assert.equal(messages[4]!.reuseInventory, undefined);
});

test("signed-in movement sends only new territory and reproduces the complete player projection across resets", async () => {
  const { createWildzPlayerProjectionEncoder } = await import("../src/lib/performance/wildz-player-state-projection");
  const { createOwnerBoundInitialPlayState } = await import("../src/features/play/game-state");
  const { normalizeWildsExplorationAtlas, revealWildsExplorationAt } = await import("../src/features/play/wilds-exploration-atlas");
  const { createWildsPlayerVault } = await import("../src/features/play/wilds-player-vault");
  const encode = createWildzPlayerProjectionEncoder();
  const messages: Parameters<typeof encode>[0][] = [];
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: Parameters<typeof encode>[0]) {
      messages.push(message);
      const body = encode(structuredClone(message));
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: true, body } } as MessageEvent));
    },
    terminate() {}
  };
  const serializer = createWildzPlayerStateSerializer({ createWorker: () => worker });
  const playerId = "atlas_sync", exportedAt = "2026-11-17T12:00:00.000Z";
  const state = createOwnerBoundInitialPlayState(playerId, exportedAt);
  const atlas = normalizeWildsExplorationAtlas({ version: 1, rows: Array.from({ length: 1200 }, (_, z) =>
    ({ z: z + 50, ranges: [{ minX: 3, maxX: 92 }] })) }, state.player);
  const input = { playerId, exportedAt, playState: { ...state, explorationAtlas: atlas },
    settings: { avatarStyle: null, movementMode: "walk" as const, audio: {} }, personalEvents: [], receipts: [],
    canonicalCursor: { worldId: "wilds:global:v3" as const, revision: 0, eventId: null } };
  const submit = async (map: typeof atlas, owner = playerId) => {
    const snapshot = { ...input, playerId: owner, playState: { ...input.playState, explorationAtlas: map } };
    const body = await serializer.serialize(snapshot);
    assert.equal(body, JSON.stringify({ player: createWildsPlayerVault(snapshot) }));
    return messages.at(-1)!.input.playState.explorationAtlas;
  };
  assert.equal((await submit(atlas)).rows.length, atlas.rows.length);
  assert.equal((await submit(atlas)).rows.length, 0);
  const extended = revealWildsExplorationAt(atlas, { x: 5500, z: 5200 });
  assert.ok((await submit(extended)).rows.length <= 3);
  assert.equal((await submit(state.explorationAtlas)).rows.length, state.explorationAtlas.rows.length);
  serializer.close();
  assert.equal((await submit(extended)).rows.length, extended.rows.length);
  assert.equal((await submit(extended, "other_sync")).rows.length, extended.rows.length);
  const last = messages.at(-1)!;
  assert.throws(() => encode({ ...last, atlasBaseId: "unavailable" }), /atlas_missing/);
});
