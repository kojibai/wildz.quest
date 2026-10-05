import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { projectCreationWorkers, combineCreationTechniques } from '../src/features/play/creation/capabilities';
const card=sealCollectedCard({ownerReceizId:'owner',formId:'mintcub-1',encounterId:'creation-worker',capturedAt:'2026-10-05T12:00:00.000Z'});
test('projects only ready current creatures and no techniques from a name',()=>{const c=emptyAdventureCondition(card.id);const [ready]=projectCreationWorkers([card],{[card.id]:c});assert.equal(ready.ready,true);assert.deepEqual(ready.techniques,['assembly']);assert.equal(projectCreationWorkers([card],{[card.id]:{...c,life:'dead'}})[0].ready,false);assert.equal(projectCreationWorkers([{...card,status:'revoked'}],{[card.id]:c})[0].ready,false);assert.equal(projectCreationWorkers([card],{})[0].ready,false);});
test('combines complementary crews and leaves other workers unchanged',()=>{const a={assetId:'a',subjectId:'a',head:'h',proofDigest:'h',ready:true,reasons:[],techniques:['assembly']};const b={...a,assetId:'b',techniques:['masonry']};assert.deepEqual(combineCreationTechniques([a,b]),['assembly','masonry']);assert.deepEqual(combineCreationTechniques([a,{...b,ready:false}]),['assembly']);const c=emptyAdventureCondition(card.id);assert.deepEqual(projectCreationWorkers([card],{[card.id]:c}),projectCreationWorkers([card],{[card.id]:c}));});
