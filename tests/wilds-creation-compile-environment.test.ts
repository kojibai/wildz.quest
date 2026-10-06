import assert from 'node:assert/strict';
import {test} from 'node:test';
import {compileCreation} from '../src/features/play/creation/compiler';
import {projectCreationCompilePhysical,creationCompileEnvironmentHead} from '../src/features/play/creation/compile-environment';
import {projectCreationPhysical} from '../src/features/play/creation/projection';
import {createCreationInstance,sealCreationInstance} from '../src/features/play/creation/instance';
import {creationContextFixture,creationDefinitionFixture} from './support/creation-fixtures';
import {creationCompileContextForConversation} from '../src/features/play/creation/draft';
import {initialCreationConversation,reduceCreationConversation} from '../src/features/play/creation/conversation';
const HEAD='sha256:'+'b'.repeat(64);
function fixture(){
 const definition=creationDefinitionFixture(),context=creationContextFixture(),compiled=compileCreation(definition,context);
 if(compiled.status!=='ready')throw Error('fixture');
 const initial=createCreationInstance({instanceId:'existing',definition,ownerId:'owner',worldId:context.worldId,spaceId:context.spaceId,pose:context.pose,kaiUPulse:1}),{head,...basis}=initial;void head;
 const instance=sealCreationInstance({...basis,stage:'functional'});
 return {definition,context,instance,projection:projectCreationPhysical(instance,definition,compiled.plan)};
}
test('live creation chunks block intersecting placement before Build is available',()=>{
 const f=fixture(),physical=projectCreationCompilePhysical({...f.context,projections:[f.projection],obstacles:[]});
 const result=compileCreation(f.definition,{...f.context,physical});
 assert.equal(result.status,'blocked');if(result.status==='blocked')assert.ok(result.blockers.some(b=>b.code==='overlap'));
 assert.equal(compileCreation(f.definition,{...f.context,physical,pose:{position:{x:20,y:0,z:0},yaw:0}}).status,'ready');
 assert.equal(compileCreation(f.definition,{...f.context,physical:projectCreationCompilePhysical({...f.context,spaceId:'cave',projections:[f.projection],obstacles:[]})}).status,'ready');
 assert.equal(projectCreationCompilePhysical({...f.context,worldId:'other',projections:[f.projection],obstacles:[]}).length,0);
});
test('living box and cylinder obstacles preserve their physical vertical bounds and space',()=>{
 const f=fixture(),outer={...f.context,spaceId:'wildz.space.outer.v1'},obstacles=[{id:'box',kind:'structure' as const,material:'solid' as const,position:{x:0,y:1,z:0},radius:1,shape:{kind:'box' as const,halfX:1,halfY:1,halfZ:1},visualScale:1},{id:'tree',kind:'tree' as const,material:'solid' as const,position:{x:10,y:4,z:0},radius:2,shape:{kind:'cylinder' as const,radius:2,height:6},visualScale:1}];
 const physical=projectCreationCompilePhysical({...outer,projections:[],obstacles});
 assert.equal(compileCreation(f.definition,{...outer,physical}).status,'blocked');
 const solids=physical.flatMap(c=>c.solids),cylinder=solids.find(s=>s.id==='tree')!;
 assert.deepEqual(cylinder.center,{x:10,y:7,z:0});assert.deepEqual(cylinder.halfExtents,{x:2,y:3,z:2});
 assert.equal(projectCreationCompilePhysical({...f.context,projections:[],obstacles}).length,0);
});
test('preview environment fences change on physical heads removal and world rollover, not placement',()=>{
 const f=fixture(),physical=projectCreationCompilePhysical({...f.context,projections:[f.projection],obstacles:[]}),context={...f.context,physical},head=creationCompileEnvironmentHead(context);
 assert.notEqual(creationCompileEnvironmentHead({...context,physical:projectCreationCompilePhysical({...f.context,projections:[{...f.projection,head:HEAD}],obstacles:[]})}),head);
 assert.notEqual(creationCompileEnvironmentHead({...context,physical:[]}),head);
 assert.notEqual(creationCompileEnvironmentHead({...context,sourceHead:HEAD}),head);
 const moved={...context,pose:{position:{x:20,y:0,z:0},yaw:1}};assert.equal(creationCompileEnvironmentHead(moved),head);
});
test('evolution ignores only the exact selected physical head and still blocks its neighbours',()=>{
 const f=fixture(),ref={instanceId:f.instance.instanceId,head:f.instance.head,definitionDigest:f.definition.digest},state=reduceCreationConversation(initialCreationConversation('owner',f.context.spaceId,f.context.pose),{type:'selection',definition:f.definition,instance:ref,pose:f.instance.pose});
 const physical=projectCreationCompilePhysical({...f.context,projections:[f.projection,{...f.projection,instanceId:'neighbour'},{...f.projection,head:HEAD}],obstacles:[]});
 const context=creationCompileContextForConversation(state,{...f.context,physical});
 assert.equal(context.physical.length,2);assert.ok(context.physical.some(c=>c.instanceId==='neighbour'));assert.ok(context.physical.some(c=>c.head===HEAD));
});
