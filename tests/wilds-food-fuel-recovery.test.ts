import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWildsInput, createOwnerBoundInitialPlayState, initialPlayState, restorePlayState, serializePlayState } from '../src/features/play/game-state';
import { createPlayerBreaths, PLAYER_BREATH_CAPACITY_MICRO } from '../src/features/play/player-breath-energy';
import { availableWildsFood, createWildsNourishmentState, gatherWildsNourishment, mergeWildsImportedNourishment, WILDS_NOURISHMENT_DIGESTION_UPULSES, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt, creditWildsImportedPackageFood, reconcileWildsNourishmentCustody, restoreWildsNourishmentState } from '../src/features/play/wilds-nourishment';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';
import { hasRecoverableWildsNativeAdmittedFood, mergeWildsNativeFoodFuelDisplay, prepareWildsNativeFoodFuelRecovery, recoverWildsNativeAdmittedFoodFuel, recoverWildsNativeFoodFuel } from '../src/features/play/wilds-food-fuel-recovery';
import { mergeWildsNativeNourishmentDisplay, wildsFoodConsumptionRoute, wildsNativeFoodIds } from '../src/features/play/wilds-native-inventory-display';
import { replayWildzNativeWorldLaw } from '../src/features/play/wildz-native-world-law';
import { wildsAnimalHead } from '../src/features/play/wilds-livestock';
import { projectWildsWildAnimalPosition, wildsWildAnimalsForTile } from '../src/features/play/wilds-animal-ecology';
const owner = 'receiver.receiz.id';
function gatheredNativeFixture(reserveMicroBreaths=createPlayerBreaths(100,20).reserveMicroBreaths) {
 const plant=wildsNourishmentPlantsForTile(-4,-4).find(plant=>plant.foodKind==='orchard-fruit')!,kaiUPulse=100;
 const gather={kind:'food.gather' as const,actorId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,kaiUPulse).head,kaiUPulse,player:plant.position,spaceId:'wildz.space.outer.v1'};
 const gathered=replayWildzNativeWorldLaw([gather]),item=Object.values(gathered.nourishment[owner].items)[0]!;
 const consumed=replayWildzNativeWorldLaw([gather,{kind:'food.consume',actorId:owner,itemId:item.itemId,commandId:`native-eat:${item.itemId}`,kaiUPulse:101,reserveMicroBreaths}]);
 const local={...createOwnerBoundInitialPlayState(owner),playerNourishment:mergeWildsNativeNourishmentDisplay(undefined,gathered.nourishment[owner])!,playerBreaths:createPlayerBreaths(100,20),energy:20};
 return {item,gathered,consumed,local};
}
test('a lost native gather eating reply credits the root-accepted exact portion once after cold reopening',()=>{
 const {item,consumed,local}=gatheredNativeFixture();
 const restored=restorePlayState(serializePlayState(local),owner),receipt=consumed.foodConsumptionReceipts[item.itemId];
 assert.ok(receipt,'the complete accepted native replay must retain the actual consumption');
 const source=prepareWildsNativeFoodFuelRecovery(consumed,owner);
 const recovered=recoverWildsNativeAdmittedFoodFuel(restored,source,owner,102);
 assert.notEqual(recovered,restored);
 assert.equal(recovered.playerBreaths!.restoredMicroBreaths-restored.playerBreaths!.restoredMicroBreaths,receipt.fuelMicroBreaths);
 assert.equal(recovered.playerNourishment!.items[item.itemId].consumedFuelMicroBreaths,receipt.fuelMicroBreaths);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(restorePlayState(serializePlayState(recovered),owner),source,owner,103).playerBreaths!.restoredMicroBreaths,recovered.playerBreaths!.restoredMicroBreaths);
 const refreshed=mergeWildsNativeFoodFuelDisplay(restored,source,owner,102,wildsNativeFoodIds(consumed));
 assert.equal(refreshed.playerBreaths!.restoredMicroBreaths,recovered.playerBreaths!.restoredMicroBreaths,'source refresh credits before it merges the accepted consumed meal');
 assert.equal(mergeWildsNativeFoodFuelDisplay(refreshed,source,owner,103,wildsNativeFoodIds(consumed)).playerBreaths!.restoredMicroBreaths,recovered.playerBreaths!.restoredMicroBreaths);
});
test('deferred native fuel survives save/refresh and cannot exceed the exact amount accepted before a lost reply',()=>{
 const {item,consumed,local}=gatheredNativeFixture(PLAYER_BREATH_CAPACITY_MICRO-7),source=prepareWildsNativeFoodFuelRecovery(consumed,owner);
 assert.equal(consumed.foodConsumptionReceipts[item.itemId].fuelMicroBreaths,7);
 const full={...local,playerBreaths:createPlayerBreaths(101,100),energy:100};
 const pending=mergeWildsNativeFoodFuelDisplay(full,source,owner,101,wildsNativeFoodIds(consumed));
 assert.deepEqual(pending.playerNourishment!.nativePendingFuelItemIds,[item.itemId]);
 assert.equal(pending.playerNourishment!.items[item.itemId].consumedKaiUPulse,undefined);
 assert.equal(availableWildsFood(pending.playerNourishment).length,0,'the accepted consumed portion cannot be offered or eaten again');
 assert.equal(wildsFoodConsumptionRoute({owner,itemId:item.itemId,nourishment:pending.playerNourishment,nativeSource:null,world:null,hasNativeIdentity:true}),'wait','an accepted portion cannot trigger a second native consume through a stale eat control');
 assert.equal(pending.playerBreaths!.restoredMicroBreaths,full.playerBreaths.restoredMicroBreaths);
 const restored=restorePlayState(serializePlayState(pending),owner);
 assert.deepEqual(restored.playerNourishment!.nativePendingFuelItemIds,[item.itemId]);
 assert.ok(hasRecoverableWildsNativeAdmittedFood(restored,source,owner));
 assert.equal(recoverWildsNativeAdmittedFoodFuel(restored,source,owner,101),restored,'a full body defers the whole exact credit');
 const partial={...restored,playerBreaths:{...createPlayerBreaths(101,100),reserveMicroBreaths:PLAYER_BREATH_CAPACITY_MICRO-6}};
 assert.equal(recoverWildsNativeAdmittedFoodFuel(partial,source,owner,101),partial,'insufficient capacity never truncates the accepted once-only reward');
 const hungry={...restored,playerBreaths:createPlayerBreaths(103,20),energy:20};
 const recovered=recoverWildsNativeAdmittedFoodFuel(hungry,source,owner,103);
 assert.equal(recovered.playerBreaths!.restoredMicroBreaths,7,'later body capacity never expands a partial accepted portion');
 assert.equal(recovered.playerNourishment!.items[item.itemId].consumedFuelMicroBreaths,7);
 assert.deepEqual(recovered.playerNourishment!.nativePendingFuelItemIds,[]);
 assert.equal(mergeWildsNativeFoodFuelDisplay(recovered,source,owner,104,wildsNativeFoodIds(consumed)).playerNourishment!.items[item.itemId].consumedKaiUPulse,103,'native refresh never replaces the local once-only credit with accepted source time');
 const competing=mergeWildsImportedNourishment(restored.playerNourishment,recovered.playerNourishment)!;
 assert.equal(competing.items[item.itemId].consumedKaiUPulse,103,'a stale owner save cannot reopen a credited native portion');
 assert.deepEqual(competing.nativePendingFuelItemIds,[]);
 assert.equal(recoverWildsNativeAdmittedFoodFuel({...hungry,playerNourishment:competing},source,owner,104).playerBreaths!.restoredMicroBreaths,0);
});
test('native meal fuel rejects foreign, forged, future or mismatched exact source receipts',()=>{
 const {item,consumed,local}=gatheredNativeFixture(),receipt=consumed.foodConsumptionReceipts[item.itemId],source=prepareWildsNativeFoodFuelRecovery(consumed,owner);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(local,source,'foreign.receiz.id',102),local);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(local,source,owner,100),local);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(local,{...source},owner,102),local,'a copied cache descriptor is not a prepared accepted source');
 for(const change of [{ownerReceizId:'foreign.receiz.id'},{sourceItemDigest:`sha256:${'f'.repeat(64)}`},{fuelMicroBreaths:receipt.fuelMicroBreaths+1},{itemId:'another-item'},{commandId:''}]){
  const invalid=prepareWildsNativeFoodFuelRecovery({...consumed,foodConsumptionReceipts:{[item.itemId]:{...receipt,...change}}},owner);
  assert.equal(recoverWildsNativeAdmittedFoodFuel(local,invalid,owner,102),local,JSON.stringify(change));
 }
 const mismatched={...local,playerNourishment:{...local.playerNourishment,items:{[item.itemId]:{...item,gatheredKaiUPulse:99}}}};
 assert.equal(recoverWildsNativeAdmittedFoodFuel(mismatched,source,owner,102),mismatched);
});
test('a local digestion window defers an accepted native meal without consuming or crediting it again',()=>{
 const {item,local,consumed}=gatheredNativeFixture(),source=prepareWildsNativeFoodFuelRecovery(consumed,owner);
 const plants=Array.from({length:9},(_,i)=>wildsNourishmentPlantsForTile(i-4,-4)).flat().filter(plant=>plant.foodKind==='orchard-fruit' && plant.sourceId!==item.sourceId);
 let nourishment=local.playerNourishment;
 const legacyIds:string[]=[];
 for(const plant of plants.slice(0,2))for(let slot=0;slot<2;slot++){
  const gathered=gatherWildsNourishment({state:nourishment,ownerReceizId:owner,sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,nourishment.sources[plant.sourceId],100).head,kaiUPulse:100,player:plant.position,spaceId:'wildz.space.outer.v1'});
  assert.ok(gathered.ok);nourishment=gathered.state;legacyIds.push(gathered.item.itemId);
 }
 let body:ReturnType<typeof createOwnerBoundInitialPlayState>={...local,playerNourishment:nourishment};
 for(const itemId of legacyIds)body=applyWildsInput(body,{type:'eat-food',ownerReceizId:owner,itemId,kaiUPulse:100});
 const pending=mergeWildsNativeFoodFuelDisplay(body,source,owner,101,wildsNativeFoodIds(consumed));
 assert.deepEqual(pending.playerNourishment!.nativePendingFuelItemIds,[item.itemId]);
 assert.equal(pending.playerBreaths!.restoredMicroBreaths,body.playerBreaths!.restoredMicroBreaths);
 const later=recoverWildsNativeAdmittedFoodFuel(pending,source,owner,100+WILDS_NOURISHMENT_DIGESTION_UPULSES+1);
 assert.equal(later.playerBreaths!.restoredMicroBreaths-body.playerBreaths!.restoredMicroBreaths,consumed.foodConsumptionReceipts[item.itemId].fuelMicroBreaths);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(later,source,owner,100+WILDS_NOURISHMENT_DIGESTION_UPULSES+2),later);
});
test('accepted animal meal fuel recovers once across a lost reply and cold save',()=>{
 const animal=Array.from({length:9},(_,i)=>wildsWildAnimalsForTile(i-4,-4)).flat().find(animal=>animal.species==='ground-bird')!;
 const card=initialPlayState.inventory[0]!,hunt={kind:'animal.hunt' as const,actorId:owner,animalId:animal.animalId,expectedAnimalHead:wildsAnimalHead(animal.animalId),kaiUPulse:100,player:projectWildsWildAnimalPosition(animal,100).position,spaceId:'wildz.space.outer.v1',hunter:{kind:'creature' as const,asset:card,condition:initialPlayState.adventureConditions[card.id],abilityIndex:0}};
 const gathered=replayWildzNativeWorldLaw([hunt]),item=Object.values(gathered.nourishment[owner].items)[0]!;
 const consumed=replayWildzNativeWorldLaw([hunt,{kind:'food.consume',actorId:owner,itemId:item.itemId,commandId:`native-eat:${item.itemId}`,kaiUPulse:101,reserveMicroBreaths:createPlayerBreaths(100,20).reserveMicroBreaths}]);
 const local={...createOwnerBoundInitialPlayState(owner),playerNourishment:mergeWildsNativeNourishmentDisplay(undefined,gathered.nourishment[owner])!,playerLivestock:gathered.livestock[owner],playerBreaths:createPlayerBreaths(100,20),energy:20};
 const restored=restorePlayState(serializePlayState(local),owner),source=prepareWildsNativeFoodFuelRecovery(consumed,owner);
 const recovered=mergeWildsNativeFoodFuelDisplay(restored,source,owner,102,wildsNativeFoodIds(consumed));
 assert.equal(recovered.playerBreaths!.restoredMicroBreaths,consumed.foodConsumptionReceipts[item.itemId].fuelMicroBreaths);
 const reopened=restorePlayState(serializePlayState(recovered),owner);
 assert.equal(recoverWildsNativeAdmittedFoodFuel(reopened,source,owner,103),reopened);
});
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
