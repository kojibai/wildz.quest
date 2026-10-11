import {createWildsWalletResourceUsePortV128} from '../src/features/play/wallet/wilds-wallet-resource-use-v128';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {wildsResourceUseSpentMemberIdsV128} from '../src/lib/receiz/wilds-resource-journal-v128';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {paidClearanceTrace} from './support/clearance-source-fixture';
import {initialWildsResourceJournalV128,reduceWildsResourceJournalV128,replayWildsResourceJournalOwnerV128} from '../src/lib/receiz/wilds-resource-journal-v128';
import {deriveWildsClearanceCommandV128,planWildsClearancePickupV128} from '../src/lib/receiz/wilds-clearance-admission-v128';
import {projectWildsBuildingClearancePiles} from '../src/features/play/wilds-building-clearance';
import {applyWildsInput,createOwnerBoundInitialPlayState} from '../src/features/play/game-state';
import {createPlayerBreaths} from '../src/features/play/player-breath-energy';
import {captureWildsResourceGameplayInput} from '../src/features/play/wilds-resource-gameplay-capture';
import {recoverWildsWalletSourceFoodV128} from '../src/features/play/wallet/wilds-wallet-resource-use-projection-v128';
import {wildsFoodConsumptionRoute} from '../src/features/play/wilds-native-inventory-display';
import {sha256PortableBasis} from '../src/features/play/portable-card';
const source=readFileSync('src/features/play/PlayCampaign.tsx','utf8');
const callback=ts.transpileModule(source.slice(source.indexOf('  const eatFood = (item:'),source.indexOf('  const openNourishmentSatchel =')), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const fixture=(async()=>{
 const f=await paidClearanceTrace(),owner='alice.receiz.id',head='1'.repeat(64),event={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'food:paid',ownerReceizId:owner,gameplayOwnerId:'explorer',commands:f.commands} as const;
 let state=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),event,{ownerReceizId:owner,verifyCard:async()=>{}});
 const derive=await deriveWildsClearanceCommandV128({state,ownerReceizId:owner,gameplayOwnerId:'explorer',commands:f.commands,buildingId:f.buildingId,buildingHead:f.buildingHead,expectedHead:head,kaiUPulse:f.kaiUPulse,commandId:'food:derive'});
 state=await reduceWildsResourceJournalV128(state,{...event,attemptId:'food:derive',commands:[...f.commands,{kind:'world',command:derive,kaiUPulse:f.kaiUPulse}]},{ownerReceizId:owner,expectedNativeHead:head});
 const pile=projectWildsBuildingClearancePiles([derive.payload.clearance],{}).find(row=>row.kind==='food')!;assert.ok(pile);
 const proposal=planWildsClearancePickupV128({source:{state,predecessor:{head:{head}}},clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:head,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:f.kaiUPulse+1,commandId:'food:pickup'});
 state=await reduceWildsResourceJournalV128(state,{schema:'wildz.resource-command.v128',kind:'use',attemptId:'food:pickup',ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}],useCommandId:'food:pickup'},{ownerReceizId:'bob.receiz.id',expectedNativeHead:head});
 return {state,replay:await replayWildsResourceJournalOwnerV128(state,'bob.receiz.id','bob',state.traces['bob.receiz.id'].commands),kai:f.kaiUPulse+2};
})();
for(const mode of ['accepted','offline','changed-incarnation','reserved','lost-reply','full-body-recovery'] as const)test(`actual Campaign pickup→Eat uses native admission before fuel: ${mode}`,async()=>{
 const f=await fixture,item=Object.values(f.replay.nourishment.items)[0];let local={...createOwnerBoundInitialPlayState('bob'),playerNourishment:f.replay.nourishment,playerBreaths:createPlayerBreaths(f.kai,20),energy:20};
 let localDispatch=0,uses=0,pulse=f.kai,canonical=f.state,accepted:unknown=null;const identity={current:{keyId:'key',ownerHandle:'bob.receiz.id',incarnation:'first'}},inFlight={current:false},errors:string[]=[];
 const deps={state:local,canForage:()=>true,foodSaveInFlight:inFlight,foodUnavailableForExchange:()=>false,livingWorld:{currentSource:()=>f.replay.world,refresh:async()=>{}},ownerReceizId:'bob',walletSourceLocksRef:{current:new Set()},readActionKaiUPulse:()=>pulse,rootWildsInputInKai:(value:unknown)=>value,applyWildsInput,beginWorldActionFeedback:()=>{},walletSourceUse:null as unknown as ReturnType<typeof createWildsWalletResourceUsePortV128>,walletSourceStore:{reopen:async()=>{},listCached:async()=>[]},showWorldFeedback:(value:string)=>errors.push(value),captureWildsResourceGameplayInput,setFoodSavePending:()=>{},walletTradeIdentityRef:identity,sha256PortableBasis,markWalletObservationPending:async()=>{},recoverWildsWalletSourceFoodV128,walletSourceLive:{current:{state:local}},setState:(fn:(s:typeof local)=>typeof local)=>{local=fn(local);},currentWalletSourceRows:[],setWalletSourceRows:()=>{},walletIdentityKey:'bob',walletObservationEpoch:'first',dispatch:(input:Parameters<typeof applyWildsInput>[1])=>{localDispatch++;local=applyWildsInput(local,input) as typeof local;},resourceExchange:{consume:async()=>{throw Error('wrong legacy route');}},wildsFoodConsumptionRoute};
 if(mode==='reserved')canonical=await reduceWildsResourceJournalV128(canonical,{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'food:racing:reserve',ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:canonical.traces['bob.receiz.id'].commands,createdKaiUPulse:f.kai,memberIds:[item.itemId],recipientHandle:'alice'},{ownerReceizId:'bob.receiz.id'});
 const database=createMemoryWildzContinuityDatabase();
 const use=async(request:{attemptId:string;command:import('../src/lib/receiz/wilds-resource-gameplay-v128').WildsResourceGameplayCommandV128})=>{
  uses++;if(mode==='offline')throw Error('offline');if(accepted)return accepted;
  const command=request.command,event={schema:'wildz.resource-command.v128',kind:'use',attemptId:request.attemptId,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',commands:[...canonical.traces['bob.receiz.id'].commands,command],useCommandId:command.kind==='world'?command.command.commandId:command.commandId} as const;
  canonical=await reduceWildsResourceJournalV128(canonical,event,{ownerReceizId:'bob.receiz.id'});
  const replay=await replayWildsResourceJournalOwnerV128(canonical,'bob.receiz.id','bob',canonical.traces['bob.receiz.id'].commands);
  accepted={...replay,projection:replay.world,command,state:canonical,usedMemberIds:wildsResourceUseSpentMemberIdsV128(canonical,event)};
  if(mode==='changed-incarnation')identity.current={...identity.current,incarnation:'second'};
  if(mode==='lost-reply'||mode==='full-body-recovery')throw Error('accepted_reply_lost');return accepted;
 };
 Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_key:string,action:()=>unknown)=>action()}});
 const mount=()=>createWildsWalletResourceUsePortV128({keyId:'key',ownerHandle:'bob.receiz.id',currentIdentity:()=>identity.current,openRuntime:async()=>({keyId:'key',ownerReceizId:'bob.receiz.id',database,exchange:{use}} as never)});
 deps.walletSourceUse=mount();
 const eat=new Function(...Object.keys(deps),callback+'return eatFood;')(...Object.values(deps));eat(item);
 for(let i=0;i<30&&inFlight.current;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(localDispatch,0);assert.equal(uses,1);assert.equal(inFlight.current,false);
 assert.equal(local.playerNourishment.items[item.itemId].consumedKaiUPulse!==undefined,mode==='accepted');
 if(mode==='lost-reply'||mode==='full-body-recovery'){assert.ok(accepted);if(mode==='full-body-recovery'){const prior=local.playerBreaths.restoredMicroBreaths;local={...local,playerBreaths:createPlayerBreaths(pulse,100)};deps.state=local;const full=new Function(...Object.keys(deps),callback+'return eatFood;')(...Object.values(deps));full(item);for(let i=0;i<30&&inFlight.current;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(local.playerNourishment.items[item.itemId].consumedKaiUPulse,undefined);assert.equal(uses,1);local={...local,playerBreaths:{...createPlayerBreaths(pulse,20),restoredMicroBreaths:prior}};deps.state=local;}deps.walletSourceUse=mount();pulse++;const retry=new Function(...Object.keys(deps),callback+'return eatFood;')(...Object.values(deps));retry(item);for(let i=0;i<30&&inFlight.current;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(local.playerNourishment.items[item.itemId].consumedKaiUPulse!==undefined,true,errors.join(';'));assert.equal(uses,2);}
 if(mode==='accepted'){const once=local.playerBreaths.restoredMicroBreaths;eat(item);for(let i=0;i<30&&inFlight.current;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(local.playerBreaths.restoredMicroBreaths,once);}
});
