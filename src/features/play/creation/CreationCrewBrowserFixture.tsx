'use client';
import {useRef,useState} from 'react';
import {createWildzContinuityDatabase} from '../../../lib/storage/wildz-indexed-db';
import {createWildsCrewJournal} from '../wilds-crew-journal';
import {constructionProofDigest,sealConstructionProof} from '../wilds-construction-project';
import {createCreationDefinition} from './definition';
import {compileCreation} from './compiler';
import {prepareCreationOperation,CREATION_CONSTRUCT_RULE_ID,CREATION_CONSTRUCT_RULE_HEAD} from './operation';
import {emptyCreationState} from './state';
import {planCreationTasks,prepareCreationCrewBatch,type CreationCrewBatch,type CreationCrewEvidence} from './crew';
import {createCreationCrewJournal} from './crew-journal';
const head=`sha256:${'a'.repeat(64)}`;
const worker={assetId:'fixture:card',subjectId:'creature:fixture',head,proofDigest:head,techniques:['assembly'],ready:true,reasons:[]};
const evidence:CreationCrewEvidence={ownerHead:head,workerHeads:{[worker.subjectId]:head},jobHeads:{[worker.subjectId]:`sha256:${'b'.repeat(64)}`},readyWorkerIds:[worker.subjectId],consentingWorkerIds:[worker.subjectId],arrivedWorkerIds:[worker.subjectId],revokedWorkerIds:[]};
async function candidate(batchId:string){
 const definition=createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:'browser-crew',creatorId:'fixture',assets:[],nodes:[{id:'room',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'shell',width:4,height:3,depth:5,thickness:.15,doorway:{width:1.2,height:2.2}},material:'timber',attachments:[],supports:[],behaviors:[]}]});
 const context={worldId:'fixture',spaceId:'surface',sourceHead:head,pose:{position:{x:0,y:0,z:0},yaw:0},budget:{timber:20},techniques:['assembly'],physical:[],quality:'low' as const};
 const compiled=compileCreation(definition,context);if(compiled.status!=='ready')throw Error('fixture_compile_failed');
 const lots=Array.from({length:20},(_,i)=>sealConstructionProof({schema:'wildz.material-lot.v1' as const,lotId:`wildz:material:timber:${i.toString(16).padStart(64,'0')}`,kind:'timber' as const,quantity:1 as const,quality:1 as const,ownerReceizId:'fixture',source:{sourceId:'fixture:tree',sourceHead:head,admittedSourceHead:head,kaiUPulse:1},contributors:{explorerReceizId:'fixture'},authority:'source-proof-object' as const}));
 const mandate={id:'mandate:fixture',head,workerId:worker.subjectId,ownerId:'fixture',techniques:['assembly'],workCeiling:100,expiresKaiUPulse:100,revoked:false};
 const sources=[{id:'actor:fixture',head,kind:'actor'},{id:'space:surface',head,kind:'space'},{id:`rule:${CREATION_CONSTRUCT_RULE_ID}`,head:CREATION_CONSTRUCT_RULE_HEAD,kind:'rule'},{id:worker.subjectId,head,kind:'creature'},{id:mandate.id,head,kind:'mandate'},...lots.map(l=>({id:l.lotId,head:l.head,kind:'material'}))];
 const state={...emptyCreationState(),definitions:{[definition.digest]:definition},resources:Object.fromEntries(lots.map(l=>[l.lotId,{id:l.lotId,head:l.head,kind:l.kind,quantity:1,ownerId:'fixture',spent:false}]))};
 const operation=prepareCreationOperation(compiled.plan,{operationId:`operation:${batchId}`,instanceId:`instance:${batchId}`,actorId:'fixture',kaiUPulse:2,definition,compileContext:context,state,authority:{actorId:'fixture',rules:{[CREATION_CONSTRUCT_RULE_ID]:CREATION_CONSTRUCT_RULE_HEAD},sources,mandates:[],verifySource:s=>sources.some(v=>v.id===s.id&&v.head===s.head&&v.kind===s.kind)},workers:[worker],mandates:[mandate],lots,availability:{actorId:'fixture',heads:Object.fromEntries(lots.map(l=>[l.lotId,l.head])),custody:Object.fromEntries(lots.map(l=>[l.lotId,'fixture'])),reserved:new Set(),spent:new Set(),stored:new Set()},workCeiling:100,causalParents:[]});
 return prepareCreationCrewBatch(planCreationTasks(compiled.plan,[worker]),{batchId,operation,evidence,readEvidence:async()=>evidence});
}
export default function CreationCrewBrowserFixture(){
 const ports=useRef<ReturnType<typeof createPorts>|null>(null),[batchId,setBatchId]=useState('tab-a'),[status,setStatus]=useState('Not prepared');
 const run=async(action:'prepare'|'reserve'|'recall'|'read')=>{
  setStatus(`Running ${action}`);
  try{
   const p=ports.current??(ports.current=createPorts());
   if(action==='prepare'){const initialized=await p.journal.observeEvidence(null,evidence);if(!initialized&&!await p.journal.observeEvidence(constructionProofDigest(evidence),evidence))throw Error('fixture_evidence_changed');setStatus('Test crew prepared');return;}
   let batch:CreationCrewBatch|null=null;
   if(action==='reserve')batch=await p.journal.stageBatch(await candidate(batchId));
   if(action==='recall')batch=await p.journal.recallBatch(batchId);
   if(action==='read')batch=await p.journal.readBatch(batchId);
   const lot=await p.legacy.reservation(`wildz:material:timber:${'0'.repeat(64)}`);
   setStatus(`${batchId}: ${batch?.phase??'missing'} · material reservation: ${lot?'held':'free'} · source writes: 0`);
  }catch(error){setStatus(error instanceof Error?error.message:'Fixture failed');}
 };
 return <main style={{padding:24,color:'#e8efde',background:'#14261e',minHeight:'100vh'}}><h1>Creation crew IndexedDB fixture</h1><p>Synthetic sources and local scheduling only. No world dispatch or physical creation.</p><label>Batch ID <input value={batchId} onChange={e=>setBatchId(e.target.value)}/></label><div style={{display:'flex',gap:12,margin:'16px 0'}}><button onClick={()=>void run('prepare')}>Prepare test crew</button><button onClick={()=>void run('reserve')}>Reserve crew</button><button onClick={()=>void run('recall')}>Recall crew</button><button onClick={()=>void run('read')}>Read journal</button></div><output aria-live="polite">{status}</output></main>;
}
function createPorts(){const database=createWildzContinuityDatabase({name:'wildz.creation-crew.browser-qualification.2026-10-05'});return {journal:createCreationCrewJournal('fixture',database),legacy:createWildsCrewJournal('fixture',database)};}
