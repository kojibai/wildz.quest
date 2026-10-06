import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialCreationConversation,reduceCreationConversation } from '../src/features/play/creation/conversation';
import { creationDefinitionFixture,creationContextFixture } from './support/creation-fixtures';
const initial=()=>initialCreationConversation('owner','surface',creationContextFixture().pose);
test('ignores a proposal after the owner changes',()=>{const pending=reduceCreationConversation(initial(),{type:'request',requestId:'a'});const next=reduceCreationConversation(reduceCreationConversation(pending,{type:'environment',ownerId:'newOwner',spaceId:'surface'}),{type:'proposal',requestId:'a',definition:creationDefinitionFixture(),reply:'Ready'});assert.equal(next.ownerId,'newOwner');assert.equal(next.plan,null);assert.equal(next.definition,null);});
test('selection budget and placement invalidate pending proposals',()=>{for(const event of [{type:'workers' as const,ids:['other']},{type:'budget' as const,budget:{timber:1}},{type:'placement' as const,pose:{position:{x:10,y:0,z:0},yaw:1}}]){const pending=reduceCreationConversation(initial(),{type:'request',requestId:'a'});const next=reduceCreationConversation(reduceCreationConversation(pending,event),{type:'proposal',requestId:'a',definition:creationDefinitionFixture(),reply:'Ready'});assert.equal(next.definition,null);assert.equal(next.requestId,null);}});
test('keeps explicit selected graph and draft across close and minimization',()=>{let s=reduceCreationConversation(initial(),{type:'open'});s=reduceCreationConversation(s,{type:'draft',text:'Add a door to it'});s=reduceCreationConversation(s,{type:'request',requestId:'a'});s=reduceCreationConversation(s,{type:'proposal',requestId:'a',definition:creationDefinitionFixture(),reply:'A room.'});const closed=reduceCreationConversation(s,{type:'close'});assert.equal(closed.definition?.digest,s.definition?.digest);assert.equal(closed.draft,'Add a door to it');assert.equal(reduceCreationConversation(s,{type:'minimize'}).minimized,true);});
test('unknown commit keeps an operation identity and cannot become built from dialogue',()=>{const recovering=reduceCreationConversation(initial(),{type:'unknown',operationId:'pending'});assert.equal(recovering.status,'recovering');assert.equal(recovering.instance,null);assert.equal(reduceCreationConversation(recovering,{type:'request',requestId:'retry'}),recovering);});

test('unknown result after commit preserves identity through environment invalidation',()=>{const state={...initial(),status:'committing' as const};const recovering=reduceCreationConversation(state,{type:'unknown',operationId:'actual-operation'});assert.equal(recovering.status,'recovering');assert.equal(recovering.operationId,'actual-operation');assert.equal(reduceCreationConversation(recovering,{type:'invalidate'}),recovering);});

test('a transferred object can be selected and refined without changing its original creator',()=>{
 const definition=creationDefinitionFixture(),instance={instanceId:'creation:transferred',head:'sha256:'+'c'.repeat(64),definitionDigest:definition.digest};
 let state=initialCreationConversation('recipient','surface',creationContextFixture().pose);
 state=reduceCreationConversation(state,{type:'selection',definition,instance});
 assert.equal(state.instance?.instanceId,instance.instanceId);assert.equal(state.definition?.creatorId,'owner');
 state=reduceCreationConversation(state,{type:'request',requestId:'edit-owned'});
 state=reduceCreationConversation(state,{type:'proposal',requestId:'edit-owned',definition,reply:'Keeping its creator and changing the doorway.'});
 assert.equal(state.definition?.digest,definition.digest);assert.equal(state.instance?.head,instance.head);
});
test('foreign drafts and mismatched object references cannot become a selected owned object',()=>{
 const state=initialCreationConversation('recipient','surface',creationContextFixture().pose),definition=creationDefinitionFixture();
 assert.equal(reduceCreationConversation(state,{type:'selection',definition}),state);
 assert.equal(reduceCreationConversation(state,{type:'selection',definition,instance:{instanceId:'copy',head:'sha256:'+'c'.repeat(64),definitionDigest:'sha256:'+'f'.repeat(64)}}),state);
});
