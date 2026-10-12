import {ownershipSyncProjection} from './wildz-ownership-reconcile';
import {parseWildzSignedUploadOwnershipClaim,verifyWildzPublishedOwnershipClaims} from './wildz-upload-ownership';
import {sameWildzPlayerCoordinate} from './wildz-player-coordinate';

/** Public record parsing must remain independent of private artifact opening
 * and card export, which themselves consume these public records. */
export function parseWildzPublishedOwnershipClaims(value:unknown,owner:string,assetIds:readonly string[]){
 if(!Array.isArray(value)||value.length>1000)throw Error('wildz_public_ownership_claim_invalid');
 const ids=new Set(assetIds);
 for(const row of value){
  const local=parseWildzSignedUploadOwnershipClaim(row),claim=local?{assetId:local.claim.assetId,ownerReceizId:local.claim.ownerReceizId}:ownershipSyncProjection(row);
  if(!claim||!ids.has(claim.assetId)||!sameWildzPlayerCoordinate(claim.ownerReceizId,owner))throw Error('wildz_public_ownership_claim_invalid');
 }
 return value as readonly unknown[];
}

export async function verifiedWildzPublishedOwnershipRecords(values:readonly unknown[]){
 const local=await verifyWildzPublishedOwnershipClaims(values);
 return [...values.filter(row=>ownershipSyncProjection(row)&&!parseWildzSignedUploadOwnershipClaim(row)),...local];
}

/** Registry-authenticated profile owner plus relay-enforced publisher key bind
 * the self-verifying upload proof to its actual published account. */
export async function verifiedWildzProfileOwnershipRecords(profiles:readonly import('./wildz-profile-record').PublicWildzProfileRecord[]){
 const accepted:unknown[]=[];
 for(const profile of profiles){
  const claims=await verifyWildzPublishedOwnershipClaims([...(profile.ownershipClaims??[]),...(profile.ownershipHistory??[])]);
  accepted.push(...claims.filter(({claim})=>profile.publisherKeyId===claim.keyId&&sameWildzPlayerCoordinate(profile.handle,claim.ownerReceizId)));
  accepted.push(...(profile.ownershipClaims??[]).filter(row=>!parseWildzSignedUploadOwnershipClaim(row)&&ownershipSyncProjection(row)));
 }
 return accepted;
}
