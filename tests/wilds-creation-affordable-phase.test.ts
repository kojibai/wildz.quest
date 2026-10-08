import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareAffordableCreation} from '../src/features/play/creation/affordable-phase';
import {compileCreation} from '../src/features/play/creation/compiler';
import {createCreationDefinition} from '../src/features/play/creation/definition';
import {restoreCreationDraft} from '../src/features/play/creation/draft';
import {creationGoalKey,encodeCreationGoal,reopenCreationGoal} from '../src/features/play/creation/saved-goal';
import {creationDefinitionFixture,creationContextFixture} from './support/creation-fixtures';
import {proposeLocalCreation} from '../src/lib/receiz/wilds-local-creation-planner';

function goal(){const base=creationDefinitionFixture(),{digest,...basis}=base;void digest;return createCreationDefinition({...basis,nodes:[3,6,9].map((x,i)=>({...base.nodes[0],id:`chest-${i+1}`,pose:{position:{x,y:0,z:0},yaw:0},shape:{kind:'box' as const,width:1,height:1,depth:1},behaviors:[{id:'storage',version:1,parameters:{}}]}))});}

test('a phase is a bounded paid subset with unchanged identity, geometry and final context',()=>{
 const target=goal(),context=creationContextFixture({budget:{timber:2}}),phase=prepareAffordableCreation(target,context,'automatic');
 assert.equal(phase.status,'ready');if(phase.status!=='ready')throw Error('phase');
 assert.equal(phase.definition.nodes.length,2);assert.deepEqual(phase.plan.requiredResources,{timber:2});assert.deepEqual(phase.budget,{timber:2});
 assert.equal(phase.definition.creatorId,'owner');assert.equal(phase.definition.seed,'fixture');
 for(const part of phase.definition.nodes)assert.deepEqual(part,target.nodes.find(node=>node.id===part.id));
 const fresh=compileCreation(phase.definition,{...context,budget:phase.budget});assert.equal(fresh.status,'ready');if(fresh.status==='ready')assert.deepEqual(phase.plan,fresh.plan);
 assert.equal(target.nodes.length,3);
});

test('zero funding reports a complete useful section and does not fabricate partial equipment',()=>{
 const context=creationContextFixture({budget:{timber:0}}),phase=prepareAffordableCreation(goal(),context,'manual');
 assert.equal(phase.status,'blocked');if(phase.status==='blocked')assert.deepEqual(phase.quote?.requiredResources,{timber:1});
 const proposal=proposeLocalCreation({requestId:'sword',actorId:'owner',message:'Build a timber sword',selected:null,workers:[],context:{...context,budget:{timber:10},techniques:['assembly','forging']}},new AbortController().signal);
 if(!('definition'in proposal))throw Error('sword');
 const noTool=prepareAffordableCreation(proposal.definition,context,'manual');assert.equal(noTool.status,'blocked');
});

test('phase eligibility retains supports and denies material, physical and creature substitutions',()=>{
 const target=goal();
 assert.equal(prepareAffordableCreation(target,creationContextFixture({budget:{timber:2},techniques:[]}), 'manual').status,'blocked');
 const physical=[{chunkId:'obstacle',head:`sha256:${'a'.repeat(64)}`,terrain:[],walkable:[],portals:[],solids:[{id:'occupied',center:{x:6,y:.5,z:0},halfExtents:{x:10,y:10,z:10},yaw:0}]}];
 assert.equal(prepareAffordableCreation(target,creationContextFixture({budget:{timber:2},physical}), 'manual').status,'blocked');
 const base=target.nodes[0],supported=createCreationDefinition({schema:target.schema,grammarVersion:1,creatorId:target.creatorId,seed:target.seed,assets:[],nodes:[{...base,id:'foundation',behaviors:[]},{...base,id:'chest',pose:{position:{x:3,y:1,z:0},yaw:0},supports:['foundation']}]});
 const short=prepareAffordableCreation(supported,creationContextFixture({budget:{timber:1}}),'manual');assert.equal(short.status,'blocked');
 const complete=prepareAffordableCreation(supported,creationContextFixture({budget:{timber:2}}),'manual');assert.equal(complete.status,'ready');if(complete.status==='ready')assert.deepEqual(complete.definition.nodes.map(n=>n.id),['foundation','chest']);
});

test('later phases retain every built node and pay only new parts',()=>{
 const target=goal(),first=prepareAffordableCreation(target,creationContextFixture({budget:{timber:1}}),'manual');if(first.status!=='ready')throw Error('phase');
 const context=creationContextFixture({budget:{timber:1},evolution:{instanceId:'built',head:`sha256:${'b'.repeat(64)}`,definition:first.definition}}),second=prepareAffordableCreation(target,context,'manual');
 assert.equal(second.status,'ready');if(second.status!=='ready')throw Error('phase');
 assert.equal(second.definition.nodes.length,2);assert.deepEqual(second.plan.requiredResources,{timber:1});assert.equal(second.plan.nodeWork.find(n=>n.nodeId==='chest-1')?.work,0);
 const {digest,...basis}=target;void digest;const modified=createCreationDefinition({...basis,nodes:target.nodes.map(n=>n.id==='chest-1'?{...n,shape:{...n.shape,width:2}}:n)});
 assert.equal(prepareAffordableCreation(modified,context,'manual').status,'blocked');
});

test('saved goal hints reject account, space, reference and built-geometry mismatches',async()=>{
 const target=goal(),part=prepareAffordableCreation(target,creationContextFixture({budget:{timber:1}}),'manual');if(part.status!=='ready')throw Error('phase');
 const scope={ownerId:'owner',spaceId:'surface'},ref={kind:'instance' as const,id:'built'},raw=encodeCreationGoal(scope,ref,target);
 assert.equal(reopenCreationGoal(raw,scope,ref,part.definition)?.digest,target.digest);
 assert.equal(reopenCreationGoal(raw,{...scope,ownerId:'foreign'},ref,part.definition),null);
 assert.equal(reopenCreationGoal(raw,{...scope,spaceId:'other'},ref,part.definition),null);
 assert.equal(reopenCreationGoal(raw,scope,{...ref,id:'other'},part.definition),null);
 assert.notEqual(creationGoalKey(scope,ref),creationGoalKey({...scope,ownerId:'foreign'},ref));
 const {digest,...basis}=part.definition;void digest;const changed=createCreationDefinition({...basis,nodes:part.definition.nodes.map(n=>({...n,shape:{...n.shape,width:2}}))});
 assert.equal(reopenCreationGoal(raw,scope,ref,changed),null);
 const draft=JSON.stringify({...scope,definition:changed,targetDefinition:target,budget:{timber:1}});
 assert.equal((await restoreCreationDraft(draft,scope)).status,'recovery');
});
