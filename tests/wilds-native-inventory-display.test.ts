import assert from 'node:assert/strict';
import test from 'node:test';
import { creditWildsImportedPackageFood, createWildsNourishmentState, gatherWildsNourishment, mergeWildsImportedNourishment, restoreWildsNourishmentState, wildsNourishmentPlantsForTile, wildsNourishmentSourceAt } from '../src/features/play/wilds-nourishment';
import { createWildsLivestockState, wildsAnimalHead } from '../src/features/play/wilds-livestock';
import { mergeWildsNativeNourishmentDisplay, mergeWildsNativeLivestockDisplay, retainWildsNativeFoodClassification, wildsFoodConsumptionRoute, wildsNativeFoodIds } from '../src/features/play/wilds-native-inventory-display';
import { replayWildzNativeWorldLaw } from '../src/features/play/wildz-native-world-law';
import { applyWildsInput, createOwnerBoundInitialPlayState, initialPlayState, restorePlayState, serializePlayState } from '../src/features/play/game-state';
import { createPlayerBreaths } from '../src/features/play/player-breath-energy';
import { projectWildsWildAnimalPosition, wildsWildAnimalsForTile } from '../src/features/play/wilds-animal-ecology';
function food(sourceId?:string) {
 const plant=wildsNourishmentPlantsForTile(-4,-4).find(p=>p.foodKind==='orchard-fruit'&&p.sourceId!==sourceId)!;
 const state=createWildsNourishmentState('explorer'),kaiUPulse=100;
 const result=gatherWildsNourishment({state,ownerReceizId:'explorer',sourceId:plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,kaiUPulse).head,kaiUPulse,player:plant.position,spaceId:'wildz.space.outer.v1'});
 assert.ok(result.ok);return {plant,state:result.state,item:Object.values(result.state.items)[0]!};
}
test('native replay display retains saved food while source classification admits only actual gathered IDs',()=>{
 const saved=food(),next=food(saved.plant.sourceId);
 const replay=replayWildzNativeWorldLaw([{kind:'food.gather',actorId:'explorer',sourceId:next.plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(next.plant,undefined,100).head,kaiUPulse:100,player:next.plant.position,spaceId:'wildz.space.outer.v1'}]);
 const merged=mergeWildsNativeNourishmentDisplay(saved.state,replay.nourishment.explorer)!;
 assert.deepEqual(new Set(Object.keys(merged.items)),new Set([saved.item.itemId,next.item.itemId]));
 const nativeIds=wildsNativeFoodIds(replay);
 assert.ok(nativeIds.has(next.item.itemId));assert.equal(nativeIds.has(saved.item.itemId),false);
 assert.equal(wildsNourishmentSourceAt(next.plant,replay.foodSources[next.plant.sourceId],100).head,wildsNourishmentSourceAt(next.plant,replay.nourishment.explorer.sources[next.plant.sourceId],100).head,'rendered slot and admitted collection require the identical source head');
});
test('native meal classification survives a saved player reload before any world source arrives',()=>{
 const legacy=food(),native=food(legacy.plant.sourceId);
 const replay=replayWildzNativeWorldLaw([{kind:'food.gather',actorId:'explorer',sourceId:native.plant.sourceId,expectedSourceHead:wildsNourishmentSourceAt(native.plant,undefined,100).head,kaiUPulse:100,player:native.plant.position,spaceId:'wildz.space.outer.v1'}]);
 const nourishment=mergeWildsNativeNourishmentDisplay(legacy.state,replay.nourishment.explorer)!;
 const saved=serializePlayState({...createOwnerBoundInitialPlayState('explorer'),playerNourishment:nourishment,playerBreaths:createPlayerBreaths(100,20),energy:20});
 const restored=restorePlayState(saved,'explorer');
 assert.ok(restored.playerNourishment);
 assert.deepEqual(restored.playerNourishment.nativeItemIds,[native.item.itemId],
  'an admitted native item must remain excluded from local eating with a cold native source cache');
 assert.ok(restored.playerNourishment.items[legacy.item.itemId],'legacy food remains available after the same reload');
 assert.equal(restorePlayState(saved,'another-account').playerNourishment,undefined);
 const cold={owner:'explorer',nourishment:restored.playerNourishment,nativeSource:null,world:null};
 assert.equal(wildsFoodConsumptionRoute({...cold,itemId:native.item.itemId,hasNativeIdentity:true}),'native');
 assert.equal(wildsFoodConsumptionRoute({...cold,itemId:native.item.itemId,hasNativeIdentity:false}),'wait');
 assert.equal(wildsFoodConsumptionRoute({...cold,itemId:legacy.item.itemId,hasNativeIdentity:false}),'local');
 const preflight=applyWildsInput(restored,{type:'eat-food',ownerReceizId:'explorer',itemId:native.item.itemId,kaiUPulse:100});
 assert.notEqual(preflight,restored,'the old cold-cache local fallback would have consumed this native portion');
 assert.equal(restored.playerNourishment.items[native.item.itemId].consumedKaiUPulse,undefined,'native routing leaves the meal intact until admission');
 const eatenLegacy=applyWildsInput(restored,{type:'eat-food',ownerReceizId:'explorer',itemId:legacy.item.itemId,kaiUPulse:100});
 assert.ok(eatenLegacy.playerBreaths!.reserveMicroBreaths>restored.playerBreaths!.reserveMicroBreaths,'genuine legacy meals still consume instantly');
 assert.equal(replay.nourishment.explorer.nativeItemIds,undefined,'the saved marker never becomes native law or issuance evidence');
});
test('owner saves retain native denials without importing missing items or another account markers',()=>{
 const gathered=food(),native=mergeWildsNativeNourishmentDisplay(undefined,gathered.state)!;
 const preferred={...gathered.state,lastKaiUPulse:101};
 const merged=mergeWildsImportedNourishment(preferred,native)!;
 assert.deepEqual(merged.nativeItemIds,[gathered.item.itemId]);
 assert.deepEqual(Object.keys(merged.items),Object.keys(preferred.items));
 const restored=restoreWildsNourishmentState({...merged,nativeItemIds:[gathered.item.itemId,gathered.item.itemId,'foreign-or-missing',null]},'explorer')!;
 assert.deepEqual(restored.nativeItemIds,[gathered.item.itemId]);
 assert.equal(restoreWildsNourishmentState({...merged,nativeItemIds:'corrupt'},'explorer'),undefined,'a malformed marker must not restore food as local');
 assert.equal(retainWildsNativeFoodClassification(gathered.state,'another-account',[gathered.item.itemId]),gathered.state);
 assert.equal(wildsFoodConsumptionRoute({owner:'another-account',itemId:gathered.item.itemId,nourishment:restored,nativeSource:null,world:null,hasNativeIdentity:true}),'local','foreign saved denials never classify this account’s items');
});
test('received native food keeps its denial after reload without rewriting the original gatherer',()=>{
 const source=food(),owner='recipient.receiz.id';
 const credited=creditWildsImportedPackageFood(createWildsNourishmentState(owner),[{kind:'food',id:source.item.itemId,foodItem:source.item,nourishment:source.state}],{packageId:'accepted-package',receiptId:'accepted-receipt'},101);
 const marked=retainWildsNativeFoodClassification(credited,owner,[source.item.itemId])!;
 const restored=restorePlayState(serializePlayState({...createOwnerBoundInitialPlayState(owner),playerNourishment:marked}),owner);
 assert.equal(restored.playerNourishment!.items[source.item.itemId].ownerReceizId,'explorer');
 assert.equal(restored.playerNourishment!.ownerReceizId,owner);
 assert.equal(wildsFoodConsumptionRoute({owner,itemId:source.item.itemId,nourishment:restored.playerNourishment,nativeSource:null,world:null,hasNativeIdentity:false}),'wait');
 const merged=mergeWildsImportedNourishment(createWildsNourishmentState(owner),restored.playerNourishment)!;
 assert.deepEqual(merged.nativeItemIds,[source.item.itemId]);
 assert.equal(wildsFoodConsumptionRoute({owner,itemId:source.item.itemId,nourishment:merged,nativeSource:null,world:null,hasNativeIdentity:true}),'native');
});
test('native animal meals keep the same cold-reload denial as gathered fruit',()=>{
 const animal=Array.from({length:9},(_,i)=>wildsWildAnimalsForTile(i-4,-4)).flat().find(animal=>animal.species==='ground-bird')!;
 assert.ok(animal);
 const card=initialPlayState.inventory[0]!,owner='explorer',kaiUPulse=100;
 const replay=replayWildzNativeWorldLaw([{kind:'animal.hunt',actorId:owner,animalId:animal.animalId,expectedAnimalHead:wildsAnimalHead(animal.animalId),kaiUPulse,player:projectWildsWildAnimalPosition(animal,kaiUPulse).position,spaceId:'wildz.space.outer.v1',hunter:{kind:'creature',asset:card,condition:initialPlayState.adventureConditions[card.id],abilityIndex:0}}]);
 const nourishment=mergeWildsNativeNourishmentDisplay(undefined,replay.nourishment[owner])!;
 const restored=restorePlayState(serializePlayState({...createOwnerBoundInitialPlayState(owner),playerNourishment:nourishment,playerLivestock:replay.livestock[owner]}),owner);
 const ids=Object.keys(replay.nourishment[owner].items).sort();assert.ok(ids.length);
 assert.deepEqual(restored.playerNourishment?.nativeItemIds,ids);
 for(const itemId of ids)assert.equal(wildsFoodConsumptionRoute({owner,itemId,nourishment:restored.playerNourishment,nativeSource:null,world:null,hasNativeIdentity:false}),'wait');
});
test('refresh cannot revive a locally consumed exact portion or move inventory to another account',()=>{
 const original=food(),consumed={...original.state,items:{...original.state.items,[original.item.itemId]:{...original.item,consumedKaiUPulse:100,consumedFuelMicroBreaths:1}}};
 assert.equal(mergeWildsNativeNourishmentDisplay(consumed,original.state)!.items[original.item.itemId].consumedKaiUPulse,100);
 const other=createWildsNourishmentState('other');assert.equal(mergeWildsNativeNourishmentDisplay(consumed,other),other);
});
test('native livestock refresh retains historical local animals and replaces matching IDs with accepted custody',()=>{
 const current={...createWildsLivestockState('explorer'),animals:{old:{schema:'wildz.animal-state.v1' as const,animalId:'old',status:'captured' as const,ownerReceizId:'explorer',settledKaiUPulse:100,capturedKaiUPulse:100,shelterId:'old:shelter',shelterHead:'old:head',lastProductDay:null}}};
 const admitted={...createWildsLivestockState('explorer'),lastKaiUPulse:200,animals:{next:{...current.animals.old,animalId:'next',settledKaiUPulse:200}}};
 assert.deepEqual(Object.keys(mergeWildsNativeLivestockDisplay(current,admitted)!.animals).sort(),['next','old']);
 assert.deepEqual(Object.keys(admitted.animals),['next'],'the native authority input never imports the display merge');
});
