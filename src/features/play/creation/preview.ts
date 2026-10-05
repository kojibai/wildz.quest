import type { CreationPlan } from './compiler';
import type { CreationPose } from './types';
export type CreationPreview=Readonly<{plan:CreationPlan;pose:CreationPose;physical:false;writes:0}>;
export function createCreationPreview(plan:CreationPlan,pose:CreationPose=plan.pose):CreationPreview {return {plan,pose,physical:false,writes:0};}
export function creationPreviewTransform(preview:CreationPreview) {
 const yaw=preview.pose.yaw-preview.plan.pose.yaw,c=Math.cos(yaw),s=Math.sin(yaw),origin=preview.plan.pose.position,target=preview.pose.position;
 return {yaw,position:[target.x-c*origin.x-s*origin.z,target.y-origin.y,target.z+s*origin.x-c*origin.z] as [number,number,number]};
}
