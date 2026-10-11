import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as food from '../src/features/play/wilds-nourishment';
import {KAI_N_DAY_MICRO} from '../src/features/play/kai-klok-moment';
import {createWildsResourcePackage,verifyWildsResourcePackageMember} from '../src/features/play/wilds-resource-package';
import {wildsFoodConsumptionRoute} from '../src/features/play/wilds-native-inventory-display';

// Application semantics only: these source coordinates are not native admission.
const plant=food.wildsNourishmentPlantById('wildz.nourishment.v1:-4:-4:berry-bush:1')!;
const frozen=100_000_000,pickup=Number(KAI_N_DAY_MICRO*10n);
function candidate(){
 const fn=(food as unknown as {createWildsClearanceFoodItem?: (input:Record<string,unknown>)=>food.WildsFoodItem}).createWildsClearanceFoodItem;
 assert.equal(typeof fn,'function','frozen crop pickup must have explicit finite source evidence');
 return fn!({ownerReceizId:'explorer',clearanceId:`wildz:clearance:${'a'.repeat(64)}`,pileId:`wildz:clearance-pile:${'b'.repeat(64)}`,
  sourceId:plant.sourceId,sourceHead:food.wildsNourishmentSourceAt(plant,undefined,frozen).head,cropDay:0,slot:1,
  clearanceKaiUPulse:frozen,kaiUPulse:pickup,pickupHead:`sha256:${'c'.repeat(64)}`});
}
test('frozen clearance food stays restorable and consumable after its original crop calendar advances',()=>{
 const item=candidate(),state={...food.createWildsNourishmentState('explorer'),lastKaiUPulse:pickup,items:{[item.itemId]:item}};
 const restored=food.restoreWildsNourishmentState(JSON.parse(JSON.stringify(state)),'explorer');
 assert.deepEqual(restored,state);assert.equal(item.cropDay,0);assert.equal(item.gatheredKaiUPulse,pickup);
 assert.equal(food.consumeWildsNourishment({state:restored!,ownerReceizId:'explorer',itemId:item.itemId,kaiUPulse:pickup,reserveMicroBreaths:0}).ok,true);
 assert.deepEqual(restored!.sources,{},'a basket never starts a new standing crop');
});
test('a restored clearance receipt denies local consumption even when saved native classification was omitted',()=>{
 const item=candidate(),state={...food.createWildsNourishmentState('explorer'),lastKaiUPulse:pickup,items:{[item.itemId]:item}};
 const restored=food.restoreWildsNourishmentState(state,'explorer')!;
 assert.equal(wildsFoodConsumptionRoute({owner:'explorer',itemId:item.itemId,nourishment:restored,nativeSource:null,world:null,hasNativeIdentity:false}),'wait');
});
test('compact frozen food survives ordinary package import, consumption and finite member selection',()=>{
 const item=candidate(),nourishment={...food.createWildsNourishmentState('explorer'),lastKaiUPulse:pickup,items:{[item.itemId]:item}};
 const member={kind:'food' as const,id:item.itemId,foodItem:item,nourishment};
 assert.equal(verifyWildsResourcePackageMember(member),true);
 const packed=createWildsResourcePackage({ownerReceizId:'alice.receiz.id',createdKaiUPulse:pickup,commandId:'package:clearance',members:[member]});
 const imported=food.creditWildsImportedPackageFood(food.createWildsNourishmentState('bob'),packed.members,{packageId:packed.packageId,receiptId:'source:accepted'},pickup);
 const consumed=food.consumeWildsNourishment({state:imported,ownerReceizId:'bob',itemId:item.itemId,kaiUPulse:pickup,reserveMicroBreaths:0});
 assert.equal(consumed.ok,true);if(!consumed.ok)throw Error('consumption_failed');
 assert.equal(food.availableWildsFood(consumed.state).length,0);
 assert.equal(JSON.stringify(member).length<2500,true,'one frozen member carries only its own exact source/item capsule');
});
test('changed frozen crop day, portion or original source cannot restore a valid item',()=>{
 const item=candidate();
 for(const change of [{cropDay:10},{slot:9},{sourceId:'invented'}]){
  const altered={...item,...change};
  const state={...food.createWildsNourishmentState('explorer'),lastKaiUPulse:pickup,items:{[item.itemId]:altered}};
  assert.deepEqual(food.restoreWildsNourishmentState(state,'explorer')?.items,{});
 }
});
