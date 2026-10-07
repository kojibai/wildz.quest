import type {WildsWorldProjection} from "../../features/play/wilds-world-state";
import type {WildsResourcePackageTransferOffer} from "./wilds-resource-package";
import {sameWildzPlayerCoordinate} from "./wildz-player-coordinate";

/** The reader must return a proof-verified conditional source head. Market
 * custody uses its private cancellation coordinator instead of this flow. */
export async function executeOfferedResourcePackageCancellation<T>(input:Readonly<{
  ownerHandle:string;
  offer:WildsResourcePackageTransferOffer;
  readVerifiedSource:()=>Promise<WildsWorldProjection>;
  reserveCancellation:()=>Promise<unknown>;
  cancelNative:()=>Promise<unknown>;
  commitCancellation:()=>Promise<T>;
}>):Promise<T>{
  const world=await input.readVerifiedSource(),offer=input.offer,current=world.resourcePackages?.[offer.package.packageId];
  if(!current || !["offered","cancelling"].includes(current.status) || !sameWildzPlayerCoordinate(current.ownerReceizId,input.ownerHandle)
    || current.package.head!==offer.package.head || current.subjectId!==offer.subjectId
    || current.offer?.transferId!==offer.instrument.plan.transferId || current.offer.artifactDigest!==offer.instrument.artifactDigest
    || current.offer.targetHandle!==offer.targetHandle)throw Error("wilds_resource_package_cancellation_unavailable");
  // The conditional source successor fences listing and payment before any
  // native cancellation. A rejected/conflicting successor makes no native call.
  await input.reserveCancellation();
  await input.cancelNative();
  return input.commitCancellation();
}
