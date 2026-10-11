/// <reference lib="webworker" />
/** Disposable deterministic admission port. Real worker client/dispatch,
 * reducers, codec and finite law; synthetic currentness/CAS, no signer or SDK
 * artifact replacement. Genuine native verification is qualified separately. */
'use client';
import {mergeQualifiedWildsResourceWorldV128} from '../wilds-resource-application-world-v128';
import { paidClearanceTrace, clearanceFixtureTree } from './clearance-browser-model';
import { initialWildsResourceJournalV128, reduceWildsResourceJournalV128, replayWildsResourceJournalOwnerV128, type WildsResourceJournalV128, type WildsResourceJournalEventV128 } from '@/lib/receiz/wilds-resource-journal-v128';
import { deriveWildsClearanceCommandV128, planWildsClearancePickupV128, type WildsClearancePickupProposalV128, type WildsClearanceAdmissionV128 } from '@/lib/receiz/wilds-clearance-admission-v128';
import { encodeWildsResourceEventV128, decodeWildsResourceEventV128 } from '@/lib/receiz/wilds-resource-event-codec-v128';
import { createWildzContinuityDatabase, type WildzContinuityDatabase } from '@/lib/storage/wildz-indexed-db';
import { compileCreation } from '../creation/compiler';
import { createCreationDefinition } from '../creation/definition';
import { selectCreationResources } from '../creation/resources';
import { previewWildsConstructionAdjustment } from '../wilds-construction-placement';
import { creationWorldSourceHistory, creationWorldReplacementSafe, creationWorldSourceHead, creationWorldAvailability, compileWorldCreationSource } from '../creation/world-source';
import { sampleWildsBuildGround } from '../wilds-build-ground';
import { sealCollectedCard, canonicalPortableCardJson, sha256PortableBasis } from '../portable-card';

import {dispatchWildsClearanceWorkerExchange, projectWildsClearanceWorkerResult} from '@/lib/receiz/wilds-clearance-action-worker-engine';
export function startClearanceBrowserWorker(scope:Pick<DedicatedWorkerGlobalScope,'postMessage'|'addEventListener'>, database:WildzContinuityDatabase=createWildzContinuityDatabase({name:'wildz-disposable-clearance-browser-qa'})){
const HEAD='1'.repeat(64), sourceKey='qa:controlled-source';
const probe={proofReplays:0,codecCalls:0,actions:{} as Record<string,number[]>};
const checks:Record<string,unknown>={};
async function replay(j:WildsResourceJournalV128,who='alice.receiz.id',gameplay='explorer'){probe.proofReplays++;return replayWildsResourceJournalOwnerV128(j,who,gameplay,j.traces[who]?.commands??[]);}
type Held={state:WildsResourceJournalV128;head:string};
async function read(){const held=await database.read<Held>('meta',sourceKey);if(!held)throw Error('fixture_source_missing');return held;}
function compact(held:Held){return {state:{clearances:held.state.clearances,clearanceTaken:held.state.clearanceTaken},predecessor:{head:{head:held.head}},memberCount:Object.keys(held.state.looseMembers).length};}
async function save(state:WildsResourceJournalV128){const held={state,head:sha256PortableBasis(canonicalPortableCardJson(state)).slice(7)};await database.transaction(['meta'],'readwrite',tx=>tx.put('meta',held,sourceKey));return held;}
async function build(kind:string){
 await database.transaction(['meta'],'readwrite',async tx=>{for(const owner of ['bob','carol','racer_a','racer_b']){const key=`wildz:clearance-interaction:v1:${owner}.receiz.id:${owner}:qa-${owner}`;const old=await tx.get<{request:{kind:string;proposal?:{command:{commandId:string}}}}>('meta',key);if(old?.request.proposal)await tx.delete('meta','qa:outcome:'+old.request.proposal.command.commandId);await tx.delete('meta',key);}});

        let shared = initialWildsResourceJournalV128();
        let presentation: import("../wilds-world-state").WildsWorldProjection|null=null;
        const count = kind === 'many' ? 12 : 1;
        let primary = clearanceFixtureTree.position;
        if (kind === 'mountain') {
            primary = { x: -445.5, y: sampleWildsBuildGround(-445.5, -604).elevation, z: -604 };
        } /* canonical mountain shoreline */
        for (let i = 0; i < count; i++) {
            const gameplay = i ? 'neighbor' + i : 'explorer', who = i ? `neighbor${i}.receiz.id` : 'alice.receiz.id', p = { ...primary, x: primary.x + i * 14 };
            const setupStart = performance.now(), f = await paidClearanceTrace({ owner: gameplay, sourceOffset: i * 12, yaw:kind==='rotated'?Math.PI/4:0, width: kind === 'large' || kind === 'mountain' ? 18 : 6, compound: kind === 'large' || kind === 'mountain', harvests: kind === 'large' || kind === 'mountain' ? 75 : 12, foundation: kind === 'foundation', point: p });
            probe.proofReplays += f.commands.length;
            (probe.actions['fixture-setup'] ??= []).push(performance.now() - setupStart);
            const paid = { schema: 'wildz.resource-command.v128', kind: 'replay', attemptId: `paid:${who}`, ownerReceizId: who, gameplayOwnerId: gameplay, commands: f.commands } as const;
            const actionStart = performance.now();
            shared = await reduceWildsResourceJournalV128(shared, paid, { ownerReceizId: who, verifyCard: async () => { } });
            const deriveStart = performance.now(), command = await deriveWildsClearanceCommandV128({ state: shared, ownerReceizId: who, gameplayOwnerId: gameplay, commands: f.commands, buildingId: f.buildingId, buildingHead: f.buildingHead, kaiUPulse: f.kaiUPulse, expectedHead: HEAD, commandId: `clearance:${who}` });
            (probe.actions.derive ??= []).push(performance.now() - deriveStart);
            const event = { ...paid, attemptId: command.commandId, commands: [...f.commands, { kind: 'world', command, kaiUPulse: f.kaiUPulse }] } as const;
            const codecStart = performance.now();
            probe.codecCalls += 2;
            const encoded = await encodeWildsResourceEventV128(event), decoded = await decodeWildsResourceEventV128(encoded);
            (probe.actions.codec ??= []).push(performance.now() - codecStart);
            checks.codecExact = canonicalPortableCardJson(decoded) === canonicalPortableCardJson(event);
            checks.codecBytes = JSON.stringify(encoded).length;
            const reduceStart = performance.now();
            shared = await reduceWildsResourceJournalV128(shared, event, { ownerReceizId: who, expectedNativeHead: HEAD });
            (probe.actions['clearance-reduce'] ??= []).push(performance.now() - reduceStart);
            (probe.actions['paid-clearance-action'] ??= []).push(performance.now() - actionStart);
            presentation=mergeQualifiedWildsResourceWorldV128(presentation,(await replay(shared,who,gameplay)).world);
        }

 const held=await save(shared), projected=await replay(shared);
 checks.structures=count;checks.ground=sampleWildsBuildGround(primary.x,primary.z);
 return {current:compact(held),world:presentation??projected.world,point:primary,probe,checks};
}
async function transition(){const held=await read();
        const j = held.state, who = 'alice.receiz.id', trace = j.traces[who], projection = (await replay(j)).world, kaiUPulse = 100000600;
        let command;
        const component = Object.values(projection.constructionComponents)[0];
        if (component) {
            const request = { pointer: { ...component.transform.position, x: component.transform.position.x + .5 }, rotationQuarterTurns: 0, heightStep: 0, surfaceSnap: true, snapVersion: 2 as const, landscapeRule: 'wildz.build-ground.v2' as const }, preview = previewWildsConstructionAdjustment(projection, component.componentId, request);
            command = { type: 'construction.component.adjust' as const, componentId: component.componentId, componentHead: component.head, placement: preview.placement, request, actorPosition: component.transform.position, commandId: 'qa:adjust' };
        }
        else {
            const record = Object.values(projection.creations!)[0], old = record.command.definition, { digest: _digest, ...basis } = old, definition = createCreationDefinition({ ...basis, nodes: [...old.nodes, { ...old.nodes[0], id: 'bench-added', pose: { position: { x: 8, y: 0, z: 0 }, yaw: 0 }, shape: { kind: 'box' as const, width: 1, height: .3, depth: 1 } }] }), context = { ...record.command.context, sourceHead: creationWorldSourceHead(projection), evolution: { instanceId: record.instance.instanceId, head: record.instance.head, definition: old } }, compiled = compileCreation(definition, context);
            if (compiled.status !== 'ready')
                throw Error('qa_evolution_blocked');
            const resources = selectCreationResources(Object.values(projection.materialLots), context.budget, compiled.plan.requiredResources, creationWorldAvailability(projection, 'explorer'));
            command = { ...record.command, type: 'creation.evolve' as const, commandId: 'qa:evolve', expectedHead: record.instance.head, definition, context, planDigest: compiled.plan.digest, resources: resources.lots };
        }
        const event = { schema: 'wildz.resource-command.v128' as const, kind: 'replay' as const, attemptId: command.commandId, ownerReceizId: who, gameplayOwnerId: trace.gameplayOwnerId, commands: [...trace.commands, { kind: 'world' as const, command, kaiUPulse, workerOriginals: trace.commands.find(entry => entry.kind === 'world' && entry.command.type === 'creation.construct')?.kind === 'world' ? (trace.commands.find(entry => entry.kind === 'world' && entry.command.type === 'creation.construct') as Extract<typeof trace.commands[number], {
                        kind: 'world';
                    }>).workerOriginals : undefined }] };
        const next = await reduceWildsResourceJournalV128(j, event, { ownerReceizId: who, expectedNativeHead: held.head, verifyCard: async () => { } });
        checks.transition = command.type;
        checks.historyRetained = canonicalPortableCardJson(next.clearances) === canonicalPortableCardJson(j.clearances) && canonicalPortableCardJson(next.clearanceTaken ?? {}) === canonicalPortableCardJson(j.clearanceTaken ?? {});

 const saved=await save(next);return {current:compact(saved),world:(await replay(next)).world,probe,checks};
}
async function pickup(proposal:WildsClearancePickupProposalV128,beforeCommit:()=>Promise<void>){
 await beforeCommit();const held=await read();if(held.head!==proposal.command.expectedHead)return {status:'rejected' as const,attemptId:proposal.command.commandId,members:[],reason:'fixture CAS stale predecessor'};
 const before=held.state,id=proposal.command.commandId,event:WildsResourceJournalEventV128={schema:'wildz.resource-command.v128',kind:'use',attemptId:id,ownerReceizId:proposal.ownerReceizId,gameplayOwnerId:proposal.gameplayOwnerId,commands:[...(before.traces[proposal.ownerReceizId]?.commands??[]),{kind:'world',command:proposal.command,kaiUPulse:proposal.kaiUPulse}],useCommandId:id};
 const next=await reduceWildsResourceJournalV128(before,event,{ownerReceizId:proposal.ownerReceizId,expectedNativeHead:held.head}),projected=await replay(next,proposal.ownerReceizId,proposal.gameplayOwnerId),member=Object.values(next.looseMembers).find(row=>!before.looseMembers[row.member.id])!.member;
 const result={status:'admitted' as const,members:[member],projection:projected.world,nourishment:projected.nourishment};
 const newHead=sha256PortableBasis(canonicalPortableCardJson(next)).slice(7);
 return database.transaction(['meta'],'readwrite',async tx=>{if((await tx.get<Held>('meta',sourceKey))?.head!==held.head)return {status:'rejected' as const,attemptId:id,members:[],reason:'fixture CAS stale predecessor'};await tx.put('meta',{state:next,head:newHead},sourceKey);await tx.put('meta',result,'qa:outcome:'+id);return result;});
}
let nextCallbackId=0;
const callbacks=new Map<number,{resolve:()=>void;reject:(error:Error)=>void}>();
scope.addEventListener('message',(event:MessageEvent)=>{const data=event.data;if(data?.type==='callback-result'){const callback=callbacks.get(data.id);if(!callback)return;callbacks.delete(data.id);if(data.ok===true)callback.resolve();else callback.reject(Error(typeof data.error==='string'?data.error:'fixture_callback_rejected'));return;}if(data?.type!=='run')return;
 void(async()=>{const initial=data.initial as {op?:string;kind?:string};if(initial.op==='build')return build(initial.kind!);if(initial.op==='transition')return transition();
 const exchange={readCurrent:async()=>compact(await read()),deriveClearance:async()=>{throw Error('fixture_derive_unused');},admitClearancePickup:pickup,recoverClearance:async(id:string)=>database.read('meta','qa:outcome:'+id)};
 const beforeCommit=()=>new Promise<void>((resolve,reject)=>{const id=++nextCallbackId;callbacks.set(id,{resolve,reject});scope.postMessage({type:'callback',id,method:'beforeCommit',args:[]});});
 const result=await dispatchWildsClearanceWorkerExchange(exchange as unknown as Parameters<typeof dispatchWildsClearanceWorkerExchange>[0],data.method,data.args,beforeCommit);
 return {result:projectWildsClearanceWorkerResult(data.method,result),current:compact(await read()),probe};
 })().then(value=>scope.postMessage({type:'result',ok:true,value}),error=>scope.postMessage({type:'result',ok:false,error:error.message}));});

}
// Check a runtime worker API: Next substitutes typeof window in client bundles.
if(typeof self!=='undefined'&&typeof (self as unknown as {importScripts?:unknown}).importScripts==='function')startClearanceBrowserWorker(self as unknown as DedicatedWorkerGlobalScope);
