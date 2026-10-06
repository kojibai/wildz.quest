import {constructionProofDigest,freezeConstructionProof,sealConstructionProof,validConstructionHead,validConstructionId} from '../wilds-construction-project';
import {assertCreationData} from './definition';
import type {CreationPlan} from './compiler';
import type {CreationWorker} from './capabilities';
import type {CreationResourceSelection} from './resources';
import {verifyCreationOperation,type CreationOperation} from './operation';
export type CreationTask=Readonly<{taskId:string;nodeIds:readonly string[];workerId:string;technique:string;dependencyTaskIds:readonly string[];resources:CreationResourceSelection;work:number}>;
export type CreationCrewEvidence=Readonly<{ownerHead:string;workerHeads:Readonly<Record<string,string>>;jobHeads:Readonly<Record<string,string>>;readyWorkerIds:readonly string[];consentingWorkerIds:readonly string[];arrivedWorkerIds:readonly string[];revokedWorkerIds:readonly string[]}>;
export type CreationCrewContext=Readonly<{batchId:string;operation:CreationOperation;evidence:CreationCrewEvidence;readEvidence:()=>Promise<CreationCrewEvidence>}>;
export type CreationCrewBatch=Readonly<{schema:'wildz.creation-crew-batch.v1';batchId:string;operation:CreationOperation;tasks:readonly CreationTask[];expected:CreationCrewEvidence;phase:'prepared'|'pending'|'admitted'|'cancelled'|'recovering';revision:number;head:string}>;
export function planCreationTasks(plan:CreationPlan,workers:readonly CreationWorker[]):readonly CreationTask[]{
 if(!workers.length||workers.length>32||workers.some(w=>!w.ready)||new Set(workers.map(w=>w.subjectId)).size!==workers.length||plan.requiredTechniques.some(t=>!workers.some(w=>w.techniques.includes(t))))throw Error('creation_crew_technique_unavailable');
 if(!Array.isArray(plan.nodeWork)||plan.nodeWork.reduce((total,n)=>total+n.work,0)!==plan.requiredWork||plan.nodeWork.some(n=>!Number.isSafeInteger(n.work)||n.work<0||!n.techniques.length))throw Error('creation_crew_node_work_invalid');
 const tasks:CreationTask[]=[];
 for(const [stage,nodeIds] of plan.stages.entries()){
  const groups=new Map<string,{nodeIds:string[];work:number}>();
  for(const nodeId of nodeIds){
   const node=plan.nodeWork.find(n=>n.nodeId===nodeId);if(!node)throw Error('creation_crew_node_work_missing');
   if(node.work===0)continue;
   let remaining=node.work;
   node.techniques.forEach((technique:string,index:number)=>{const work=Math.ceil(remaining/(node.techniques.length-index));remaining-=work;const group=groups.get(technique)??{nodeIds:[],work:0};group.nodeIds.push(nodeId);group.work+=work;groups.set(technique,group);});
  }
  const dependencies=tasks.filter(t=>plan.stages[stage-1]?.some(id=>t.nodeIds.includes(id))).map(t=>t.taskId);
  for(const [technique,group] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
   const eligible=workers.filter(w=>w.techniques.includes(technique)).sort((a,b)=>a.subjectId.localeCompare(b.subjectId));
   if(!eligible.length)throw Error('creation_crew_technique_unavailable');
   let remaining=group.work;
   eligible.forEach((worker,index)=>{const work=Math.ceil(remaining/(eligible.length-index));remaining-=work;const scope={stage,technique,workerId:worker.subjectId,nodeIds:group.nodeIds};tasks.push({taskId:`creation:task:${constructionProofDigest({plan:plan.digest,...scope}).slice(7)}`,nodeIds:group.nodeIds,workerId:worker.subjectId,technique,dependencyTaskIds:dependencies,resources:{lots:[],deficits:{}},work});});
  }
 }
 if(!tasks.length||tasks.length>64)throw Error('creation_crew_staged_batch_required');
 return freezeConstructionProof(JSON.parse(JSON.stringify(tasks))) as readonly CreationTask[];
}
export function creationCrewEvidenceMatches(a:CreationCrewEvidence,b:CreationCrewEvidence):boolean{return constructionProofDigest(a)===constructionProofDigest(b);}
export async function prepareCreationCrewBatch(tasks:readonly CreationTask[],context:CreationCrewContext):Promise<CreationCrewBatch>{
 const request={tasks:JSON.parse(JSON.stringify(tasks)) as CreationTask[],operation:JSON.parse(JSON.stringify(context.operation)) as CreationOperation,expected:JSON.parse(JSON.stringify(context.evidence)) as CreationCrewEvidence,batchId:context.batchId};
 assertCreationData(request);
 if(!validConstructionId(request.batchId)||!verifyCreationOperation(request.operation))throw Error('creation_crew_operation_invalid');
 if(!request.tasks.length||request.tasks.length>64||new Set(request.tasks.map(t=>t.taskId)).size!==request.tasks.length)throw Error('creation_crew_tasks_invalid');
 const workers=request.operation.workerAllocations.map(w=>w.workerId),expected=request.expected;
 if(request.tasks.some(t=>!workers.includes(t.workerId)||!validConstructionId(t.taskId)||!request.operation.mandates.some(m=>m.workerId===t.workerId&&m.techniques.includes(t.technique))))throw Error('creation_crew_worker_technique_mismatch');
 if(request.operation.workerAllocations.some(w=>request.tasks.filter(t=>t.workerId===w.workerId).reduce((n,t)=>n+t.work,0)!==w.work))throw Error('creation_crew_worker_work_mismatch');
 if(expected.ownerHead!==request.operation.expectedHeads[`actor:${request.operation.actorId}`]||workers.some(id=>!validConstructionHead(expected.workerHeads[id])||expected.workerHeads[id]!==request.operation.expectedHeads[id]||!validConstructionHead(expected.jobHeads[id])||!expected.readyWorkerIds.includes(id)||!expected.consentingWorkerIds.includes(id)||!expected.arrivedWorkerIds.includes(id)||expected.revokedWorkerIds.includes(id)))throw Error('creation_crew_current_evidence_required');
 const done=new Set<string>();for(const task of request.tasks){if(task.dependencyTaskIds.some(id=>!done.has(id))||task.nodeIds.some(id=>!Object.values(request.operation.command.instance.nodeStates).some(n=>n.nodeId===id))||!Number.isSafeInteger(task.work)||task.work<0)throw Error('creation_crew_dependency_invalid');done.add(task.taskId);}
 if(request.tasks.reduce((n,t)=>n+t.work,0)!==request.operation.workerAllocations.reduce((n,w)=>n+w.work,0))throw Error('creation_crew_work_mismatch');
 const lots=request.tasks.flatMap(t=>t.resources.lots);if(new Set(lots.map(l=>l.id)).size!==lots.length)throw Error('creation_crew_shared_lot_contention');
 if(lots.length&&constructionProofDigest([...lots].sort((a,b)=>a.id.localeCompare(b.id)))!==constructionProofDigest([...request.operation.resources].sort((a,b)=>a.id.localeCompare(b.id))))throw Error('creation_crew_resource_mismatch');
 if(!lots.length)request.tasks[0]={...request.tasks[0],resources:{lots:request.operation.resources,deficits:{}}};
 const current=await context.readEvidence();if(!creationCrewEvidenceMatches(current,expected))throw Error('creation_crew_sources_changed');
 return sealConstructionProof({schema:'wildz.creation-crew-batch.v1' as const,batchId:request.batchId,operation:request.operation,tasks:request.tasks,expected,phase:'prepared' as const,revision:0});
}

export function verifyCreationCrewBatch(value:unknown):value is CreationCrewBatch{
 try{
  assertCreationData(value);const batch=value as CreationCrewBatch,{head,...basis}=batch,workers=batch.operation.workerAllocations;
  if(batch.schema!=='wildz.creation-crew-batch.v1'||!verifyCreationOperation(batch.operation)||!validConstructionId(batch.batchId)||!validConstructionHead(head)||constructionProofDigest(basis)!==head||!Number.isSafeInteger(batch.revision)||batch.revision<0||!['prepared','pending','admitted','cancelled','recovering'].includes(batch.phase)||!batch.tasks.length||batch.tasks.length>64)return false;
  const done=new Set<string>();
  for(const task of batch.tasks){
   if(!validConstructionId(task.taskId)||done.has(task.taskId)||!workers.some(w=>w.workerId===task.workerId)||!Number.isSafeInteger(task.work)||task.work<0||!task.nodeIds.length||task.nodeIds.some(id=>!Object.values(batch.operation.command.instance.nodeStates).some(n=>n.nodeId===id))||task.dependencyTaskIds.some(id=>!done.has(id))||!batch.operation.mandates.some(m=>m.workerId===task.workerId&&m.techniques.includes(task.technique)))return false;
   done.add(task.taskId);
  }
  if(workers.some(w=>batch.tasks.filter(t=>t.workerId===w.workerId).reduce((n,t)=>n+t.work,0)!==w.work))return false;
  const lots=batch.tasks.flatMap(t=>t.resources.lots);
  return new Set(lots.map(l=>l.id)).size===lots.length&&constructionProofDigest([...lots].sort((a,b)=>a.id.localeCompare(b.id)))===constructionProofDigest([...batch.operation.resources].sort((a,b)=>a.id.localeCompare(b.id)));
 }catch{return false;}
}
