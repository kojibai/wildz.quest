import {
  signReceizIdentityLoginProof, verifyReceizIdentityPublicKeyProjectionSignature,
  receizBase64UrlEncode, type ReceizKeyFile, type ReceizIdentityLoginProof
} from '@receiz/sdk';
import {canonicalPortableCardJson,portableCardBaseProofAsset,sha256PortableBasis,verifyAnyWildsCard,type PortableCardAsset} from '../../features/play/portable-card';
import {parseWildzPlayerCoordinate,sameWildzPlayerCoordinate} from './wildz-player-coordinate';
import type {WildzIdentitySession} from './wildz-identity-repository';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import type {WildzOwnershipSyncProjection} from './wildz-ownership-reconcile';

export const WILDZ_UPLOAD_OWNERSHIP_SCHEMA='wildz.identity-upload-claim.v1';
export type WildzUploadOwnershipClaim=Readonly<{
 schema:typeof WILDZ_UPLOAD_OWNERSHIP_SCHEMA;assetId:string;cardProofDigest:string;cardRootDigest:string;cardRoot:PortableCardAsset;
 sourceArtifactSha256:string;ownerReceizId:string;previousOwnerReceizId:string;keyId:string;
 attemptId:string;kaiUPulse:string;uploadedAt:string;
 authority:'local-upload-display-and-sync-only';
}>;
export type WildzSignedUploadOwnershipClaim=Readonly<{
 schema:'wildz.signed-identity-upload-claim.v1';claim:WildzUploadOwnershipClaim;
 proof:ReceizIdentityLoginProof & {publicKeyRawB64u:string};
}>;
const verifiedProjections=new WeakMap<object,WildzOwnershipSyncProjection>();
const digest=(value:unknown)=>sha256PortableBasis(canonicalPortableCardJson(value));
const headKey=(id:string)=>JSON.stringify([WILDZ_UPLOAD_OWNERSHIP_SCHEMA,'head',id]);
const attemptKey=(keyId:string,id:string,attemptId:string)=>JSON.stringify([WILDZ_UPLOAD_OWNERSHIP_SCHEMA,keyId,id,attemptId]);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const closed=(value:Record<string,unknown>,keys:string)=>Object.keys(value).sort().join(',')===keys.split(',').sort().join(',');
const SHA=/^[a-f0-9]{64}$/;
const PROOF=/^sha256:[a-f0-9]{64}$/;
const exactKai=/^(?:0|[1-9][0-9]{0,39})$/;

/** The immutable birth/base proof is the root; growth and republishing never create a claim. */
export function wildzUploadCardRootDigest(card:PortableCardAsset){return portableCardBaseProofAsset(card).proof.digest;}
function parseSignedUploadClaim(value:unknown):WildzSignedUploadOwnershipClaim|null{
 if(record(value)&&verifiedProjections.has(value))return value as unknown as WildzSignedUploadOwnershipClaim;
 if(!record(value)||!closed(value,'schema,claim,proof')||value.schema!=='wildz.signed-identity-upload-claim.v1'||!record(value.claim)||!record(value.proof))return null;
 const c=value.claim,p=value.proof;
 if(!closed(c,'schema,assetId,cardProofDigest,cardRootDigest,cardRoot,sourceArtifactSha256,ownerReceizId,previousOwnerReceizId,keyId,attemptId,kaiUPulse,uploadedAt,authority')
  ||c.schema!==WILDZ_UPLOAD_OWNERSHIP_SCHEMA||c.authority!=='local-upload-display-and-sync-only'
  ||typeof c.assetId!=='string'||!/^wilds:[a-f0-9]{24}$/.test(c.assetId)
  ||typeof c.cardProofDigest!=='string'||!PROOF.test(c.cardProofDigest)||typeof c.cardRootDigest!=='string'||!PROOF.test(c.cardRootDigest)
  ||typeof c.sourceArtifactSha256!=='string'||!SHA.test(c.sourceArtifactSha256)
  ||!record(c.cardRoot)||!verifyAnyWildsCard(c.cardRoot as PortableCardAsset).ok||(c.cardRoot as PortableCardAsset).id!==c.assetId||(c.cardRoot as PortableCardAsset).proof.digest!==c.cardRootDigest
  ||wildzUploadCardRootDigest(c.cardRoot as PortableCardAsset)!==c.cardRootDigest
  ||typeof c.keyId!=='string'||!SHA.test(c.keyId)||typeof c.attemptId!=='string'||!/^[a-zA-Z0-9:_-]{1,160}$/.test(c.attemptId)
  ||typeof c.kaiUPulse!=='string'||!exactKai.test(c.kaiUPulse)||typeof c.uploadedAt!=='string'||!Number.isFinite(Date.parse(c.uploadedAt))
  ||typeof c.ownerReceizId!=='string'||parseWildzPlayerCoordinate(c.ownerReceizId)?.profileHandle!==c.ownerReceizId
  ||typeof c.previousOwnerReceizId!=='string'||parseWildzPlayerCoordinate(c.previousOwnerReceizId)?.profileHandle!==c.previousOwnerReceizId
  ||!closed(p,'schema,keyId,alg,challengeB64Url,signatureB64Url,publicKeyRawB64u')||p.schema!=='receiz.identity.login_proof.v1'||p.keyId!==c.keyId
  ||typeof p.alg!=='string'||typeof p.publicKeyRawB64u!=='string'||typeof p.signatureB64Url!=='string'
  ||p.challengeB64Url!==receizBase64UrlEncode(new TextEncoder().encode(canonicalPortableCardJson(c))))return null;
 return value as unknown as WildzSignedUploadOwnershipClaim;
}

export function parseWildzSignedUploadOwnershipClaim(value:unknown):WildzSignedUploadOwnershipClaim|null {
 try { return parseSignedUploadClaim(value); } catch { return null; }
}

function freezeOwnershipClaim<T>(value:T):T{
 if(value&&typeof value==='object'){Object.values(value).forEach(freezeOwnershipClaim);Object.freeze(value);}
 return value;
}

/** Every receiving boundary verifies the specific upload challenge with the SDK.
 * This proves this identity's claim, below native transfer/settlement admission. */
export async function verifyWildzPublishedOwnershipClaims(values:readonly unknown[]){
 const accepted:WildzSignedUploadOwnershipClaim[]=[],seen=new Set<string>();
 for(const value of values){
  const parsed=parseWildzSignedUploadOwnershipClaim(value);if(!parsed)continue;
  const pin=`${parsed.proof.keyId}:${parsed.proof.signatureB64Url}:${parsed.proof.challengeB64Url}`;
  if(seen.has(pin))continue;seen.add(pin);
  const signed=freezeOwnershipClaim(structuredClone(parsed));
  const {keyId,alg,publicKeyRawB64u,challengeB64Url,signatureB64Url}=signed.proof;
  if(!await verifyReceizIdentityPublicKeyProjectionSignature({keyId,alg,publicKeyRawB64u,challengeB64Url,signatureB64Url}))continue;
  const c=signed.claim,head=digest(c).slice(7);
  verifiedProjections.set(signed,Object.freeze({assetId:c.assetId,artifactId:c.sourceArtifactSha256,previousOwnerReceizId:c.previousOwnerReceizId,ownerReceizId:c.ownerReceizId,
   headReference:`upload:${head}`,historyDigestSha256:head,appendCount:1,witnessedKaiPulse:String(BigInt(c.kaiUPulse)/1_000_000n),witnessedKaiUPulse:c.kaiUPulse,witnessedAt:c.uploadedAt}));
  accepted.push(signed);
 }
 return accepted;
}
export function verifiedWildzUploadOwnershipProjection(value:unknown){return record(value)?verifiedProjections.get(value)??null:null;}

export async function readWildzUploadOwnershipHeads(database:WildzContinuityDatabase,assetIds:readonly string[]){
 const values=await Promise.all(assetIds.map(id=>database.read<unknown>('meta',headKey(id))));
 return verifyWildzPublishedOwnershipClaims(values.flatMap(value=>Array.isArray(value)?value:[value]));
}
export async function readWildzOwnerUploadOwnershipClaims(database:WildzContinuityDatabase,session:Pick<WildzIdentitySession,'keyId'|'actorId'>,assets:readonly PortableCardAsset[]){
 const heads=await readWildzUploadOwnershipHeads(database,assets.map(c=>c.id));
 const cards=new Map(assets.map(c=>[c.id,c]));
 return heads.filter(({claim})=>claim.keyId===session.keyId&&sameWildzPlayerCoordinate(claim.ownerReceizId,session.actorId)
  &&cards.has(claim.assetId)&&wildzUploadCardRootDigest(cards.get(claim.assetId)!)===claim.cardRootDigest);
}

/** Call only after an explicit card/Vault upload has durably admitted its exact
 * cards. Keep each immutable attempt and exact coordinate through every retry. */
export async function recordWildzUploadOwnershipClaims(input:Readonly<{
 database:WildzContinuityDatabase;session:Pick<WildzIdentitySession,'keyId'|'actorId'|'localAuthority'|'remoteStatus'>;keyFile:ReceizKeyFile;
 assets:readonly PortableCardAsset[];sourceBytes:Uint8Array;attemptId:string;kaiUPulse:string;uploadedAt:string;assertCurrent?:()=>void;
}>){
 const {database,session,keyFile}=input,owner=parseWildzPlayerCoordinate(session.actorId)?.profileHandle;
 if(session.localAuthority!=='verified'||!owner||keyFile.keyId!==session.keyId
  ||session.remoteStatus!=='connected'&&!sameWildzPlayerCoordinate(keyFile.owner.username??'',owner))throw Error('wildz_upload_claim_identity_mismatch');
 input.assertCurrent?.();
 const sourceArtifactSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input.sourceBytes.slice().buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 const accepted:WildzSignedUploadOwnershipClaim[]=[];
 for(const card of input.assets){
  if(!verifyAnyWildsCard(card).ok)throw Error('wildz_upload_claim_card_invalid');
  const rawPrior=await database.read<unknown>('meta',headKey(card.id));
  const priorHeads=await verifyWildzPublishedOwnershipClaims(Array.isArray(rawPrior)?rawPrior:[rawPrior]);
  const prior=[...priorHeads].sort((a,b)=>BigInt(a.claim.kaiUPulse)>BigInt(b.claim.kaiUPulse)?-1:1)[0],root=wildzUploadCardRootDigest(card);
  if(prior&&prior.claim.attemptId===input.attemptId&&prior.claim.keyId===session.keyId&&prior.claim.cardRootDigest===root&&sameWildzPlayerCoordinate(prior.claim.ownerReceizId,owner)){accepted.push(prior);continue;}
  const key=attemptKey(session.keyId,card.id,input.attemptId),held=await database.read<unknown>('meta',key);
  let signed=(await verifyWildzPublishedOwnershipClaims([held]))[0];
  if(!signed){
   const previousOwnerReceizId=prior?.claim.cardRootDigest===root?prior.claim.ownerReceizId:parseWildzPlayerCoordinate(card.manifest.ownerReceizId)?.profileHandle;
   if(!previousOwnerReceizId)throw Error('wildz_upload_claim_owner_invalid');
   const claim:WildzUploadOwnershipClaim={schema:WILDZ_UPLOAD_OWNERSHIP_SCHEMA,assetId:card.id,cardProofDigest:card.proof.digest,cardRootDigest:root,cardRoot:structuredClone(portableCardBaseProofAsset(card)),sourceArtifactSha256,
    ownerReceizId:owner,previousOwnerReceizId,keyId:session.keyId,attemptId:input.attemptId,kaiUPulse:input.kaiUPulse,uploadedAt:input.uploadedAt,authority:'local-upload-display-and-sync-only'};
   const proof=await signReceizIdentityLoginProof({keyFile,challengeText:canonicalPortableCardJson(claim)});
   signed={schema:'wildz.signed-identity-upload-claim.v1',claim,proof:{...proof,publicKeyRawB64u:keyFile.crypto.publicKeyRawB64u}};
   if(!(await verifyWildzPublishedOwnershipClaims([signed])).length)throw Error('wildz_upload_claim_signature_invalid');
  }
  if(signed.claim.sourceArtifactSha256!==sourceArtifactSha256||signed.claim.cardRootDigest!==root||signed.claim.keyId!==session.keyId||signed.claim.ownerReceizId!==owner)throw Error('wildz_upload_claim_attempt_conflict');
  input.assertCurrent?.();
  const admitted=signed;
  await database.transaction(['meta'],'readwrite',async tx=>{
   const existing=await tx.get<unknown>('meta',key),head=await tx.get<unknown>('meta',headKey(card.id));
   if(existing&&canonicalPortableCardJson(existing)!==canonicalPortableCardJson(admitted))throw Error('wildz_upload_claim_attempt_conflict');
   if(canonicalPortableCardJson(head)!==canonicalPortableCardJson(rawPrior))throw Error('wildz_upload_claim_head_changed');
   await tx.put('meta',admitted,key);await tx.put('meta',retainedClaimHead(priorHeads,admitted),headKey(card.id));
  });
  const [saved]=await verifyWildzPublishedOwnershipClaims([await database.read('meta',key)]);
  if(!saved||canonicalPortableCardJson(saved)!==canonicalPortableCardJson(admitted))throw Error('wildz_upload_claim_storage_failed');
  accepted.push(saved);
 }
 return accepted;
}

function retainedClaimHead(existing:readonly WildzSignedUploadOwnershipClaim[],next:WildzSignedUploadOwnershipClaim){
 const latest=existing.reduce((max,row)=>BigInt(row.claim.kaiUPulse)>max?BigInt(row.claim.kaiUPulse):max,-1n),kai=BigInt(next.claim.kaiUPulse);
 if(latest>kai)return existing.length===1?existing[0]!:existing;
 if(latest<kai)return next;
 const equal=existing.filter(row=>BigInt(row.claim.kaiUPulse)===kai);
 if(equal.some(row=>canonicalPortableCardJson(row)===canonicalPortableCardJson(next)))return equal.length===1?equal[0]!:equal;
 return [...equal,next];
}

/** Restore/read delivery replays the original signature and exact Kai coordinate.
 * Never re-sign or substitute the time at which this projection was observed. */
export async function retainVerifiedWildzUploadOwnershipClaims(database:WildzContinuityDatabase,values:readonly unknown[]){
 const claims=await verifyWildzPublishedOwnershipClaims(values);
 for(const signed of claims){
  const {claim}=signed,key=attemptKey(claim.keyId,claim.assetId,claim.attemptId);
  for(let attempt=0;attempt<3;attempt++){
   const raw=await database.read<unknown>('meta',headKey(claim.assetId));
   const prior=await verifyWildzPublishedOwnershipClaims(Array.isArray(raw)?raw:[raw]),head=retainedClaimHead(prior,signed);
   const committed=await database.transaction(['meta'],'readwrite',async tx=>{
    if(canonicalPortableCardJson(await tx.get('meta',headKey(claim.assetId)))!==canonicalPortableCardJson(raw))return false;
    const held=await tx.get<unknown>('meta',key);
    if(held&&canonicalPortableCardJson(held)!==canonicalPortableCardJson(signed))throw Error('wildz_upload_claim_attempt_conflict');
    await tx.put('meta',signed,key);await tx.put('meta',head,headKey(claim.assetId));return true;
   });
   if(committed)break;
   if(attempt===2)throw Error('wildz_upload_claim_head_changed');
  }
 }
 return claims;
}
