'use client';
import { useMemo,useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { sealCollectedCard } from '../portable-card';
import { emptyAdventureCondition } from '../adventure/card-condition';
import { sealConstructionProof } from '../wilds-construction-project';
import CreationSession from './CreationSession';
import WildsCreationPreview from './WildsCreationPreview';
import { createCreationDefinition } from './definition';
import type { CreationPreview } from './preview';
import type { CreationPlannerPort } from './planner';
const card=sealCollectedCard({ownerReceizId:'fixture',formId:'mintcub-1',encounterId:'creation:fixture',capturedAt:'2026-10-05T12:00:00.000Z'});
const cards=[card],conditions={[card.id]:emptyAdventureCondition(card.id)};
const lots=Array.from({length:100},(_,i)=>sealConstructionProof({schema:'wildz.material-lot.v1' as const,lotId:`wildz:material:timber:${i.toString(16).padStart(64,'0')}`,kind:'timber' as const,quantity:1 as const,quality:1 as const,ownerReceizId:'fixture',source:{sourceId:'fixture:tree',sourceHead:`sha256:${'a'.repeat(64)}`,admittedSourceHead:`sha256:${'b'.repeat(64)}`,kaiUPulse:1},contributors:{explorerReceizId:'fixture'},authority:'source-proof-object' as const}));
const planner:CreationPlannerPort={async propose(request,signal){if(signal.aborted)throw Error('Cancelled');return {requestId:request.requestId,reply:'Development fixture: a deterministic room proposal. This is not live AI generation or admitted construction.',definition:createCreationDefinition({schema:'wildz.creation-definition.v1',grammarVersion:1,seed:'fixture:room',creatorId:'fixture',nodes:[{id:'room',parentId:null,pose:{position:{x:0,y:0,z:0},yaw:0},shape:{kind:'shell',width:4,height:3,depth:5,thickness:.15,doorway:{width:1.2,height:2.2}},material:'timber',attachments:[],supports:[],behaviors:[]}],assets:[]})};}};
export default function CreationBrowserFixture(){
 const [open,setOpen]=useState(true),[preview,setPreview]=useState<CreationPreview|null>(null);
 const context=useMemo(()=>({worldId:'fixture',spaceId:'fixture:surface',sourceHead:`sha256:${'a'.repeat(64)}`,pose:{position:{x:0,y:0,z:0},yaw:0},budget:{timber:100},techniques:['assembly'],physical:[],quality:'low' as const}),[]);
 return <main style={{position:'fixed',inset:0,background:'#101c18',color:'#edf2e5'}}><p style={{position:'absolute',zIndex:10,left:16,top:8,maxWidth:280,fontSize:12}}>Creation development fixture · synthetic resources · fake planner · real worker/compiler · nonphysical preview</p><Canvas camera={{position:[8,7,9],fov:45}}><ambientLight intensity={1.5}/><directionalLight position={[6,10,4]}/><gridHelper args={[40,40,'#607b6c','#24392c']}/>{preview?<WildsCreationPreview preview={preview}/>:null}<OrbitControls target={[0,1,0]}/></Canvas><output data-testid="creation-fixture-state" style={{position:'absolute',zIndex:5,bottom:12,left:16}}>{preview?`Worker preview ready · ${preview.plan.chunks.length} pages · ${preview.plan.requiredResources.timber} timber · physical: false`:'No compiled preview'}</output>{open?<CreationSession ownerId="fixture" spaceId="fixture:surface" cards={cards} conditions={conditions} lots={lots} context={context} cardAdmissions={{}} onPreview={setPreview} onClose={()=>setOpen(false)} onManualBuild={()=>setOpen(false)} planner={planner}/>:<button style={{position:'absolute',top:90,right:16}} onClick={()=>setOpen(true)}>Create with creatures</button>}</main>;
}
