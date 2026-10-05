import { createCreationDefinition } from '../../src/features/play/creation/definition';
import type { CreationDefinition } from '../../src/features/play/creation/types';
export function creationDefinitionFixture(overrides: Partial<CreationDefinition> = {}): CreationDefinition {
 const {digest: _digest,...basis}={schema:'wildz.creation-definition.v1' as const,grammarVersion:1 as const,seed:'fixture',creatorId:'owner',nodes:[{id:'room',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'shell' as const,width:4,height:3,depth:5,thickness:.15,doorway:{width:1.2,height:2.2}},material:'timber',attachments:[],supports:[],behaviors:[]}],assets:[],...overrides}; return createCreationDefinition(basis);
}
