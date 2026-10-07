import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildsNourishmentActions } from '../src/features/play/WildsNourishmentActions';
import { confirmWildsAnimalHunt, createWildsHuntAnimationFrame, writeWildsHuntAnimationFrame, WILDS_HUNT_PRESENTATION_MS, type WildsAnimalHuntRequest } from '../src/features/play/wilds-animal-interaction';
import { initialPlayState, applyWildsInput } from '../src/features/play/game-state';
import { createWildsLivestockState, projectWildsWildAnimals, wildsAnimalHead } from '../src/features/play/wilds-livestock';
import { availableWildsFood, projectWildsNourishmentPlants } from '../src/features/play/wilds-nourishment';
import { projectWildsWildAnimalPosition, wildsWildAnimalsForTile } from '../src/features/play/wilds-animal-ecology';

const animal = Array.from({ length: 9 }, (_, z) => Array.from({ length: 9 }, (_, x) => wildsWildAnimalsForTile(x - 4, z - 4))).flat(2).find(row => row.capturable)!;
const kai = 100_000_000, motion = projectWildsWildAnimalPosition(animal, kai);
const asset = initialPlayState.inventory[0]!, owner = asset.manifest.ownerReceizId;
const before = { ...initialPlayState, selectedAssetId: asset.id, player: { x: motion.position.x, z: motion.position.z },
  siteSpace: { ...initialPlayState.siteSpace, position: motion.position }, playerLivestock: createWildsLivestockState(owner) };
const request: WildsAnimalHuntRequest = { animal, ownerReceizId: owner, spaceId: before.siteSpace.spaceId,
  requestedKaiUPulse: kai, before: before.playerLivestock, hunterAssetId: asset.id,
  from: motion.position, position: motion.position, heading: motion.heading, gait: motion.gait, pose: motion.pose };

test('only an admitted finite hunt starts presentation, and meat is usable immediately', () => {
  assert.equal(confirmWildsAnimalHunt(request, before.playerLivestock, 0), null);
  const after = applyWildsInput(before, { type: 'hunt-animal', ownerReceizId: owner, animalId: animal.animalId,
    expectedAnimalHead: wildsAnimalHead(animal.animalId), kaiUPulse: kai, hunter: { kind: 'creature', assetId: asset.id, abilityIndex: 0 } });
  const effect = confirmWildsAnimalHunt(request, after.playerLivestock, 25);
  assert.ok(effect);
  assert.equal(effect.startedAtMs, 25);
  assert.equal(availableWildsFood(after.playerNourishment)[0]?.foodKind, 'wild-meat');
  assert.equal(confirmWildsAnimalHunt({ ...request, before: after.playerLivestock }, after.playerLivestock, 26), null, 'a settled individual cannot replay a hunt');
  assert.equal(confirmWildsAnimalHunt({ ...request, ownerReceizId: 'someone-else' }, after.playerLivestock, 25), null);
  assert.equal(confirmWildsAnimalHunt({ ...request, requestedKaiUPulse: kai + 1 }, after.playerLivestock, 25), null, 'old settlements cannot animate as a new hunt');
  const rejected = applyWildsInput(before, { type: 'hunt-animal', ownerReceizId: owner, animalId: animal.animalId,
    expectedAnimalHead: 'stale', kaiUPulse: kai, hunter: { kind: 'creature', assetId: asset.id, abilityIndex: 0 } });
  assert.equal(confirmWildsAnimalHunt(request, rejected.playerLivestock, 25), null);
});

test('hunting has travel, impact and disappearance in one reused, finite animation frame', () => {
  const frame = createWildsHuntAnimationFrame();
  assert.equal(writeWildsHuntAnimationFrame(frame, 0), frame);
  assert.equal(frame.flight, 0); assert.equal(frame.scale, 1);
  writeWildsHuntAnimationFrame(frame, 430); assert.equal(frame.flight, 1); assert.equal(frame.impact, 1);
  writeWildsHuntAnimationFrame(frame, 740); assert.equal(frame.scale, .5);
  writeWildsHuntAnimationFrame(frame, WILDS_HUNT_PRESENTATION_MS); assert.equal(frame.active, false); assert.equal(frame.scale, 0);
  for (let i = 0; i < 10_000; i++) assert.equal(writeWildsHuntAnimationFrame(frame, i / 20, true), frame);
  assert.equal(frame.impact, 0); assert.equal(frame.lean, 0); assert.equal(frame.lift, 0);
});

test('animal actions expose reachable hunt/capture without a Satchel and explain blocked actions', () => {
  const projected = projectWildsWildAnimals({ player: motion.position, radius: 3, kaiUPulse: kai }).find(row => row.animalId === animal.animalId)!;
  const props = { source: projected, player: motion.position, huntBlocker: null, captureBlocker: null, packFull: false,
    onClose() {}, onHunt() {}, onCapture() {}, onProduce() {}, onGather() {} };
  const html = renderToStaticMarkup(createElement(WildsNourishmentActions, props));
  assert.match(html, /aria-label="Hunt [^"]+"/); assert.match(html, /aria-label="Capture [^"]+"/);
  assert.match(html, /Close animal actions/); assert.doesNotMatch(html, /Satchel|disabled=""/);
  const far = renderToStaticMarkup(createElement(WildsNourishmentActions, { ...props, source: { ...projected, canInteract: false } }));
  assert.match(far, /Move closer on the same ground/); assert.equal((far.match(/disabled=""/g) ?? []).length, 2);
  const full = renderToStaticMarkup(createElement(WildsNourishmentActions, { ...props, packFull: true, captureBlocker: 'This farm is full.' }));
  assert.match(full, /food pack is full/); assert.match(full, /Capture: This farm is full/);
});

test('plant inspection exposes a compact gather action and preserves reach and pack limits', () => {
  const plant = projectWildsNourishmentPlants({ player: { x: 0, z: 0 }, radius: 28, kaiUPulse: kai })[0]!;
  const props = { source: { ...plant, canGather: true }, player: plant.position, huntBlocker: null, captureBlocker: null, packFull: false,
    onClose() {}, onHunt() {}, onCapture() {}, onProduce() {}, onGather() {} };
  const html = renderToStaticMarkup(createElement(WildsNourishmentActions, props));
  assert.match(html, /aria-label="Gather [^"]+"/); assert.match(html, /Close food actions/);
  assert.doesNotMatch(html, /Satchel|disabled=""/);
  const far = renderToStaticMarkup(createElement(WildsNourishmentActions, { ...props, source: { ...plant, canGather: false } }));
  assert.match(far, /Move closer on the ground/); assert.match(far, /disabled=""/);
  const full = renderToStaticMarkup(createElement(WildsNourishmentActions, { ...props, packFull: true }));
  assert.match(full, /Eat a portion to make room/); assert.match(full, /disabled=""/);
});
