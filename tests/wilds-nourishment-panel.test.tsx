import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildsNourishmentPanel } from '../src/features/play/WildsNourishmentPanel';
import { projectWildsNourishmentPlants } from '../src/features/play/wilds-nourishment';
import { projectWildsWildAnimals } from '../src/features/play/wilds-livestock';

const player = { x: 0, y: 0, z: -24 }, kaiUPulse = 1_749_127_042_100;
const plants = projectWildsNourishmentPlants({ player, radius: 28, kaiUPulse });
const animals = projectWildsWildAnimals({ player, radius: 28, kaiUPulse });
const text = (html: string) => html.replace(/<[^>]*>/g, ' ');

test('inspecting a distant plant includes its actionable details rather than an unrelated nearby list', () => {
  const plant = { ...plants[0]!, label: 'Inspected fruit tree', distance: 12, canGather: false };
  const props = { kaiUPulse, fuelPercent: 50, plants: [plant], inspectedId: plant.sourceId, onGather() {} };
  const html = renderToStaticMarkup(createElement(WildsNourishmentPanel, props));
  assert.match(text(html), /Inspected fruit tree/);
  assert.match(text(html), /Move closer on the ground to gather/);
  assert.match(html, /aria-label="Selected Inspected fruit tree"/);
});

test('the selected depleted crop explains regrowth in visible mobile text', () => {
  const plant = { ...plants[0]!, label: 'Picked tree', remaining: 0, distance: 1, canGather: false };
  const props = { kaiUPulse, fuelPercent: 50, plants: [plant], inspectedId: plant.sourceId, onGather() {} };
  const html = renderToStaticMarkup(createElement(WildsNourishmentPanel, props));
  assert.match(text(html), /This crop is depleted/);
  assert.match(text(html), /grows back with Kai days/);
});

test('inspecting wildlife shows both explicit choices and their requirements without silently hunting', () => {
  const animal = { ...animals.find(a => a.capturable)!, label: 'Inspected goat', distance: 12, canInteract: false };
  assert.ok(animal.animalId);
  const props = { kaiUPulse, fuelPercent: 50, animals: [animal], inspectedId: animal.animalId, onHunt() {}, onCapture() {} };
  const html = renderToStaticMarkup(createElement(WildsNourishmentPanel, props));
  assert.match(text(html), /Inspected goat/);
  assert.match(text(html), /Hunt/);
  assert.match(text(html), /Capture livestock/);
  assert.match(text(html), /Move within reach on the same ground/);
  assert.match(html, /aria-label="Selected Inspected goat"/);
});

test('nearby selected livestock exposes the farm requirement as visible text', () => {
  const animal = { ...animals.find(a => a.capturable)!, distance: 1, canInteract: true };
  const props = { kaiUPulse, fuelPercent: 50, animals: [animal], inspectedId: animal.animalId,
    captureBlocker: 'Finish a nearby room, habitat or garden to shelter livestock.', onHunt() {}, onCapture() {} };
  assert.match(text(renderToStaticMarkup(createElement(WildsNourishmentPanel, props))), /Finish a nearby room, habitat or garden/);
});
