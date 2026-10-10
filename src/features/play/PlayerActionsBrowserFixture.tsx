"use client";
import {useEffect,useRef,useState,useSyncExternalStore,type MutableRefObject} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import type {Group} from 'three';
import {WildsExplorer} from './WildsExplorer';
import {WildsPlayerActionPad,type WildsPlayerHand,type WildsPlayerHandIntent} from './WildsPlayerActionPad';
import {createWildsHandActionState,beginWildsHandAction,readWildsEquipmentHand,rememberWildsEquipmentHand,type WildsHandActionState} from './wilds-player-actions';
import {createWildsVerticalTraversalState,requestWildsJump,writeWildsVerticalTraversalStep,type WildsVerticalTraversalState} from './wilds-vertical-traversal';
import {WildsWorldService} from './wilds-world-service';
import {initialWildsWorldProjection,replayWildsWorld,checkpointWildsWorld} from './wilds-world-state';
import {createCreationDefinition} from './creation/definition';
import {compileCreation} from './creation/compiler';
import {creationWorldSourceHead,creationWorldAvailability} from './creation/world-source';
import {selectCreationResources} from './creation/resources';
import {projectCreationWorkers,combineCreationTechniques} from './creation/capabilities';
import {createWorldCreationController} from './creation/world-controller';
import {projectCreationPhysical} from './creation/projection';
import {prepareCreationHandAction} from './creation/hand-action';
import {currentCreationEquipment} from './creation/equipment';
import WildsCreations from './creation/WildsCreations';
import {wildsQualityProfileForTier} from './wilds-quality-profile';
import {projectWildsResourceRegion} from './wilds-resource-authority';
import {createWildsMaterialHarvest,initialWildsHarvestedSourceState} from './wilds-steward-construction';
import {sealCollectedCard} from './portable-card';
import {creatureFamilies} from './creature-catalog';
import {emptyAdventureCondition} from './adventure/card-condition';
import type {WildsHeldCreationEquipment} from './WildsHeldCreationEquipment';
import {observeWildsKaiUPulse} from './wilds-kai-runtime';

const owner='fixture:player-hands',saveKey='wildz:test-fixture:player-hands:v1',position={x:5000,y:100,z:5000},spaceId='wildz.space.outer.v1',pulse='2026-10-09T12:00:00.000Z',profile=wildsQualityProfileForTier('low',false);
function fixture(){
 const saved=sessionStorage.getItem(saveKey);
 const sources=Array.from({length:25},(_,i)=>projectWildsResourceRegion(i-12,0)).flat().filter(source=>source.kind==='timber').slice(0,2);
 const lots=sources.map(source=>createWildsMaterialHarvest({source,current:initialWildsHarvestedSourceState(source),ownerReceizId:owner,actorPosition:source.position,kaiUPulse:1}).lot);
 const world=saved?replayWildsWorld([],JSON.parse(saved)):{...initialWildsWorldProjection(),materialLots:Object.fromEntries(lots.map(lot=>[lot.lotId,lot]))};
 const service=WildsWorldService.fromLocalProjection(world);
 const card=sealCollectedCard({capturedAt:pulse,encounterId:'fixture:hands:worker',formId:creatureFamilies.find(f=>f.element==='Ember')!.formIds[0],ownerReceizId:owner}),condition=emptyAdventureCondition(card.id);
 if(!saved)for(const [index,id]of ['weapon','target'].entries()){
  const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:id,creatorId:owner,assets:[],nodes:[{id:'part',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:id==='weapon'?{kind:'box',width:.1,height:.08,depth:1}:{kind:'box',width:.7,height:1,depth:.7},material:'timber',attachments:[],supports:[],behaviors:id==='weapon'?[{id:'weapon',version:1,parameters:{}}]:[]}]});
  const current=service.snapshot(),context={worldId:current.worldId,spaceId,pose:{position:{x:position.x-(id==='weapon'?.5:0),y:100+(id==='weapon'?.1:.5),z:position.z-(id==='weapon'?.6:2)},yaw:0},sourceHead:creationWorldSourceHead(current),budget:{timber:2},techniques:combineCreationTechniques(projectCreationWorkers([card],{[card.id]:condition})),physical:[],quality:'low' as const};
  const result=compileCreation(definition,context);if(result.status!=='ready')throw Error('fixture compile failed');
  const resources=selectCreationResources(Object.values(current.materialLots),context.budget,result.plan.requiredResources,creationWorldAvailability(current,owner));
  service.execute({type:'creation.construct',commandId:`fixture:construct:${id}`,instanceId:id,definition,context,planDigest:result.plan.digest,workerSources:[{card,condition}],resources:resources.lots,actorPosition:position},{actorId:owner,canonical:true,pulse,occurredAt:pulse,uPulse:index+10});
 }
 const controller=createWorldCreationController({environment:()=>({ownerId:owner,worldId:service.snapshot().worldId,spaceId}),world:()=>service.snapshot(),crew:()=>({cards:[],conditions:{}}),position:()=>position,compileContext:()=>null,admit:async()=>{throw Error('fixture builds disabled');},project:async(instance,definition,plan)=>projectCreationPhysical(instance,definition,plan)});
 return {service,controller};
}
function JumpingActor({vertical,hands,equipment}:{vertical:MutableRefObject<WildsVerticalTraversalState>;hands:MutableRefObject<WildsHandActionState>;equipment?:WildsHeldCreationEquipment}){
 const group=useRef<Group>(null);
 useFrame((_,delta)=>{writeWildsVerticalTraversalStep(vertical.current,{layer:'ground',terrainElevation:100,deltaSeconds:delta,intent:0,stamina:100});if(group.current)group.current.position.y=vertical.current.offset;});
 return <group ref={group}><WildsExplorer identityKey={owner} style="female" worldPosition={position} verticalTraversalRef={vertical} handActionsRef={hands} heldCreationEquipment={equipment}/></group>;
}
function Controls({data}:{data:ReturnType<typeof fixture>}){
 const physical=useSyncExternalStore(data.controller.subscribe,data.controller.snapshot,data.controller.snapshot),vertical=useRef(createWildsVerticalTraversalState()),hands=useRef(createWildsHandActionState()),[status,setStatus]=useState('Hold a hand toward the nearby weapon, then tap the same hand to strike.'),[hand,setHand]=useState<WildsPlayerHand>(()=>readWildsEquipmentHand(owner));
 const held=Object.values(physical.instances).find(instance=>currentCreationEquipment(instance,owner)),node=held&&currentCreationEquipment(held,owner),definition=held&&physical.definitions[held.definitionDigest],equipment=held&&node&&definition?{instance:held,definition,nodeId:node.nodeId,hand}:undefined;
 const action=async(side:WildsPlayerHand,intent:WildsPlayerHandIntent)=>{
  if(!beginWildsHandAction(hands.current,side,intent,performance.now()))return;hands.current[side]!.heading=0;
  if(intent==='strike'&&equipment?.hand!==side){setStatus(`${side} punch · no admitted weapon damage`);return;}
  const kaiUPulse=Math.max(observeWildsKaiUPulse(),(data.service.snapshot().cursor?.uPulse??0)+1),command=prepareCreationHandAction({world:data.service.snapshot(),actorId:owner,position,spaceId,heading:0,kaiUPulse,operationId:`fixture:hand:${crypto.randomUUID()}`,intent});
  if(!command){setStatus(`${side} ${intent} · no qualified target`);return;}
  try{data.service.execute(command,{actorId:owner,canonical:true,pulse,occurredAt:pulse,uPulse:kaiUPulse});sessionStorage.setItem(saveKey,JSON.stringify(checkpointWildsWorld(data.service.snapshot())));await data.controller.restore();if(intent==='grab'){setHand(side);rememberWildsEquipmentHand(owner,side);}setStatus(`${side} ${intent} admitted · target condition ${data.service.snapshot().creations!.target.instance.nodeStates.part.condition}`);}catch(error){setStatus(error instanceof Error?error.message:'Action rejected');}
 };
 return <><Canvas camera={{position:[3.5,2.7,4.5],fov:45}}><ambientLight intensity={1.7}/><directionalLight position={[3,7,5]}/><gridHelper args={[12,12,'#607b6c','#24392c']}/><WildsCreations source={physical} worldId={data.service.snapshot().worldId} spaceId={spaceId} position={position} profile={profile} onNavigation={()=>{}}/><JumpingActor vertical={vertical} hands={hands} equipment={equipment}/></Canvas>
  <aside style={{position:'absolute',top:12,left:16,right:16,zIndex:5}}><p>SIMULATION ONLY · synthetic owned equipment and target · actual action law, source replay and geometry · no account or network sends</p><output role="status" data-testid="player-actions-state">{status}</output><p>Weapon held: {equipment?hand:'none'} · Target: {physical.instances.target?.nodeStates.part.condition??100}</p><button onClick={()=>location.reload()}>Reload saved actions</button>{' '}<button onClick={()=>{sessionStorage.removeItem(saveKey);location.reload();}}>Reset fixture</button></aside>
  <div style={{position:'absolute',bottom:20,right:20,zIndex:5}}><WildsPlayerActionPad enabled cancelSignal={0} onJump={()=>{if(vertical.current.layer==='ground')vertical.current.worldY=100;const result=requestWildsJump(vertical.current,100);setStatus(result.ok?'Jump started':result.reason);}} onHandAction={(side,intent)=>{void action(side,intent);}}/></div></>;
}
export default function PlayerActionsBrowserFixture(){
 const [data,setData]=useState<ReturnType<typeof fixture>|null>(null),[error,setError]=useState('');
 useEffect(()=>{let current:ReturnType<typeof fixture>|null=null;try{current=fixture();setData(current);void current.controller.restore();}catch(error){setError(error instanceof Error?error.message:'Fixture failed');}return()=>current?.controller.close();},[]);
 return <main style={{position:'fixed',inset:0,background:'#101c18',color:'#edf2e5'}}>{error?<p role="alert">{error}</p>:data?<Controls data={data}/>:<p>Preparing synthetic actions…</p>}</main>;
}
