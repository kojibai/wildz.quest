import type { ReceizPortableSealedArtifactV124 } from '@receiz/sdk';
export {mergeQualifiedWildsResourceWorldV128} from '../../features/play/wilds-resource-application-world-v128';
import type { AdventureCardCondition } from '../../features/play/adventure/card-condition';
import {canonicalPortableCardJson,sha256PortableBasis,type PortableCardAsset} from '../../features/play/portable-card';
import type { WildsCreatureMandateV1 } from '../../features/play/wilds-creature-mandate';
import {WildsWorldService,type WildsWorldCommand} from '../../features/play/wilds-world-service';
import type { WildsResourcePackageMember } from '../../features/play/wilds-resource-package';
import {createWildsSourceAuthorityProjection} from '../../features/play/wilds-source-work-authority';
import {createWildsNourishmentState,gatherWildsNourishment,consumeWildsNourishment,creditWildsAnimalFood,creditWildsImportedPackageFood,wildsNourishmentSourceAt,wildsNourishmentPlantById} from '../../features/play/wilds-nourishment';
import {createWildsLivestockState,huntWildsAnimal,captureWildsLivestock,collectWildsLivestock,wildsAnimalHead} from '../../features/play/wilds-livestock';
import {kaiUPulseToISOString,deriveKaiKlokMomentFromUPulse} from '../../features/play/kai-klok-moment';
import {admitWildsGroveAction,previewWildsGroveAction,type WildsGroveActionKind} from '../../features/play/wilds-regenerative-grove';
import {admitWildsEmissionOutcome} from '../../features/play/wilds-world-emission';
import {createWildsGroveResourceLot} from '../../features/play/wilds-resource-lot';
import {wildsWorldSourceGenesis,wildsWorldSourceEmission} from '../../features/play/wilds-world-genesis';
import {initialWildsHarvestedSourceState} from '../../features/play/wilds-steward-construction';
import type {WildsApplicationResourceCustodyV128} from '../../features/play/wilds-world-state';
import {wildsMaterialCustodian} from '../../features/play/wilds-world-state';
// Only this replay issues custody entries. Persisted JSON cannot retain this
// qualification; explicit use reconstructs it from the SDK-admitted source.
const qualifiedApplicationCustody = new WeakMap<object,Readonly<{memberId:string;head:string}>>();
export function isQualifiedWildsApplicationResourceCustodyV128(value:unknown,memberId:string,head:string):value is WildsApplicationResourceCustodyV128 {
 if(!value||typeof value!=='object')return false;
 const admitted=qualifiedApplicationCustody.get(value);return admitted?.memberId===memberId&&admitted.head===head;
}
type Pose={x:number;y:number;z:number};
type Animal={commandId:string;animalId:string;expectedAnimalHead:string;kaiUPulse:number;player:Pose;spaceId:string};
export type WildsResourceGameplayCommandV128 =
 | Readonly<{kind:'world';command:WildsWorldCommand;kaiUPulse:number;card?:PortableCardAsset;cardOriginal?:ReceizPortableSealedArtifactV124;groveMandate?:WildsCreatureMandateV1;workerOriginals?:Readonly<Record<string,ReceizPortableSealedArtifactV124>>}>
 | Readonly<{kind:'food.gather';commandId:string;sourceId:string;expectedSourceHead:string;kaiUPulse:number;player:Pose;spaceId:string}>
 | Readonly<{kind:'food.consume';commandId:string;itemId:string;kaiUPulse:number;reserveMicroBreaths:number;fuelMicroBreathLimit?:number}>
 | Readonly<Animal & {kind:'animal.hunt';hunter:{kind:'tool'}|{kind:'creature';asset:PortableCardAsset;condition?:AdventureCardCondition;abilityIndex:number};cardOriginal?:ReceizPortableSealedArtifactV124}>
 | Readonly<Animal & {kind:'animal.capture';shelterId:string}>
 | Readonly<{kind:'animal.produce';commandId:string;animalId:string;kaiUPulse:number;player:Pose;spaceId:string}>;
export const WILDS_RESOURCE_GAMEPLAY_MAX_COMMANDS_V128=1024;
export const WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128=8*1024*1024;
const worldTypes=new Set(['grove.observe','grove.act','resource.material.harvest','tool.steward.craft','tool.steward.equip',
 'structure.trail-shelter.build','structure.trail-bridge.build','structure.steward-workbench.build','structure.trail-cache.build',
 'construction.site.place','construction.site.contribute','construction.site.work','construction.project.create',
 'construction.component.place','construction.component.adjust','construction.component.deposit','construction.component.work',
 'construction.component.maintain','construction.weather.advance','storage.material.move','creation.construct','creation.evolve','creation.action']);
export function isWildsResourceGameplayWorldCommandV128(command:Pick<WildsWorldCommand,'type'>){return worldTypes.has(command.type);}
function fail(reason:string):never{throw Error(`wilds_resource_gameplay_${reason}`);}
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
export type WildsResourceGameplayImportV128=Readonly<{packageId:string;receiptId:string;kaiUPulse:number;sourceArtifactSha256:string;members:readonly WildsResourcePackageMember[]}>;
export type WildsResourceGameplaySourceAdvanceV128=Readonly<{sourceId:string;priorHead:string;nextHead:string;commandDigest:string}>;
export function wildsResourceGameplayCommandIdV128(command:WildsResourceGameplayCommandV128){return command.kind==='world'?command.command.commandId:command.commandId;}
export function validateWildsResourceGameplayCommandV128(command:WildsResourceGameplayCommandV128){
 const keys:Record<WildsResourceGameplayCommandV128['kind'],readonly string[]>={world:['kind','command','kaiUPulse','card','cardOriginal','groveMandate','workerOriginals'],
 'food.gather':['kind','commandId','sourceId','expectedSourceHead','kaiUPulse','player','spaceId'],
 'food.consume':['kind','commandId','itemId','kaiUPulse','reserveMicroBreaths','fuelMicroBreathLimit'],
 'animal.hunt':['kind','commandId','animalId','expectedAnimalHead','kaiUPulse','player','spaceId','hunter','cardOriginal'],
 'animal.capture':['kind','commandId','animalId','expectedAnimalHead','kaiUPulse','player','spaceId','shelterId'],
 'animal.produce':['kind','commandId','animalId','kaiUPulse','player','spaceId']};
 if(!command||typeof command!=='object'||!keys[command.kind]||Object.keys(command).some(k=>!keys[command.kind].includes(k))
  ||!Number.isSafeInteger(command.kaiUPulse)||command.kaiUPulse<0||!/^[a-z0-9][a-z0-9:._-]{5,179}$/i.test(wildsResourceGameplayCommandIdV128(command)))fail('command_invalid');
 if(command.kind==='animal.hunt'&&(Object.keys(command.hunter).some(k=>!(command.hunter.kind==='tool'?['kind']:['kind','asset','condition','abilityIndex']).includes(k))
  ||!['tool','creature'].includes(command.hunter.kind)))fail('command_invalid');
 if(command.kind==='world'&&!worldTypes.has(command.command.type))fail('command_unsupported');
}

/** Replay only exact commands from the fixed source genesis. A caller cannot
 * supply inventory, tools, shelters, source checkpoints or a replacement grove.
 * Card evidence is independently admitted by the production SDK port on Send. */
export async function replayWildsResourceGameplayV128(input:Readonly<{gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[];imports?:readonly WildsResourceGameplayImportV128[];excludedFood?:readonly Readonly<{itemId:string;fromKaiUPulse:number}>[];excludedMembers?:readonly Readonly<{memberId:string;packageId:string;fromKaiUPulse:number}>[];verifyCard?:(card:PortableCardAsset,original:ReceizPortableSealedArtifactV124)=>Promise<void>}>) {
 if(!/^[a-z0-9][a-z0-9:._-]{0,511}$/i.test(input.gameplayOwnerId)||!Array.isArray(input.commands)||input.commands.length>WILDS_RESOURCE_GAMEPLAY_MAX_COMMANDS_V128
  ||new TextEncoder().encode(canonicalPortableCardJson(input.commands)).length>WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128)fail('trace_invalid');
 const commands=structuredClone(input.commands),owner=input.gameplayOwnerId;
 let service=WildsWorldService.fromLocalProjection(createWildsSourceAuthorityProjection());
 let nourishment=createWildsNourishmentState(owner),livestock=createWildsLivestockState(owner),lastKai=0;
 const imports=[...(input.imports??[])].sort((a,b)=>a.kaiUPulse-b.kaiUPulse);let importIndex=0;
 const applyImports=(kai:number)=>{
  while(importIndex<imports.length&&imports[importIndex]!.kaiUPulse<=kai){const item=imports[importIndex++]!;
   nourishment=creditWildsImportedPackageFood(nourishment,item.members,{packageId:item.packageId,receiptId:item.receiptId},Math.max(item.kaiUPulse,nourishment.lastKaiUPulse));
   const world=service.snapshot(),materialLots={...world.materialLots},resourceLots={...world.resourceLots},applicationSourceCustody={...world.applicationSourceCustody};
   for(const member of item.members)if(member.kind==='material'||member.kind==='resource'){
    if(member.kind==='material')materialLots[member.id]=member.materialLot;else resourceLots[member.id]=member.resourceLot;
    const custody=Object.freeze({scheme:'wildz.resource-source.v128' as const,ownerReceizId:owner,packageId:item.packageId,unpackAppendId:item.receiptId,sourceArtifactSha256:item.sourceArtifactSha256});
    qualifiedApplicationCustody.set(custody,{memberId:member.id,head:member.kind==='material'?member.materialLot.head:member.resourceLot.head});applicationSourceCustody[member.id]=custody;
   }
   service=WildsWorldService.fromLocalProjection({...world,materialLots,resourceLots,applicationSourceCustody});}

  const unavailable=(input.excludedFood??[]).filter(item=>item.fromKaiUPulse<=kai).map(item=>item.itemId);
  if(unavailable.length)nourishment={...nourishment,unavailableItemIds:[...new Set(unavailable)].sort()};
  const reserved=(input.excludedMembers??[]).filter(item=>item.fromKaiUPulse<=kai);
  if(reserved.length){const world=service.snapshot();service=WildsWorldService.fromLocalProjection({...world,reservedMaterialLots:{...world.reservedMaterialLots,...Object.fromEntries(reserved.filter(item=>world.materialLots[item.memberId]).map(item=>[item.memberId,item.packageId]))},reservedResourceLots:{...world.reservedResourceLots,...Object.fromEntries(reserved.filter(item=>world.resourceLots[item.memberId]).map(item=>[item.memberId,item.packageId]))}});}
 };
 const seen=new Map<string,string>(),advances:WildsResourceGameplaySourceAdvanceV128[]=[],eventsByCommand:Record<string,ReturnType<WildsWorldService['events']>>={};
 const advance=(sourceId:string,priorHead:string,nextHead:string,commandDigest:string)=>advances.push({sourceId,priorHead,nextHead,commandDigest});
 const card=async(asset:PortableCardAsset|undefined,original:ReceizPortableSealedArtifactV124|undefined)=>{
  if(!asset||!original||!input.verifyCard)fail('card_original_required');
  await input.verifyCard!(asset!,original!);
 };
 for(const entry of commands){
  validateWildsResourceGameplayCommandV128(entry);applyImports(entry.kaiUPulse);
  const commandId=wildsResourceGameplayCommandIdV128(entry),commandDigest=sha256PortableBasis(canonicalPortableCardJson({owner,entry}));
  const prior=seen.get(commandId);if(prior){if(prior!==commandDigest)fail('command_conflict');continue;}
  if(entry.kaiUPulse<lastKai)fail('stale-time');seen.set(commandId,commandDigest);lastKai=entry.kaiUPulse;
  if(entry.kind==='world'){
   const command=entry.command,before=service.snapshot();
   if(entry.card)await card(entry.card,entry.cardOriginal);
   if(command.type==='creation.construct'||command.type==='creation.evolve')for(const source of command.workerSources)await card(source.card,entry.workerOriginals?.[source.card.id]);
   if(command.type==='grove.observe'){
    const genesis=wildsWorldSourceGenesis().groves.find(g=>g.groveId===command.grove.groveId);
    if(!genesis||!same(genesis,command.grove)||!same(wildsWorldSourceGenesis().emission,command.emission))fail('grove_genesis_invalid');
   }
   if(command.type==='grove.act'){
    const grove=before.groves[command.grove.groveId];if(!grove)fail('grove_source_missing');
    if(entry.groveMandate){
     await card(entry.card,entry.cardOriginal);
     if(entry.groveMandate.creatureHead!==sha256PortableBasis(entry.card!.proof.digest)
       ||entry.groveMandate.creatureSubjectId!==`creature:${sha256PortableBasis(entry.card!.id).slice(0,32)}`)fail('grove_mandate_invalid');
    }
    if(typeof command.operation.intention.kind!=='string'||!command.operation.intention.kind.startsWith('grove.'))fail('grove_operation_invalid');
    const preview=previewWildsGroveAction({grove,action:command.operation.intention.kind.slice('grove.'.length) as WildsGroveActionKind,
     actor:{id:owner,head:sha256PortableBasis(owner)},...(entry.groveMandate?{mandate:entry.groveMandate}:{}),weather:grove.weather,
     moment:deriveKaiKlokMomentFromUPulse({uPulse:entry.kaiUPulse,authority:'world'}),emission:wildsWorldSourceEmission(before)});
    if(!preview.valid)fail(`grove_${preview.reasons[0]}`);
    const successor=admitWildsGroveAction({grove,preview});
    const emission=admitWildsEmissionOutcome({emission:wildsWorldSourceEmission(before),operation:preview.operation,contributionClass:preview.operation.category==='construction'?'construction':'ecology',preview:preview.emission});
    const resourceLot=createWildsGroveResourceLot({operation:preview.operation,ownerReceizId:owner,
     sourceGrove:{groveId:grove.groveId,head:grove.head,honey:grove.materials.honey},admittedGrove:{groveId:successor.groveId,head:successor.head,parentHead:successor.parentHead,honey:successor.materials.honey}});
    if(!same(command.operation,preview.operation)||!same(command.grove,successor)||!same(command.emission,emission)
      ||command.amountPhiMicro!==preview.emission.amountPhiMicro||!same(command.resourceLot??null,resourceLot))fail('grove_successor_invalid');
    advance(`grove:${grove.groveId}`,grove.head,successor.head,commandDigest);
   }
   const timestamp=kaiUPulseToISOString(entry.kaiUPulse);
   const result=service.execute(command,{actorId:owner,canonical:true,pulse:timestamp,occurredAt:timestamp,uPulse:entry.kaiUPulse,...(entry.card?{card:entry.card}:{})});
   eventsByCommand[commandId]=result.events;
   if(command.type==='resource.material.harvest'){
    const previous=before.harvestedSources[command.source.sourceId]??initialWildsHarvestedSourceState(command.source);
    const next=result.projection.harvestedSources[command.source.sourceId];if(!next)fail('material_successor_missing');
    advance(`material:${command.source.sourceId}`,previous.head,next.head,commandDigest);
   }
  }else if(entry.kind==='food.gather'){
   const gathered=gatherWildsNourishment({...entry,state:nourishment,ownerReceizId:owner});if(!gathered.ok)fail(gathered.reason!);
   nourishment=gathered.state;
   const crop=wildsNourishmentSourceAt(wildsNourishmentPlantById(entry.sourceId)!,gathered.sourceState,entry.kaiUPulse);
   advance(`food:${entry.sourceId}:${gathered.item.cropDay}`,gathered.previousSourceHead,crop.head,commandDigest);
  }else if(entry.kind==='food.consume'){
   const consumed=consumeWildsNourishment({...entry,state:nourishment,ownerReceizId:owner});if(!consumed.ok)fail(consumed.reason!);nourishment=consumed.state;
  }else{
   const world=service.snapshot();
   if(entry.kind==='animal.hunt'&&entry.hunter.kind==='creature')await card(entry.hunter.asset,entry.cardOriginal);
   const result=entry.kind==='animal.hunt'?huntWildsAnimal({...entry,state:livestock,ownerReceizId:owner,hunter:entry.hunter.kind==='tool'?{kind:'tool',world}:entry.hunter}):
    entry.kind==='animal.capture'?captureWildsLivestock({...entry,state:livestock,ownerReceizId:owner,world}):collectWildsLivestock({...entry,state:livestock,ownerReceizId:owner,world});
   if(!result.ok)fail(result.reason!);livestock=result.state;
   advance(`animal:${entry.animalId}`,result.previousAnimalHead,wildsAnimalHead(entry.animalId,result.source),commandDigest);
   if(result.foodReceipt){const credit=creditWildsAnimalFood(nourishment,result.foodReceipt);if(!credit.ok)fail(credit.reason!);nourishment=credit.state;}
  }
 }
 applyImports(Number.MAX_SAFE_INTEGER);
 const world=service.snapshot(),members:Record<string,WildsResourcePackageMember>={};
 for(const foodItem of Object.values(nourishment.items))if(foodItem.consumedKaiUPulse===undefined&&!nourishment.unavailableItemIds?.includes(foodItem.itemId))members[foodItem.itemId]={kind:'food',id:foodItem.itemId,foodItem,nourishment};
 for(const lot of Object.values(world.materialLots))if(wildsMaterialCustodian(world,lot)===owner&&!world.consumedMaterialLots[lot.lotId]&&!world.storedMaterialLots[lot.lotId]&&!world.reservedMaterialLots?.[lot.lotId])members[lot.lotId]={kind:'material',id:lot.lotId,materialLot:lot};
 for(const lot of Object.values(world.resourceLots))if((isQualifiedWildsApplicationResourceCustodyV128(world.applicationSourceCustody?.[lot.lotId],lot.lotId,lot.head)?world.applicationSourceCustody![lot.lotId]!.ownerReceizId:lot.ownerReceizId)===owner&&!world.reservedResourceLots?.[lot.lotId])members[lot.lotId]={kind:'resource',id:lot.lotId,resourceLot:lot};
 return {nourishment,livestock,world,members,advances,eventsByCommand,traceDigest:sha256PortableBasis(canonicalPortableCardJson({owner,commands}))};
}
