import { constructionProofDigest, freezeConstructionProof } from '../wilds-construction-project';
import { canonicalPortableCardJson } from '../portable-card';
import { CREATION_PAGE_SIZE } from './registry';
import type { CreationDefinition, CreationNode } from './types';
const fail = (): never => { throw new Error('creation_definition_invalid'); };
export function assertCreationData(value: unknown, depth = 0): void {
  if (depth > 24) fail();
  if (typeof value === 'number' && !Number.isFinite(value)) fail();
  if (typeof value === 'string' && value.length > 4096) fail();
  if (value && typeof value === 'object') {
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
    for (const [key, child] of Object.entries(value)) { if (['__proto__','constructor','prototype'].includes(key)) fail(); assertCreationData(child, depth+1); }
  } else if (value !== null && !['number','string','boolean'].includes(typeof value)) fail();
}
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512 && v.trim() === v;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 4096;
const point = (v: {x:number;y:number;z:number}) => !!v && [v.x,v.y,v.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e9);
export function validateCreationBasis(value: Omit<CreationDefinition,'digest'>): void {
  assertCreationData(value);
  if (!value || value.schema !== 'wildz.creation-definition.v1' || value.grammarVersion !== 1 || !id(value.seed) || !id(value.creatorId) || !Array.isArray(value.nodes) || !value.nodes.length || !Array.isArray(value.assets) || value.assets.length > CREATION_PAGE_SIZE) fail();
  if (Object.keys(value).sort().join(',') !== 'assets,creatorId,grammarVersion,nodes,schema,seed') fail();
  const ids = new Set<string>();
  for (const n of value.nodes) {
    if (!id(n.id) || ids.has(n.id) || !n.pose || !point(n.pose.position) || !Number.isFinite(n.pose.yaw) || !id(n.material)) fail(); ids.add(n.id);
    const s=n.shape;
    if (!s || !['box','shell','extrusion','sweep','arch','catalog'].includes(s.kind) || ![s.width,s.height,s.depth].every(positive) || (s.thickness!==undefined && (!positive(s.thickness)||s.thickness>=Math.min(s.width,s.height,s.depth)/2))) fail();
    if (s.doorway && (!positive(s.doorway.width)||!positive(s.doorway.height)||s.doorway.width>=s.width||s.doorway.height>=s.height)) fail();
    if (s.points && (s.points.length>CREATION_PAGE_SIZE || !s.points.every(point))) fail();
    if (s.kind==='catalog' && !id(s.piece)) fail();
    for (const refs of [n.attachments,n.supports]) if (!Array.isArray(refs)||refs.length>CREATION_PAGE_SIZE||new Set(refs).size!==refs.length||!refs.every(id)) fail();
    if (!Array.isArray(n.behaviors)||n.behaviors.length>32||n.behaviors.some(b=>!id(b.id)||b.version!==1||!b.parameters||Object.keys(b.parameters).length>32||Object.values(b.parameters).some(v=>!['number','string','boolean'].includes(typeof v)))) fail();
  }
  const byId=new Map(value.nodes.map(n=>[n.id,n]));
  for (const n of value.nodes) if ((n.parentId!==null&&!ids.has(n.parentId))||[...n.attachments,...n.supports].some(ref=>!ids.has(ref))) fail();
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(n:CreationNode):void=>{if(visiting.has(n.id))fail();if(visited.has(n.id))return;visiting.add(n.id);for(const ref of [...(n.parentId?[n.parentId]:[]),...n.attachments,...n.supports])visit(byId.get(ref)!);visiting.delete(n.id);visited.add(n.id);};
  for (const n of value.nodes) visit(n);
  const assetIds=new Set<string>();
  for (const a of value.assets) { if (!/^sha256:[a-f0-9]{64}$/.test(a.digest)||assetIds.has(a.digest)||!['mesh','texture'].includes(a.kind)||![a.bytes,a.vertices,a.triangles].every(n=>Number.isSafeInteger(n)&&n>=0)||a.bytes>16777216||a.vertices>65536||a.triangles>65536||!/^https:\/\//.test(a.uri)) fail(); assetIds.add(a.digest); }
}
export function createCreationDefinition(value: Omit<CreationDefinition,'digest'>): CreationDefinition {
  validateCreationBasis(value);
  const copy=JSON.parse(canonicalPortableCardJson(value)) as Omit<CreationDefinition,'digest'>;
  return freezeConstructionProof({...copy,digest:constructionProofDigest(copy)});
}
export function parseCreationDefinition(value: unknown): CreationDefinition {
  assertCreationData(value); const d=value as CreationDefinition;
  if (!d || typeof d.digest!=='string') fail();
  const {digest,...basis}=d; const parsed=createCreationDefinition(basis);
  if (parsed.digest!==digest) fail(); return parsed;
}
export function verifyCreationDefinition(value: unknown): value is CreationDefinition {try {parseCreationDefinition(value);return true;} catch {return false;}}
