import { creationDefinitionFixture } from './creation-fixtures';
import { createCreationInstance } from '../../src/features/play/creation/instance';
import { emptyCreationState, type CreationAuthorityContext, type CreationState } from '../../src/features/play/creation/state';
import {CREATION_STATE_RULE_ID,CREATION_STATE_RULE_HEAD} from '../../src/features/play/creation/actions';
export const creationSourceHead=`sha256:${'a'.repeat(64)}`;
export function creationInstanceFixture(){return createCreationInstance({instanceId:'instance:fixture',definition:creationDefinitionFixture(),ownerId:'owner',worldId:'wildz',spaceId:'surface',pose:{position:{x:0,y:0,z:0},yaw:0},kaiUPulse:1});}
export function creationStateFixture():CreationState{const instance=creationInstanceFixture();return {...emptyCreationState(),definitions:{[instance.definitionDigest]:creationDefinitionFixture()},instances:{[instance.instanceId]:instance},custody:{[instance.instanceId]:'owner'}};}
/** Explicit test-only source verification. Never a production admission port. */
export function creationAuthorityFixture(state:CreationState):CreationAuthorityContext{const sources=[{id:`rule:${CREATION_STATE_RULE_ID}`,head:CREATION_STATE_RULE_HEAD,kind:'rule'},{id:'actor:owner',head:creationSourceHead,kind:'actor'},...Object.values(state.instances).map(i=>({id:i.instanceId,head:i.head,kind:'creation'}))];return {actorId:'owner',sources,verifySource:source=>sources.some(s=>s.id===source.id&&s.head===source.head&&s.kind===source.kind),rules:{[CREATION_STATE_RULE_ID]:CREATION_STATE_RULE_HEAD},mandates:[]};}
