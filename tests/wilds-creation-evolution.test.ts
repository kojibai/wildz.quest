import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creationOperationContextFixture} from './support/creation-operation-fixtures';
import {creationDefinitionFixture} from './support/creation-fixtures';
import {compileCreation,type CreationCompileContext} from '../src/features/play/creation/compiler';
import {prepareCreationOperation} from '../src/features/play/creation/operation';
import {initializeCreationComponents} from '../src/features/play/creation/components';
import {sealCreationInstance} from '../src/features/play/creation/instance';
import {createCreationDefinition} from '../src/features/play/creation/definition';
import {prepareCreationEvolution,CREATION_EVOLUTION_RULE_ID,CREATION_EVOLUTION_RULE_HEAD,type CreationEvolutionCommand,type CreationEvolutionContext} from '../src/features/play/creation/evolution';
import {constructionProofDigest} from '../src/features/play/wilds-construction-project';
import type {CreationState} from '../src/features/play/creation/state';
function fixture(){
 const c=creationOperationContextFixture(),base=c.definition.nodes[0];
 const original=creationDefinitionFixture({nodes:[base,{...base,id:'chest',pose:{position:{x:0,y:0,z:1},yaw:0},shape:{kind:'box',width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]},{...base,id:'bed',pose:{position:{x:1,y:0,z:1},yaw:0},shape:{kind:'box',width:1,height:.3,depth:2},behaviors:[{id:'bed',version:1,parameters:{}}]},{...base,id:'garden',pose:{position:{x:9,y:0,z:0},yaw:0},shape:{kind:'box',width:2,height:.1,depth:2},behaviors:[{id:'garden',version:1,parameters:{}}]}]});
 const initialized=initializeCreationComponents(original,1),chest=initialized.chest,bed=initialized.bed,garden=initialized.garden;if(chest.kind!=='storage'||bed.kind!=='bed'||garden.kind!=='garden')throw Error('fixture');
 const current=sealCreationInstance({schema:'wildz.creation-instance.v1',instanceId:'instance:existing',definitionDigest:original.digest,creatorId:'original-maker',ownerId:'owner',stewardId:'owner',worldId:c.compileContext.worldId,spaceId:c.compileContext.spaceId,pose:c.compileContext.pose,revision:1,parentHead:c.compileContext.sourceHead,kaiUPulse:1,nodeStates:{...initialized,room:{...initialized.room,condition:43},chest:{...chest,lotIds:['contents:1']},bed:{...bed,occupantIds:['resident:1']},garden:{...garden,fertility:85,planted:2,waterUnits:1,produce:1}},embeddedResources:[{id:'embedded:original',head:c.compileContext.sourceHead,kind:'timber',quantity:16}],access:{visit:{mode:'public',subjects:[]},inhabit:{mode:'owner',subjects:[]},use:{mode:'owner',subjects:[]},harvest:{mode:'owner',subjects:[]},edit:{mode:'owner',subjects:[]},demolish:{mode:'owner',subjects:[]}},stage:'functional'});
 const {digest,...basis}=original,definition=createCreationDefinition({...basis,creatorId:'original-maker'}),{head,...instanceBasis}=current;
 const instance=sealCreationInstance({...instanceBasis,definitionDigest:definition.digest});
 const next=createCreationDefinition({...basis,creatorId:'original-maker',nodes:[...definition.nodes,{...base,id:'bench',pose:{position:{x:5,y:0,z:0},yaw:0},shape:{kind:'box',width:1,height:.2,depth:1}}]});
 const state:CreationState={...c.state,definitions:{[definition.digest]:definition},instances:{[instance.instanceId]:instance},custody:{...Object.fromEntries(c.lots.map(l=>[l.lotId,'owner'])),[instance.instanceId]:'owner'}};
 const compileContext={...c.compileContext,budget:{timber:1},evolution:{instanceId:instance.instanceId,head:instance.head,definition}};
 const compiled=compileCreation(next,compileContext);if(compiled.status!=='ready')throw Error('fixture evolution compilation: '+JSON.stringify(compiled));
 const lot=c.lots[0],worker=c.workers[0],mandate=c.mandates[0];
 const sources=[...c.authority.sources.filter(s=>!s.id.startsWith('rule:')),{id:instance.instanceId,head:instance.head,kind:'creation'},{id:'rule:'+CREATION_EVOLUTION_RULE_ID,head:CREATION_EVOLUTION_RULE_HEAD,kind:'rule'}];
 const command:CreationEvolutionCommand={operationId:'evolve:1',actorId:'owner',instanceId:instance.instanceId,kaiUPulse:2,action:'evolve',definition:next,planDigest:compiled.plan.digest,expectedHeads:{[instance.instanceId]:instance.head,'actor:owner':c.authority.sources.find(s=>s.id==='actor:owner')!.head,['space:'+instance.spaceId]:compileContext.sourceHead,['rule:'+CREATION_EVOLUTION_RULE_ID]:CREATION_EVOLUTION_RULE_HEAD,[lot.lotId]:lot.head,[worker.subjectId]:worker.head,[mandate.id]:mandate.head}};
 const context:CreationEvolutionContext={authority:{...c.authority,sources,rules:{[CREATION_EVOLUTION_RULE_ID]:CREATION_EVOLUTION_RULE_HEAD},verifySource:s=>sources.some(a=>a.id===s.id&&a.head===s.head&&a.kind===s.kind)},compileContext,workers:c.workers,mandates:c.mandates,lots:c.lots,availability:c.availability,workCeiling:100};
 return {c,state,instance,definition,next,compiled,command,context,lot};
}
test('evolution quotes only rebuilt or added nodes and cannot fund a new copy',()=>{
 const c=creationOperationContextFixture(),definition=c.definition,next=creationDefinitionFixture({nodes:[...definition.nodes,{...definition.nodes[0],id:'bench',shape:{kind:'box',width:1,height:.2,depth:1}}]}),evolution={instanceId:'existing',head:c.compileContext.sourceHead,definition};
 const context={...c.compileContext,budget:{timber:1},evolution},compiled=compileCreation(next,context);assert.equal(compiled.status,'ready');if(compiled.status!=='ready')return;
 assert.deepEqual(compiled.plan.requiredResources,{timber:1});assert.equal(compiled.plan.nodeWork.find(n=>n.nodeId==='room')?.work,0);assert.ok(compiled.plan.requiredWork>0);
 assert.throws(()=>prepareCreationOperation(compiled.plan,{...c,definition:next,compileContext:context}),/evolution|context/);
 const unchanged=compileCreation(definition,context);assert.equal(unchanged.status,'blocked');
});
test('evolution retains identity authorship damage contents occupancy and embedded history',()=>{
 const f=fixture(),before=JSON.stringify(f.state),result=prepareCreationEvolution(f.state,f.command,f.context);assert.equal(result.status,'proposed');if(result.status!=='proposed')return;
 const next=result.state.instances[f.instance.instanceId];assert.equal(next.instanceId,f.instance.instanceId);assert.equal(next.creatorId,'original-maker');assert.equal(next.ownerId,'owner');assert.equal(next.parentHead,f.instance.head);assert.equal(next.revision,f.instance.revision+1);assert.equal(next.definitionDigest,f.next.digest);
 for(const id of ['room','chest','bed','garden'])assert.deepEqual(next.nodeStates[id],f.instance.nodeStates[id]);
 assert.deepEqual(next.embeddedResources,[...f.instance.embeddedResources,{id:f.lot.lotId,head:f.lot.head,kind:f.lot.kind,quantity:1}]);assert.deepEqual(result.state.definitions[f.definition.digest],f.definition);assert.deepEqual(result.state.definitions[f.next.digest],f.next);
 assert.equal(result.state.resources[f.lot.lotId].spent,true);assert.equal(result.state.resources[f.lot.lotId].quantity,1);assert.equal(result.successorSources.length,2);assert.equal(JSON.stringify(f.state),before);
});
test('evolution rejects changed heads missing authority foreign or reserved inputs with zero writes',()=>{
 const f=fixture();for(const [state,command,context] of [
  [f.state,{...f.command,expectedHeads:{...f.command.expectedHeads,[f.instance.instanceId]:f.context.compileContext.sourceHead}},f.context],
  [f.state,f.command,{...f.context,authority:{...f.context.authority,verifySource:()=>false}}],
  [{...f.state,resources:{...f.state.resources,[f.lot.lotId]:{...f.state.resources[f.lot.lotId],ownerId:'foreign'}}},f.command,f.context],
  [{...f.state,reservations:{[f.lot.lotId]:'other'}},f.command,f.context],
  [f.state,f.command,{...f.context,workCeiling:0}],
  [f.state,f.command,{...f.context,mandates:f.context.mandates.map(m=>({...m,revoked:true}))}],
 ] as const){const result=prepareCreationEvolution(state,command,context);assert.equal(result.status,'rejected');if(result.status==='rejected'){assert.equal(result.writes,0);assert.equal(result.state,state);}}
});
test('evolution does not reset contents or rebuild occupied existing geometry',()=>{
 const f=fixture();for(const id of ['chest','bed']){const {digest,...basis}=f.next,definition=createCreationDefinition({...basis,nodes:f.next.nodes.map(n=>n.id===id?{...n,pose:{position:{...n.pose.position,x:n.pose.position.x+2},yaw:0}}:n)}),compiled=compileCreation(definition,{...f.context.compileContext,budget:{timber:100}});assert.equal(compiled.status,'ready');if(compiled.status!=='ready')continue;const result=prepareCreationEvolution(f.state,{...f.command,definition,planDigest:compiled.plan.digest},{...f.context,compileContext:{...f.context.compileContext,budget:{timber:100}}});assert.equal(result.status,'rejected');if(result.status==='rejected')assert.equal(result.state,f.state);}
});
test('evolution replays only exact authenticated commands and rejects altered retry bytes',()=>{
 const f=fixture(),first=prepareCreationEvolution(f.state,f.command,f.context);assert.equal(first.status,'proposed');if(first.status!=='proposed')return;
 const next=first.state.instances[f.instance.instanceId],sources=f.context.authority.sources.map(s=>s.id===next.instanceId?{...s,head:next.head}:s),authority={...f.context.authority,sources,verifySource:(s:{id:string;head:string;kind:string})=>sources.some(a=>a.id===s.id&&a.head===s.head&&a.kind===s.kind)};
 const replay=prepareCreationEvolution(first.state,f.command,{...f.context,authority});assert.equal(replay.status,'proposed');if(replay.status==='proposed'){assert.equal(replay.state,first.state);assert.equal(replay.successorSources.length,0);}
 assert.equal(prepareCreationEvolution(first.state,{...f.command,kaiUPulse:3},{...f.context,authority}).status,'rejected');assert.equal(prepareCreationEvolution(first.state,f.command,{...f.context,authority:{...authority,verifySource:()=>false}}).status,'rejected');
});
test('evolution rejects removals creator changes assets and location changes before admission',()=>{
 const f=fixture();for(const change of [{creatorId:'owner'},{seed:'new-copy'},{nodes:f.next.nodes.filter(n=>n.id!=='bed')}]){const {digest,...basis}=f.next,definition=createCreationDefinition({...basis,...change});const result=prepareCreationEvolution(f.state,{...f.command,definition},f.context);assert.equal(result.status,'rejected');if(result.status==='rejected')assert.equal(result.state,f.state);}
 const moved={...f.context.compileContext,pose:{position:{x:12,y:0,z:0},yaw:0}},compiled=compileCreation(f.next,moved);if(compiled.status==='ready')assert.equal(prepareCreationEvolution(f.state,{...f.command,planDigest:compiled.plan.digest},{...f.context,compileContext:moved}).status,'rejected');
});
