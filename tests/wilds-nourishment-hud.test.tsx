import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildzWorldControls } from '../src/features/play/WildzWorldControls';
import { initialPlayState, applyWildsInput } from '../src/features/play/game-state';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { initialWorldOverlayState } from '../src/features/play/world-overlay-state';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { availableWildsFood, consumeWildsNourishment, createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, type WildsNourishmentState, type WildsNourishmentPlant } from '../src/features/play/wilds-nourishment';

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
test('quick eating is disabled when empty or full of fuel while the food Satchel stays available', () => {
  const food = gather();
  assert.match(markup(food, 100), /<button[^>]*aria-label="Eat one[^>]*disabled/);
  assert.match(markup(food, 100), /Your fuel is full/);
  assert.match(markup(undefined), /Gather food to eat/);
  assert.match(markup(food), /aria-label="Open nourishment Satchel"/);
  assert.doesNotMatch(markup(food), /<button[^>]*aria-label="Eat one[^>]*disabled/);
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
  assert.match(html, /<button[^>]*aria-label="Eat one[^>]*disabled/);
  assert.match(html, /Let your meal digest/);
});
