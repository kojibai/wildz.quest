import type { CreationNodeState } from './instance';
import {constructionProofDigest} from '../wilds-construction-project';
export type CreationActionDescriptor=Readonly<{id:string;version:1;participantKinds:readonly string[];costs:Readonly<{work:number;resources:Readonly<Record<string,number>>}>;effects:readonly string[];verify:(node:CreationNodeState|null)=>boolean}>;
const entries=[
 {id:'create',version:1 as const,participantKinds:['actor','space','creation'],costs:{work:0,resources:{}},effects:['planned-instance'],verify:()=>true},
 {id:'advance',version:1 as const,participantKinds:['actor','creation','work'],costs:{work:0,resources:{}},effects:['stage-lineage'],verify:()=>true},
 {id:'use',version:1 as const,participantKinds:['actor','creation'],costs:{work:0,resources:{}},effects:['causal-use'],verify:(node:CreationNodeState|null)=>!!node&&node.condition>0&&['bed','habitat','storage','joint','actuator','sensor','logic'].includes(node.kind)},
];
export const CREATION_ACTIONS:Readonly<Record<string,CreationActionDescriptor>>=Object.freeze(Object.fromEntries(entries.map(action=>[action.id,Object.freeze(action)])));
export const CREATION_STATE_RULE_ID='creation.state.v1';
export const CREATION_STATE_RULE_HEAD=constructionProofDigest({id:CREATION_STATE_RULE_ID,version:1,actions:entries.map(({verify,...basis})=>basis)});
