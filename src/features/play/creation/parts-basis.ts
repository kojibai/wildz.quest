import {constructionProofDigest} from '../wilds-construction-project';
import type {CreationDefinition} from './types';

/** The goal is an advisory draft. It can only expand unchanged existing parts. */
export function creationContainsParts(target:CreationDefinition,part:CreationDefinition):boolean {
 return target.creatorId===part.creatorId&&target.seed===part.seed&&constructionProofDigest(target.assets)===constructionProofDigest(part.assets)&&part.nodes.every(node=>constructionProofDigest(node)===constructionProofDigest(target.nodes.find(next=>next.id===node.id)||null));
}
