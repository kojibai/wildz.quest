/** Synthetic valid-proof fixture; run after pnpm test. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createWildsConstructionProject } from '../.test-build/src/features/play/wilds-construction-project.js';
import { createWildsConstructionComponent, createWildsMaterialContribution } from '../.test-build/src/features/play/wilds-construction-component.js';
import { createWildsBlueprintPreview, previewWildsBlueprintPlacement } from '../.test-build/src/features/play/wilds-world-construction.js';
import { canonicalPortableCardJson, sha256PortableBasis } from '../.test-build/src/features/play/portable-card.js';
import { createWildsConstructionGeometryProjector, projectWildsConstructionStageGeometry } from '../.test-build/src/features/play/wilds-construction-geometry.js';
const project=createWildsConstructionProject({ownerReceizId:'owner',name:'Benchmark',region:{x:0,z:0},kaiUPulse:1});
const components=[], materials=[];
for(let i=0;i<20;i++){
 const evidence={sourceBlueprint:createWildsBlueprintPreview('blueprint:test','wildz.excavation.region.v1:0:0'),pointer:{x:2,y:0,z:2},rotationQuarterTurns:0,heightStep:0,physical:{terrainY:0,waterline:null,anchors:[],solids:[]}};
 const component=createWildsConstructionComponent({project,evidence,placement:previewWildsBlueprintPlacement({blueprint:evidence.sourceBlueprint,kind:'foundation',...evidence}),ownerReceizId:'owner',kaiUPulse:2,commandId:`place:${i}`});components.push(component);
 for(let j=0;j<5;j++){
 const n=i*5+j+1,kind=j===4?'hay':'stone';
 const basis={schema:'wildz.material-lot.v1',lotId:`wildz:material:${kind}:${n.toString(16).padStart(64,'0')}`,kind,quantity:1,quality:1,ownerReceizId:'creator',source:{sourceId:'source:test',sourceHead:`sha256:${'a'.repeat(64)}`,admittedSourceHead:`sha256:${'b'.repeat(64)}`,kaiUPulse:1},contributors:{explorerReceizId:'creator'},authority:'source-proof-object'};
 const lot={...basis,head:sha256PortableBasis(canonicalPortableCardJson(basis))};
 materials.push(createWildsMaterialContribution({component,lot,custodianReceizId:'owner',contributorReceizId:'owner',commandId:`deposit:${n}`,kaiUPulse:3}));
 }
}
const baseline = process.argv[2] ? (await import(pathToFileURL(resolve(process.argv[2])).href)).projectWildsConstructionStageGeometry : projectWildsConstructionStageGeometry;
const before=()=>components.map(c=>baseline(c,materials,[]));
const after=()=>components.map(createWildsConstructionGeometryProjector(materials,[]));
assert.deepEqual(after(),before());
const median=fn=>{const times=[];for(let i=0;i<5;i++){const start=performance.now();fn();times.push(performance.now()-start);}return times.sort((a,b)=>a-b )[2];};
const clonedComponents=structuredClone(components), clonedMaterials=structuredClone(materials);
const cloned=()=>clonedComponents.map(createWildsConstructionGeometryProjector(clonedMaterials,[]));
assert.deepEqual(cloned(),after());
console.log(JSON.stringify({components:components.length,materials:materials.length,baseline:process.argv[2] ? "supplied baseline module" : "current ungrouped projector",beforeMs:median(before),afterMs:median(after),workerClonedMs:median(cloned)},null,2));
