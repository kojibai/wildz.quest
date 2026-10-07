import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnerBoundInitialPlayState } from '../src/features/play/game-state';
import { createPlayerBreaths } from '../src/features/play/player-breath-energy';
import { createWildsNourishmentState, gatherWildsNourishment, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, creditWildsImportedPackageFood, reconcileWildsNourishmentCustody, restoreWildsNourishmentState } from '../src/features/play/wilds-nourishment';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';
import { recoverWildsNativeFoodFuel } from '../src/features/play/wilds-food-fuel-recovery';
const owner = 'receiver.receiz.id';
function fixture() {
  const sourceOwner = 'sender.receiz.id', plant = wildsNourishmentPlantsForTile(3, 3)[0]!;
  const gathered = gatherWildsNourishment({ state: createWildsNourishmentState(sourceOwner), ownerReceizId: sourceOwner, sourceId: plant.sourceId, expectedSourceHead: wildsNourishmentSourceAt(plant, undefined, 100).head, kaiUPulse: 100, player: plant.position, spaceId: 'wildz.space.outer.v1' });
  if (!gathered.ok) throw Error('fixture');
  const member = { kind: 'food' as const, id: gathered.item.itemId, foodItem: gathered.item, nourishment: gathered.state };
  const credited = creditWildsImportedPackageFood(createWildsNourishmentState(owner), [member], { packageId: 'package:one', receiptId: 'native:one' }, 101);
  const world = { ...initialWildsWorldProjection(), foodItems: { [member.id]: member }, foodCustody: { [member.id]: { ownerReceizId: owner, packageId: 'package:one', receiptId: 'native:one' } }, consumedFoodItems: { [member.id]: 'consume:one' }, foodConsumptionReceipts: { [member.id]: { ownerReceizId: owner, commandId: 'consume:one', kaiUPulse: 102, sourceReceiptId: 'native:one' } } };
  const state = { ...createOwnerBoundInitialPlayState(owner), playerNourishment: reconcileWildsNourishmentCustody(credited, world, owner)!, playerBreaths: createPlayerBreaths(101, 20), energy: 20 };
  return { member, world, state };
}
test('a lost eating response recovers native-owned meal fuel once, including after local restart', () => {
  const { member, world, state } = fixture();
  const recovered = recoverWildsNativeFoodFuel(state, world, owner, 103);
  assert.ok(recovered.playerBreaths!.reserveMicroBreaths > state.playerBreaths.reserveMicroBreaths);
  assert.equal(recovered.playerNourishment!.items[member.id]!.consumedKaiUPulse, 103);
  const restored = { ...recovered, playerNourishment: restoreWildsNourishmentState(JSON.parse(JSON.stringify(recovered.playerNourishment)), owner)! };
  assert.equal(recoverWildsNativeFoodFuel(restored, world, owner, 104), restored);
});
test('food fuel recovery rejects foreign custody, mismatched source receipts and future consumption', () => {
  const { member, world, state } = fixture(), receipt = world.foodConsumptionReceipts[member.id]!;
  assert.equal(recoverWildsNativeFoodFuel(state, world, 'intruder.receiz.id', 103), state);
  assert.equal(recoverWildsNativeFoodFuel(state, { ...world, foodCustody: { [member.id]: { ...world.foodCustody[member.id]!, ownerReceizId: 'intruder.receiz.id' } } }, owner, 103), state);
  assert.equal(recoverWildsNativeFoodFuel(state, { ...world, foodConsumptionReceipts: { [member.id]: { ...receipt, sourceReceiptId: 'unrelated' } } }, owner, 103), state);
  assert.equal(recoverWildsNativeFoodFuel(state, world, owner, 101), state);
});
test('an admitted meal waits for body capacity without disappearing, then credits when ready', () => {
  const { member, world, state } = fixture(), full = { ...state, playerBreaths: createPlayerBreaths(103, 100), energy: 100 };
  assert.equal(recoverWildsNativeFoodFuel(full, world, owner, 103), full);
  assert.equal(full.playerNourishment.items[member.id]!.consumedKaiUPulse, undefined);
  const hungry = { ...full, playerBreaths: createPlayerBreaths(104, 20), energy: 20 };
  assert.notEqual(recoverWildsNativeFoodFuel(hungry, world, owner, 104), hungry);
});
