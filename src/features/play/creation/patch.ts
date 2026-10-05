import { assertCreationData, createCreationDefinition, parseCreationDefinition } from './definition';
import type { CreationDefinition, CreationPatch } from './types';
export function applyCreationPatch(definition: CreationDefinition, patch: CreationPatch): CreationDefinition {
  const source=parseCreationDefinition(definition); assertCreationData(patch);
  if (patch.baseDigest!==source.digest) throw new Error('creation_patch_stale');
  if (!Array.isArray(patch.operations)||patch.operations.length>128) throw new Error('creation_patch_invalid');
  let nodes=[...source.nodes];
  for (const operation of patch.operations) {
    if (operation.op==='add') {nodes.push(operation.node);continue;}
    const index=nodes.findIndex(n=>n.id===operation.id); if(index<0)throw new Error('creation_patch_missing_node');
    if(operation.op==='remove') nodes=nodes.filter((_,i)=>i!==index);
    else if(operation.op==='update') {if('id' in operation.changes)throw new Error('creation_patch_id_immutable');nodes[index]={...nodes[index],...operation.changes};}
    else throw new Error('creation_patch_invalid');
  }
  const {digest: _digest,...basis}=source;
  return createCreationDefinition({...basis,nodes});
}
