import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildzWorldControls } from '../src/features/play/WildzWorldControls';
import { initialPlayState, applyWildsInput } from '../src/features/play/game-state';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { initialWorldOverlayState } from '../src/features/play/world-overlay-state';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { availableWildsFood, consumeWildsNourishment, createWildsNourishmentState, creditWildsAnimalFood, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, type WildsNourishmentState, type WildsNourishmentPlant } from '../src/features/play/wilds-nourishment';
import { createWildsAnimalFoodReceipt, wildsWildAnimalsForTile } from '../src/features/play/wilds-animal-ecology';
import { projectWildsNourishmentQuickUse } from '../src/features/play/wilds-nourishment-quick-use';
import * as quickUse from '../src/features/play/wilds-nourishment-quick-use';

const owner = 'hud-food-owner', kai = Number(KAI_N_DAY_MICRO) * 100;
const plant = (() => {
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const berries = wildsNourishmentPlantsForTile(x, z).find(p => p.foodKind === 'wild-berries');
    if (berries) return berries;
  }
  throw new Error('Expected canonical berries in the test neighborhood');
})();
const ignore = () => {};
function gather(state = createWildsNourishmentState(owner), source: WildsNourishmentPlant = plant) {
  assert.ok(plant);
  const result = gatherWildsNourishment({ state, ownerReceizId: owner, sourceId: source.sourceId,
    expectedSourceHead: wildsNourishmentSourceAt(source, state.sources[source.sourceId], kai).head,
    kaiUPulse: kai, player: source.position, spaceId: 'wildz.space.outer.v1' });
  assert.ok(result.ok);
  return result.state;
}
function markup(state: WildsNourishmentState | undefined, fuelPercent = 50) {
  const props = {
    nearbyCards: [], activeCard: null, companionProgress: initialPlayState.companionProgress,
    cardConditions: initialPlayState.adventureConditions, cameraHeadingRef: { current: 0 },
    movementMode: 'walk' as const, cardOrder: 'newest' as const, commandItems: [],
    dismissSignal: 0, exclusiveOwner: 'none' as const, overlayState: initialWorldOverlayState,
    overlayDispatch: ignore, gestureCancelSignal: 0, newRosterAssetId: null,
    onCardOrderChange: ignore, onInput: ignore, onMovementModeChange: ignore, onSelectCard: ignore,
    onRest: ignore, aerialEnergy: 100, aerialMode: 'ground' as const,
    traversalCapabilities: [], onAerialToggle: ignore, onOpenCreation: ignore,
    nourishment: { state, kaiUPulse: kai, fuelPercent, onEat: ignore, onOpen: ignore }
  };
  return renderToStaticMarkup(createElement(WildzWorldControls, props));
}

// A HUD that counts consumed items or keeps a separate counter misses a real gather/eat transition.
test('the nourishment pill reflects gathered and consumed food from the live player checkpoint', () => {
  assert.match(markup(undefined), /aria-label="0 food portions stored"/);
  const food = gather();
  assert.match(markup(food), /aria-label="1 food portions stored"/);
  const player = { ...initialPlayState, playerNourishment: food, playerBreaths: createPlayerBreaths(kai, 50) };
  const eaten = applyWildsInput(player, { type: 'eat-food', ownerReceizId: owner,
    itemId: Object.keys(food.items)[0], kaiUPulse: kai });
  assert.notEqual(eaten, player);
  assert.match(markup(eaten.playerNourishment), /aria-label="0 food portions stored"/);
});

// Eating from the shortcut must be unavailable at the same body limits as the food panel/reducer.
test('empty or full-fuel food keeps the eat action with its limit and separate swipe access to Satchel', () => {
  const food = gather();
  assert.match(markup(food, 100), /aria-label="Eat one wild berries"/);
  assert.match(markup(food, 100), /Your fuel is full/);
  assert.match(markup(undefined), /Gather food to eat/);
  assert.match(markup(undefined), /aria-label="Eat one food"/);
  assert.match(markup(food, 100), /swipe up to open the nourishment Satchel/);
  assert.doesNotMatch(markup(food, 100), /<button[^>]*aria-label="Eat one[^>]*disabled/);
  assert.doesNotMatch(markup(undefined), /<button[^>]*aria-label="Eat one[^>]*disabled/);
});

test('a full digestion window blocks quick eating without hiding stored food', () => {
  let food = createWildsNourishmentState(owner);
  outer: for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    for (const bush of wildsNourishmentPlantsForTile(x, z).filter(p => p.foodKind === 'wild-berries')) {
      for (let i = 0; i < bush.capacity; i++) {
        food = gather(food, bush);
        if (availableWildsFood(food).length === 8) break outer;
      }
    }
  }
  assert.equal(availableWildsFood(food).length, 8);
  for (let i = 0; i < 7; i++) {
    const consumed = consumeWildsNourishment({ state: food, ownerReceizId: owner,
      itemId: availableWildsFood(food)[0].itemId, kaiUPulse: kai, reserveMicroBreaths: PLAYER_BREATH_CAPACITY_MICRO / 2 });
    assert.ok(consumed.ok);
    food = consumed.state;
  }
  const html = markup(food);
  assert.match(html, /aria-label="1 food portions stored"/);
  assert.match(html, /aria-label="Eat one wild berries"/);
  assert.match(html, /Let your meal digest/);
});

test('switching fruit and vegetables counts and eats only that selected food', () => {
  let vegetable: WildsNourishmentPlant | undefined;
  for (let z = -2; z <= 2 && !vegetable; z++) for (let x = -2; x <= 2 && !vegetable; x++) {
    vegetable = wildsNourishmentPlantsForTile(x, z).find(p => p.foodKind === 'wild-vegetable');
  }
  assert.ok(vegetable);
  const food = gather(gather(gather(), plant), vegetable);
  const fruit = projectWildsNourishmentQuickUse(food, kai, 50, 'fruit');
  const vegetables = projectWildsNourishmentQuickUse(food, kai, 50, 'vegetables');
  assert.equal(fruit.count, 2);
  assert.equal(fruit.item?.foodKind, 'wild-berries');
  assert.equal(vegetables.count, 1);
  assert.equal(vegetables.item?.foodKind, 'wild-vegetable');
  const eaten = consumeWildsNourishment({ state: food, ownerReceizId: owner, itemId: vegetables.item!.itemId,
    kaiUPulse: kai, reserveMicroBreaths: PLAYER_BREATH_CAPACITY_MICRO / 2 });
  assert.ok(eaten.ok);
  assert.equal(projectWildsNourishmentQuickUse(eaten.state, kai, 50, 'vegetables').count, 0);
  assert.equal(projectWildsNourishmentQuickUse(eaten.state, kai, 50, 'vegetables').item, null);
  assert.equal(projectWildsNourishmentQuickUse(eaten.state, kai, 50, 'fruit').count, 2);
});

test('only a newly collected food portion switches the active nourishment type', () => {
  let vegetable: WildsNourishmentPlant | undefined;
  for (let z = -2; z <= 2 && !vegetable; z++) for (let x = -2; x <= 2 && !vegetable; x++) {
    vegetable = wildsNourishmentPlantsForTile(x, z).find(p => p.foodKind === 'wild-vegetable');
  }
  assert.ok(vegetable);
  const fruit = gather();
  const vegetables = gather(fruit, vegetable);
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory?.(fruit, vegetables), 'vegetables');
  const moreFruit = gather(vegetables);
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory?.(vegetables, moreFruit), 'fruit');
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory?.(undefined, moreFruit), 'fruit', 'Latest capture wins even within the same Kai pulse');
  const eaten = consumeWildsNourishment({ state: moreFruit, ownerReceizId: owner, itemId: availableWildsFood(moreFruit)[0].itemId,
    kaiUPulse: kai, reserveMicroBreaths: PLAYER_BREATH_CAPACITY_MICRO / 2 });
  assert.ok(eaten.ok);
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory?.(moreFruit, eaten.state), null);
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory?.(eaten.state, {...eaten.state, lastKaiUPulse:kai + 1}), null);
});

test('hunted meat is counted, selected and eaten through the same food shortcut as crops', () => {
  const crops = gather(gather());
  const animal = Array.from({ length: 9 }, (_, z) => Array.from({ length: 9 }, (_, x) => wildsWildAnimalsForTile(x - 4, z - 4))).flat(2)[0];
  assert.ok(animal);
  const credited = creditWildsAnimalFood(crops, createWildsAnimalFoodReceipt(animal, 'hunt', 0, kai));
  assert.ok(credited.ok);
  const food = credited.state;
  const meat = projectWildsNourishmentQuickUse(food, kai, 50, 'meat' as quickUse.WildsNourishmentCategory);
  assert.equal(meat.count, 1);
  assert.equal(meat.item?.foodKind, 'wild-meat');
  assert.equal(projectWildsNourishmentQuickUse(food, kai, 50, 'fruit').count, 2);
  assert.equal(quickUse.recentlyGatheredWildsNourishmentCategory(crops, food), 'meat');
  assert.match(markup(food), /aria-label="Eat one [^"]*meat"/);
  const eaten = consumeWildsNourishment({ state: food, ownerReceizId: owner, itemId: meat.item!.itemId,
    kaiUPulse: kai, reserveMicroBreaths: PLAYER_BREATH_CAPACITY_MICRO / 2 });
  assert.ok(eaten.ok);
  assert.equal(projectWildsNourishmentQuickUse(eaten.state, kai, 50, 'meat' as quickUse.WildsNourishmentCategory).count, 0);
  assert.equal(projectWildsNourishmentQuickUse(eaten.state, kai, 50, 'fruit').count, 2);
});

test('food swipes cycle both ways through meat only when meat is stored', () => {
  assert.equal(quickUse.nextWildsNourishmentCategory('fruit', 'right', true), 'vegetables');
  assert.equal(quickUse.nextWildsNourishmentCategory('vegetables', 'right', true), 'meat');
  assert.equal(quickUse.nextWildsNourishmentCategory('meat', 'right', true), 'fruit');
  assert.equal(quickUse.nextWildsNourishmentCategory('fruit', 'left', true), 'meat');
  assert.equal(quickUse.nextWildsNourishmentCategory('meat', 'left', true), 'vegetables');
  assert.equal(quickUse.nextWildsNourishmentCategory('vegetables', 'right', false), 'fruit');
  assert.equal(quickUse.nextWildsNourishmentCategory('fruit', 'left', false), 'vegetables');
});
