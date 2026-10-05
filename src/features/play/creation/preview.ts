import type { CreationPlan } from './compiler';
export type CreationPreview=Readonly<{plan:CreationPlan;physical:false;writes:0}>;
export function createCreationPreview(plan:CreationPlan):CreationPreview {return {plan,physical:false,writes:0};}
