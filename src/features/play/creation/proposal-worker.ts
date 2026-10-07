import { runCreationProposal, type CreationProposalEvidence } from './proposal-work';
import type { CreationPlannerRequest } from './planner';
type Request={requestId:string;request:CreationPlannerRequest;evidence:CreationProposalEvidence};
const scope=self as unknown as {onmessage:((event:MessageEvent<Request>)=>void)|null;postMessage(message:unknown):void};
scope.onmessage=({data})=>{
 void runCreationProposal(data.request,data.evidence,new AbortController().signal).then(
  result=>scope.postMessage({requestId:data.requestId,result}),
  ()=>scope.postMessage({requestId:data.requestId,result:{status:'unavailable',reason:'The creation planner could not prepare this draft.'}}));
};
