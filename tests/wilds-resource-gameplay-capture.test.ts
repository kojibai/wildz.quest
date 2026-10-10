import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, initialPlayState, type PlayState, type WildsInput } from "../src/features/play/game-state";
import { createPlayerBreaths } from "../src/features/play/player-breath-energy";
import { createWildsNourishmentState, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from "../src/features/play/wilds-nourishment";
import { createWildsResourceCaptureMarker, wildsResourceCaptureMarkerId, wildsResourceCaptureCommitted } from "../src/features/play/wilds-resource-gameplay-capture";
import { replayWildsResourceGameplayV128 } from "../src/lib/receiz/wilds-resource-gameplay-v128";

const OWNER = "capture_keeper.receiz.id", KAI = 100_000_000;
const binding = { ownerHandle: OWNER, gameplayOwnerId: OWNER };
const plant = Array.from({ length: 9 }, (_, i) => wildsNourishmentPlantsForTile(i - 4, -4)).flat().find(candidate => candidate.capacity >= 2)!;
function initial(): PlayState {
  return { ...initialPlayState, player: { x: plant.position.x, z: plant.position.z }, siteSpace: { ...initialPlayState.siteSpace, position: plant.position },
    energy: 20, playerBreaths: createPlayerBreaths(KAI, 20), playerNourishment: createWildsNourishmentState(OWNER) };
}
function gather(state: PlayState, kaiUPulse: number): Extract<WildsInput, { type: "gather-food" }> {
  return { type: "gather-food", ownerReceizId: OWNER, sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, state.playerNourishment?.sources[plant.sourceId], kaiUPulse).head, kaiUPulse };
}

test("two batched gathers and a consume retain every admitted command using the final reducer state", async () => {
  const before = initial(), firstInput = gather(before, KAI), first = applyWildsInput(before, firstInput);
  const secondInput = gather(first, KAI), second = applyWildsInput(first, secondInput);
  assert.equal(Object.keys(second.playerNourishment!.items).length, 2);
  const itemId = Object.keys(first.playerNourishment!.items)[0]!;
  const consumeInput: WildsInput = { type: "eat-food", ownerReceizId: OWNER, itemId, kaiUPulse: KAI + 2 };
  const final = applyWildsInput(second, consumeInput);
  assert.equal(final.playerNourishment!.items[itemId]!.consumedKaiUPulse, KAI + 2);
  const markers = [createWildsResourceCaptureMarker(before, first, firstInput, binding), createWildsResourceCaptureMarker(first, second, secondInput, binding), createWildsResourceCaptureMarker(second, final, consumeInput, binding)];
  assert.ok(markers.every(marker => marker && wildsResourceCaptureCommitted(marker, final, binding)));
  assert.ok(markers.every(marker => !Object.hasOwn(marker!, "after") && !Object.hasOwn(marker!, "before")));
  const replay = await replayWildsResourceGameplayV128({ gameplayOwnerId: OWNER, commands: markers.map(marker => marker!.command) });
  assert.deepEqual(replay.nourishment, final.playerNourishment);
  assert.equal(Object.keys(replay.members).length, 1);
});

test("an identity switch cannot move a pending old-player command into the new player's custody", () => {
  const before = initial(), action = gather(before, KAI), after = applyWildsInput(before, action);
  const marker = createWildsResourceCaptureMarker(before, after, action, binding)!;
  assert.equal(wildsResourceCaptureCommitted(marker, after, binding), true);
  // Old state can survive the first render of a new identity. Its marker keeps
  // the original binding even before React's cleanup effect runs.
  assert.equal(wildsResourceCaptureCommitted(marker, after, { ...binding, ownerHandle: "another.receiz.id" }), false);
  assert.equal(wildsResourceCaptureCommitted(marker, after, { ...binding, gameplayOwnerId: "another-player" }), false);
  assert.equal(createWildsResourceCaptureMarker(before, after, action, { ownerHandle: "another.receiz.id", gameplayOwnerId: "another-player" }), null);
  const wrongState = { ...after, playerNourishment: { ...after.playerNourishment!, ownerReceizId: "another-player" } };
  assert.equal(wildsResourceCaptureCommitted(marker, wrongState, binding), false);
});

test("abandoned updater branches and rejected duplicate gathers do not enter custody", () => {
  const before = initial(), action = gather(before, KAI), abandoned = applyWildsInput(before, action);
  const marker = createWildsResourceCaptureMarker(before, abandoned, action, binding)!;
  assert.equal(wildsResourceCaptureCommitted(marker, before, binding), false);
  const duplicate = applyWildsInput(abandoned, action);
  assert.equal(duplicate, abandoned);
  assert.equal(createWildsResourceCaptureMarker(abandoned, duplicate, action, binding), null);
});

test("a replayed updater with an equivalent crop consequence records that birth only once", async () => {
  const before = initial(), action = gather(before, KAI), first = applyWildsInput(before, action);
  const rebased = { ...before, player: { ...before.player, x: before.player.x + .1 } }, replayed = applyWildsInput(rebased, action);
  const markers = [createWildsResourceCaptureMarker(before, first, action, binding)!, createWildsResourceCaptureMarker(rebased, replayed, action, binding)!];
  assert.equal(markers[0]!.command.kind, "food.gather"); assert.equal(markers[1]!.command.kind, "food.gather");
  assert.notDeepEqual(markers[0]!.command, markers[1]!.command);
  const pending = new Map(markers.map(marker => [wildsResourceCaptureMarkerId(marker), marker]));
  assert.equal(pending.size, 1);
  const committed = [...pending.values()].filter(marker => wildsResourceCaptureCommitted(marker, replayed, binding));
  const replay = await replayWildsResourceGameplayV128({ gameplayOwnerId: OWNER, commands: committed.map(marker => marker.command) });
  assert.deepEqual(replay.nourishment, replayed.playerNourishment);
});
