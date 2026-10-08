import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compileCreation} from '../src/features/play/creation/compiler';
import {compileCreationPreview,editCreationBudget} from '../src/features/play/creation/preview-budget';
import {initialCreationConversation,reduceCreationConversation} from '../src/features/play/creation/conversation';
import {creationContextFixture,creationDefinitionFixture} from './support/creation-fixtures';
const definition=creationDefinitionFixture(),context=creationContextFixture();

test('resource-only refusals expose exact full cost but other invalid designs cannot gain a quote',()=>{
 const ready=compileCreation(definition,context);assert.equal(ready.status,'ready');if(ready.status!=='ready')throw Error('fixture');
 const short=compileCreation(definition,{...context,budget:{timber:0}});assert.equal(short.status,'blocked');if(short.status!=='blocked')throw Error('fixture');
 assert.deepEqual(short.quote,{definitionDigest:definition.digest,requiredResources:ready.plan.requiredResources,requiredWork:ready.plan.requiredWork});
 const unqualified=compileCreation(definition,{...context,budget:{timber:0},techniques:[]});assert.equal(unqualified.status,'blocked');if(unqualified.status==='blocked')assert.equal(unqualified.quote,undefined);
 const occupied=compileCreation(definition,{...context,budget:{timber:0},physical:[{chunkId:'occupied',head:context.sourceHead,terrain:[],walkable:[],portals:[],solids:[{id:'wall',yaw:0,center:{x:0,y:1,z:0},halfExtents:{x:100,y:100,z:100}}]}]});
 assert.equal(occupied.status,'blocked');if(occupied.status==='blocked')assert.equal(occupied.quote,undefined);
});

test('automatic allocations bind exact cost to the compiled context and manual limits never rise',async()=>{
 const compile=async(d:typeof definition,c:typeof context)=>compileCreation(d,c);
 const automatic=await compileCreationPreview({definition,context:{...context,budget:{timber:0}},owned:{timber:10000},mode:'automatic',current:()=>true,compile});
 assert.equal(automatic?.result.status,'ready');if(!automatic||automatic.result.status!=='ready')throw Error('fixture');
 assert.deepEqual(automatic.budget,automatic.result.plan.requiredResources);
 assert.deepEqual(automatic.result,compileCreation(definition,{...context,budget:automatic.budget}));
 const manual=await compileCreationPreview({definition,context:{...context,budget:{timber:1}},owned:{timber:10000},mode:'manual',current:()=>true,compile});
 assert.equal(manual?.result.status,'blocked');assert.deepEqual(manual?.budget,{timber:1});
 const short=await compileCreationPreview({definition,context,owned:{timber:2},mode:'automatic',current:()=>true,compile});
 assert.equal(short?.result.status,'blocked');assert.deepEqual(short?.budget,{timber:2});
 assert.equal(definition.nodes.length,1);
});

test('stale quotes cannot update allocation or trigger the second compile',async()=>{
 let current=true,calls=0;
 const result=await compileCreationPreview({definition,context,owned:{timber:10000},mode:'automatic',current:()=>current,compile:async(d,c)=>{calls++;current=false;return compileCreation(d,c);}});
 assert.equal(result,null);assert.equal(calls,1);
 let state=initialCreationConversation('owner','surface',context.pose);
 state=reduceCreationConversation(state,{type:'selection',definition});state=reduceCreationConversation(state,{type:'compile-request',requestId:'old'});
 state=reduceCreationConversation(state,{type:'budget',budget:{timber:1}});
 const unchanged=reduceCreationConversation(state,{type:'quote',requestId:'old',quote:{definitionDigest:definition.digest,requiredResources:{timber:30},requiredWork:10},budget:{timber:30}});
 assert.equal(unchanged,state);assert.equal(state.budgetMode,'manual');
});

test('budget editing permits blank, removes leading zeros and bounds integers to ownership',()=>{
 assert.deepEqual(editCreationBudget('',50),{text:'',amount:0});
 assert.deepEqual(editCreationBudget('00012',50),{text:'12',amount:12});
 assert.deepEqual(editCreationBudget('99',50),{text:'50',amount:50});
 for(const invalid of ['-1','1.5','1e3','Infinity','NaN','9007199254740992'])assert.equal(editCreationBudget(invalid,50),null);
});

test('saved automatic allocation stays automatic while legacy and explicit ceilings stay manual',async()=>{
 const {restoreCreationDraft}=await import('../src/features/play/creation/draft');
 const raw={ownerId:'owner',spaceId:'surface',draft:'a full house',budget:{timber:5}};
 for(const [mode,expected] of [[undefined,'manual'],['manual','manual'],['automatic','automatic']] as const){
  const restored=await restoreCreationDraft(JSON.stringify({...raw,...(mode?{budgetMode:mode}:{})}),{ownerId:'owner',spaceId:'surface'});
  assert.equal(restored.status,'ready');if(restored.status==='ready')assert.equal(restored.budgetMode,expected);
 }
 let state=initialCreationConversation('owner','surface',context.pose);
 state=reduceCreationConversation(state,{type:'selection',definition});
 state=reduceCreationConversation(state,{type:'budget',budget:{timber:5}});
 state=reduceCreationConversation(state,{type:'compile-request',requestId:'manual'});
 state=reduceCreationConversation(state,{type:'quote',requestId:'manual',quote:{definitionDigest:definition.digest,requiredResources:{timber:100},requiredWork:10},budget:{timber:100}});
 assert.equal(state.budget.timber,5);assert.equal(state.quote?.requiredResources.timber,100);
});

test('a scarce automatic mansion budget quotes every requested room without shrinking the goal',async()=>{
 const {proposeLocalCreation}=await import('../src/lib/receiz/wilds-local-creation-planner');
 const proposal=proposeLocalCreation({requestId:'ten-room-quote',actorId:'owner',message:'Build a timber mansion with multiple floors and 10 rooms',selected:null,workers:[{assetId:'worker',subjectId:'creature',head:context.sourceHead,proofDigest:context.sourceHead,techniques:['assembly'],ready:true,reasons:[]}],context},new AbortController().signal);
 if(!('definition'in proposal))throw Error('Expected full mansion');
 const preview=await compileCreationPreview({definition:proposal.definition,context,owned:{timber:12},mode:'automatic',current:()=>true,compile:async(d,c)=>compileCreation(d,c)});
 assert.equal(preview?.result.status,'blocked');assert.deepEqual(preview?.budget,{timber:12});
 assert.equal(proposal.definition.nodes.filter(n=>n.behaviors.some(b=>b.id==='habitat')).length,10);
 const full=compileCreation(proposal.definition,context);assert.equal(full.status,'ready');
 if(preview?.result.status==='blocked'&&full.status==='ready')assert.deepEqual(preview.result.quote?.requiredResources,full.plan.requiredResources);
});

test('inventory or selection change during final allocated compile discards its plan',async()=>{
 let current=true,calls=0;
 const preview=await compileCreationPreview({definition,context,owned:context.budget,mode:'automatic',current:()=>current,compile:async(d,c)=>{if(++calls===2)current=false;return compileCreation(d,c);}});
 assert.equal(calls,2);assert.equal(preview,null);
});
