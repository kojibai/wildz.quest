import {wildzOwnershipWitnessProjectionRecord} from './wildz-ownership-reconcile';
import {verifyWildzPublishedOwnershipClaims,readWildzOwnerUploadOwnershipClaims} from './wildz-upload-ownership';
import {wildzCrewOwnershipWitnesses,type WildzCrewCustody} from './wildz-artifact-codec';
import {sameWildzPlayerCoordinate} from './wildz-player-coordinate';
import type {PortableCardAsset} from '../../features/play/portable-card';
import type {WildzIdentitySession} from './wildz-identity-repository';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
export {parseWildzPublishedOwnershipClaims,verifiedWildzPublishedOwnershipRecords,verifiedWildzProfileOwnershipRecords} from './wildz-published-ownership-record';
export async function readWildzOwnerPublishedOwnershipClaims(database:WildzContinuityDatabase,session:Pick<WildzIdentitySession,'keyId'|'actorId'>,cards:readonly PortableCardAsset[],custody?:WildzCrewCustody|null){
 const local=await readWildzOwnerUploadOwnershipClaims(database,session,cards);
 const localIds=new Set(local.map(row=>row.claim.assetId));
 return [...local,...wildzCrewOwnershipWitnesses(custody,cards).filter(row=>!localIds.has(row.assetId)).map(({assetId,witness})=>wildzOwnershipWitnessProjectionRecord(assetId,witness))];
}

/** Caller data receives the same signature/root/key checks as durable source.
 * Native rows can only come from the exact issued source token. */
export async function admitWildzOwnerPublishedOwnershipClaims(values:readonly unknown[],session:Pick<WildzIdentitySession,'keyId'|'actorId'>,cards:readonly PortableCardAsset[],custody?:WildzCrewCustody|null){
 const local=await verifyWildzPublishedOwnershipClaims(values),byId=new Map(cards.map(c=>[c.id,c]));
 const {wildzUploadCardRootDigest}=await import('./wildz-upload-ownership');
 const {canonicalPortableCardJson}=await import('../../features/play/portable-card');
 const valid=local.filter(({claim})=>claim.keyId===session.keyId&&sameWildzPlayerCoordinate(claim.ownerReceizId,session.actorId)
  &&byId.has(claim.assetId)&&wildzUploadCardRootDigest(byId.get(claim.assetId)!)===claim.cardRootDigest);
 const native=wildzCrewOwnershipWitnesses(custody,cards).map(({assetId,witness})=>wildzOwnershipWitnessProjectionRecord(assetId,witness));
 const accepted=[...valid,...values.filter(value=>native.some(row=>canonicalPortableCardJson(row)===canonicalPortableCardJson(value)))];
 if(accepted.length!==values.length)throw Error('wildz_public_ownership_claim_invalid');
 return accepted;
}
