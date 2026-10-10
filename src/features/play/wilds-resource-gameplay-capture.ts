import type {PlayState,WildsInput} from './game-state';
import {projectWildsRestedCompanionCondition} from './game-state';
import {canonicalPortableCardJson,sha256PortableBasis} from './portable-card';
import {advancePlayerBreaths,createPlayerBreaths,isPlayerBreaths} from './player-breath-energy';
import type {WildsResourceGameplayCommandV128} from '@/lib/receiz/wilds-resource-gameplay-v128';

export type WildsResourceCaptureBinding=Readonly<{ownerHandle:string;gameplayOwnerId:string}>;
export type WildsResourceCaptureMarker=Readonly<{command:WildsResourceGameplayCommandV128;binding:WildsResourceCaptureBinding;itemId?:string}>;
export function sameWildsResourceCaptureBinding(left:WildsResourceCaptureBinding,right:WildsResourceCaptureBinding){
  return left.ownerHandle===right.ownerHandle&&left.gameplayOwnerId===right.gameplayOwnerId;
}
/** Updater replay can change a lawful pose while producing the same crop slot.
 * Keep that consequence once; distinct slots in the same Kai still stay distinct. */
export function wildsResourceCaptureMarkerId(candidate:WildsResourceCaptureMarker){
  const command=candidate.command,locator=candidate.itemId??(command.kind==='food.consume'?command.itemId:
    'animalId' in command?command.animalId:command.kind==='world'?command.command.commandId:command.commandId);
  return JSON.stringify([candidate.binding.ownerHandle,candidate.binding.gameplayOwnerId,command.kind,command.kaiUPulse,locator]);
}
export function wildsResourceCaptureCommitted(candidate:WildsResourceCaptureMarker,state:Pick<PlayState,'playerNourishment'|'playerLivestock'>,binding:WildsResourceCaptureBinding){
  if(!sameWildsResourceCaptureBinding(candidate.binding,binding))return false;
  const command=candidate.command,item=candidate.itemId?state.playerNourishment?.items[candidate.itemId]:undefined;
  const animal='animalId' in command?state.playerLivestock?.animals[command.animalId]:undefined;
  const owner=command.kind.startsWith('food.')?state.playerNourishment?.ownerReceizId:state.playerLivestock?.ownerReceizId;
  if(owner!==candidate.binding.gameplayOwnerId)return false;
  return command.kind==='food.gather'||command.kind==='animal.produce'?item?.gatheredKaiUPulse===command.kaiUPulse:
    command.kind==='food.consume'?state.playerNourishment?.items[command.itemId]?.consumedKaiUPulse===command.kaiUPulse:
    command.kind==='animal.hunt'?animal?.status==='hunted'&&animal.settledKaiUPulse===command.kaiUPulse:
    command.kind==='animal.capture'?animal?.capturedKaiUPulse===command.kaiUPulse&&animal.shelterId===command.shelterId:false;
}

/** Retain a small consequence marker, not an entire abandoned React state. */
export function createWildsResourceCaptureMarker(before:PlayState,after:PlayState,input:WildsInput,binding:WildsResourceCaptureBinding):WildsResourceCaptureMarker|null{
  if(!('ownerReceizId' in input)||input.ownerReceizId!==binding.gameplayOwnerId)return null;
  const command=captureWildsResourceGameplayInput(before,after,input);if(!command)return null;
  const owner=command.kind.startsWith('food.')?after.playerNourishment?.ownerReceizId:after.playerLivestock?.ownerReceizId;
  if(owner!==binding.gameplayOwnerId)return null;
  const itemId=command.kind==='food.gather'||command.kind==='animal.produce'?Object.values(after.playerNourishment?.items??{}).find(item=>
    item.gatheredKaiUPulse===command.kaiUPulse&&!before.playerNourishment?.items[item.itemId])?.itemId:undefined;
  return Object.freeze({command,binding:Object.freeze({...binding}),...(itemId?{itemId}:{})});
}

/** Capture the exact admitted local input, never a balance or a save checkpoint. */
export function captureWildsResourceGameplayInput(before:PlayState,after:PlayState,input:WildsInput):WildsResourceGameplayCommandV128|null {
  if(before===after||!Number.isSafeInteger(input.kaiUPulse))return null;
  const kaiUPulse=input.kaiUPulse!,player={x:before.player.x,y:'verticalWorldY' in input?input.verticalWorldY??before.siteSpace.position.y:before.siteSpace.position.y,z:before.player.z};
  const locator=input.type==='gather-food'?{sourceId:input.sourceId,head:input.expectedSourceHead}:input.type==='eat-food'?{itemId:input.itemId}:
    input.type==='hunt-animal'||input.type==='capture-livestock'||input.type==='collect-livestock'?{animalId:input.animalId}:null;
  if(!locator)return null;
  const commandId=`resource-gameplay:${sha256PortableBasis(canonicalPortableCardJson({kind:input.type,kaiUPulse,player,spaceId:before.siteSpace.spaceId,owner:before.playerNourishment?.ownerReceizId??before.playerLivestock?.ownerReceizId,locator})).slice(7)}`;
  if(input.type==='gather-food'&&before.playerNourishment!==after.playerNourishment)return {kind:'food.gather',commandId,sourceId:input.sourceId,expectedSourceHead:input.expectedSourceHead,kaiUPulse,player,spaceId:before.siteSpace.spaceId};
  if(input.type==='eat-food'&&before.playerNourishment!==after.playerNourishment){
    const body=isPlayerBreaths(before.playerBreaths)?before.playerBreaths:createPlayerBreaths(kaiUPulse,before.energy);
    return {kind:'food.consume',commandId,itemId:input.itemId,kaiUPulse,reserveMicroBreaths:advancePlayerBreaths(body,kaiUPulse).reserveMicroBreaths,...(input.fuelMicroBreathLimit===undefined?{}:{fuelMicroBreathLimit:input.fuelMicroBreathLimit})};
  }
  if(before.playerLivestock===after.playerLivestock)return null;
  if(input.type==='hunt-animal'){
    const base={kind:'animal.hunt' as const,commandId,animalId:input.animalId,expectedAnimalHead:input.expectedAnimalHead,kaiUPulse,player,spaceId:before.siteSpace.spaceId};
    if(input.hunter.kind==='tool')return {...base,hunter:{kind:'tool'}};
    const hunter=input.hunter,asset=before.inventory.find(card=>card.id===hunter.assetId);if(!asset)return null;
    return {...base,hunter:{kind:'creature',asset,condition:projectWildsRestedCompanionCondition(before,kaiUPulse,asset.id),abilityIndex:hunter.abilityIndex}};
  }
  if(input.type==='capture-livestock')return {kind:'animal.capture',commandId,animalId:input.animalId,expectedAnimalHead:input.expectedAnimalHead,kaiUPulse,player,spaceId:before.siteSpace.spaceId,shelterId:input.shelterId};
  if(input.type==='collect-livestock')return {kind:'animal.produce',commandId,animalId:input.animalId,kaiUPulse,player,spaceId:before.siteSpace.spaceId};
  return null;
}
