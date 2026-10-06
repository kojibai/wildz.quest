import type { CreationPlan } from './compiler';
import type { CreationPoint, CreationPose } from './types';
export type CreationPreview=Readonly<{plan:CreationPlan;pose:CreationPose;physical:false;writes:0}>;
export function createCreationPreview(plan:CreationPlan,pose:CreationPose=plan.pose):CreationPreview {return {plan,pose,physical:false,writes:0};}
/** Absolute world buffers share the scene's player/elevation origin. */
export function creationSceneOffset(viewer:CreationPoint):[number,number,number] {return [-viewer.x,-viewer.y,-viewer.z];}
export function creationPreviewTransform(preview:CreationPreview,viewer:CreationPoint={x:0,y:0,z:0}) {
 const yaw=preview.pose.yaw-preview.plan.pose.yaw,c=Math.cos(yaw),s=Math.sin(yaw),origin=preview.plan.pose.position,target=preview.pose.position;
 return {yaw,position:[target.x-c*origin.x-s*origin.z-viewer.x,target.y-origin.y-viewer.y,target.z+s*origin.x-c*origin.z-viewer.z] as [number,number,number]};
}
