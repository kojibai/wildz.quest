import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactCreationPlannerRequest, type CreationPlannerRequest } from '../src/features/play/creation/planner';
import { selectCreationProposalEvidence, runCreationProposal, CREATION_PROPOSAL_BODY_LIMIT } from '../src/features/play/creation/proposal-work';
import { createCreationProposalClient, type CreationProposalWorkerPort } from '../src/features/play/creation/proposal-worker-client';
import { proposeLocalCreation } from '../src/lib/receiz/wilds-local-creation-planner';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { compileCreation } from '../src/features/play/creation/compiler';
import { creationContextFixture } from './support/creation-fixtures';
const card=sealCollectedCard({formId:'mintcub-1',ownerReceizId:'owner',encounterId:'proposal',capturedAt:'2026-07-15T00:00:00.000Z'});
const request=():CreationPlannerRequest=>({requestId:'proposal:test',actorId:'owner',message:'Build a timber table',selected:null,
 workers:[{assetId:card.id,subjectId:'creature',head:`sha256:${'a'.repeat(64)}`,proofDigest:card.proof.digest,techniques:['assembly'],ready:true,reasons:[]}],
 context:creationContextFixture({budget:{timber:20},techniques:['assembly']})});

test('proposal transfer omits physical world and unselected admissions before serialization',()=>{
 const input=request();Object.defineProperty(input.context,'physical',{get(){throw Error('physical evidence must not be read');}});
 const admissions={ [card.id]:{selected:true}, unrelated:{secret:'x'.repeat(2_000_000)} };
 const compact=compactCreationPlannerRequest(input);
 const evidence=selectCreationProposalEvidence(compact,{cards:[card],cardAdmissions:admissions,lots:[]});
 assert.deepEqual(compact.context.physical,[]);assert.deepEqual(Object.keys(evidence.cardAdmissions),[card.id]);
 assert.ok(JSON.stringify({...compact,...evidence}).length<CREATION_PROPOSAL_BODY_LIMIT);
});

test('over-limit evidence yields the exact deterministic local draft without sending an oversized request',async()=>{
 const input=request(),evidence={cards:[card],cardAdmissions:{[card.id]:{history:'x'.repeat(CREATION_PROPOSAL_BODY_LIMIT+1)}},lots:[]};
 let calls=0;const signal=new AbortController().signal;
 const result=await runCreationProposal(input,evidence,signal,async()=>{calls++;throw Error('oversized request must remain local');});
 assert.equal(calls,0);assert.equal(result.status,'proposed');
 if(result.status!=='proposed')throw Error('Expected local draft');
 assert.deepEqual(result.proposal,proposeLocalCreation(input,signal));
 assert.equal('plan' in result.proposal,false);assert.equal('receipt' in result.proposal,false);
 if(!('definition'in result.proposal))throw Error('Expected definition');
 assert.equal(compileCreation(result.proposal.definition,{...input.context,budget:{timber:0}}).status,'blocked','local proposal cannot grant materials');
 const physical=[{chunkId:'occupied',head:`sha256:${'c'.repeat(64)}`,terrain:[],solids:[{id:'occupied',yaw:0,center:{x:0,y:1,z:0},halfExtents:{x:100,y:100,z:100}}],walkable:[],portals:[]}];
 assert.equal(compileCreation(result.proposal.definition,{...input.context,physical}).status,'blocked','live collision evidence remains mandatory');
});

test('413 falls back locally, while authenticated refusal and stale remote proposals remain blocked',async()=>{
 const input=request(),evidence={cards:[card],cardAdmissions:{},lots:[]},signal=new AbortController().signal;
 const local=await runCreationProposal(input,evidence,signal,async()=>Response.json({status:'blocked',reason:'Creation request too large.'},{status:413}));
 assert.equal(local.status,'proposed');
 const denied=await runCreationProposal(input,evidence,signal,async()=>Response.json({status:'blocked',reason:'Current creature ownership could not be verified.'},{status:403}));
 assert.deepEqual(denied,{status:'blocked',reason:'Current creature ownership could not be verified.'});
 const stale=await runCreationProposal(input,evidence,signal,async()=>Response.json({status:'proposed',proposal:{...proposeLocalCreation(input,signal),requestId:'obsolete'}}));
 assert.equal(stale.status,'blocked');
});

test('canceled HTTP proposals cannot turn into a late local fallback',async()=>{
 const input=request(),abort=new AbortController();let resolve!:(value:Response)=>void;
 const pending=runCreationProposal(input,{cards:[card],cardAdmissions:{},lots:[]},abort.signal,()=>new Promise(done=>{resolve=done;}));
 abort.abort();resolve(Response.json({status:'blocked'},{status:413}));
 assert.equal((await pending).status,'unavailable');
});

test('proposal worker cancellation rejects pending work and never admits its stale reply',async()=>{
 let sent:unknown,terminated=0;
 const port:CreationProposalWorkerPort={onmessage:null,onerror:null,postMessage(value){sent=value;},terminate(){terminated++;}};
 const client=createCreationProposalClient(()=>port),abort=new AbortController(),input=request();
 const pending=client.propose(input,{cards:[card],cardAdmissions:{},lots:[]},abort.signal);
 const rejected=assert.rejects(pending,{name:'AbortError'});const late=port.onmessage!;
 abort.abort();await rejected;
 late({data:{requestId:input.requestId,result:{status:'proposed',proposal:proposeLocalCreation(input,new AbortController().signal)}}});
 assert.ok(sent);assert.equal(terminated,1);client.close();
});

test('proposal material hints include only finite selected-budget evidence and bound oversized accounts',()=>{
 const input=request();
 const lot=(id:string,kind='timber',owner='owner')=>({lotId:id,kind,ownerReceizId:owner,quantity:1}) as import('../src/features/play/wilds-steward-construction').WildsMaterialLotV1;
 const source=[lot('foreign','timber','other'),lot('unused','stone'),...Array.from({length:100},(_,i)=>lot(`wood:${i}`))];
 const selected=selectCreationProposalEvidence(input,{cards:[card],cardAdmissions:{},lots:source});
 assert.equal(selected.lots.length,20);assert.ok(selected.lots.every(value=>value.kind==='timber'&&value.ownerReceizId==='owner'));
 const huge={...input,context:{...input.context,budget:{timber:100_000}}};
 const bounded=selectCreationProposalEvidence(huge,{cards:[card],cardAdmissions:{},lots:Array.from({length:5000},(_,i)=>lot(`wood:${i}`))});
 assert.equal(bounded.localOnly,true);assert.equal(bounded.lots.length,0);
 assert.equal(source.length,102,'selection never consumes or removes real materials');
});

test('successful remote enhancement preserves a different valid proposal',async()=>{
 const input=request(),signal=new AbortController().signal;
 const enhanced=proposeLocalCreation({...input,message:'Build a timber bench'},signal);
 assert.notDeepEqual(enhanced,proposeLocalCreation(input,signal));
 const result=await runCreationProposal(input,{cards:[card],cardAdmissions:{},lots:[]},signal,async()=>Response.json({status:'proposed',proposal:enhanced}));
 assert.equal(result.status,'proposed');if(result.status==='proposed')assert.deepEqual(result.proposal,enhanced);
});

test('worker creation, dispatch and runtime failures retain a recoverable draft error',async()=>{
 const input=request(),evidence={cards:[card],cardAdmissions:{},lots:[]},signal=new AbortController().signal;
 const missing=createCreationProposalClient(()=>{throw Error('unsupported');});
 await assert.rejects(missing.propose(input,evidence,signal),/worker unavailable/);missing.close();
 let terminated=0;
 const port:CreationProposalWorkerPort={onmessage:null,onerror:null,postMessage(){throw Error('clone failed');},terminate(){terminated++;}};
 const dispatch=createCreationProposalClient(()=>port);
 await assert.rejects(dispatch.propose(input,evidence,signal),/could not accept/);assert.equal(terminated,1);dispatch.close();
 port.postMessage=()=>{};
 const runtime=createCreationProposalClient(()=>port),pending=runtime.propose(input,evidence,signal);
 port.onerror!({preventDefault(){}});
 await assert.rejects(pending,/worker failed/);assert.equal(terminated,2);runtime.close();
});

test('oversized account evidence retains all ten mansion rooms and exact material/work charges',async()=>{
 const input={...request(),message:'Build a timber mansion with multiple floors and 10 rooms',context:creationContextFixture({budget:{timber:1000},techniques:['assembly']})};
 const signal=new AbortController().signal;
 const expected=proposeLocalCreation(input,signal);
 const result=await runCreationProposal(input,{cards:[card],cardAdmissions:{[card.id]:{history:'x'.repeat(CREATION_PROPOSAL_BODY_LIMIT+1)}},lots:[]},signal,async()=>{throw Error('Oversized evidence must stay local');});
 assert.equal(result.status,'proposed');if(result.status!=='proposed'||!('definition'in result.proposal)||!('definition'in expected))throw Error('Expected mansion');
 assert.deepEqual(result.proposal,expected);
 assert.equal(result.proposal.definition.nodes.filter(node=>node.behaviors.some(behavior=>behavior.id==='habitat')).length,10);
 const compiled=compileCreation(result.proposal.definition,input.context),baseline=compileCreation(expected.definition,input.context);
 assert.equal(compiled.status,'ready');assert.deepEqual(compiled,baseline);
 if(compiled.status!=='ready')throw Error('Expected funded mansion');
 assert.ok(compiled.plan.requiredResources.timber>12);assert.ok(compiled.plan.requiredWork>0);
 assert.equal(compileCreation(result.proposal.definition,{...input.context,budget:{timber:12}}).status,'blocked');
});
