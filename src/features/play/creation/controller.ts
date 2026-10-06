import { sealConstructionProof } from '../wilds-construction-project';
import type { CreationDefinition, CreationCommitResult, CreationInstanceRef } from './types';
import type { CreationPlan } from './compiler';
import type { CreationAdmissionPort, CreationAdmissionOutcome } from './operation';
import type { CreationCrewBatch } from './crew';
import type { CreationCrewJournal, CreationCrewAuthorize } from './scheduler';
import { createCreationScheduler } from './scheduler';
import { verifyCreationCrewBatch } from './crew';
import { createCreationPhysicalStore } from './physical-store';
import {verifyCurrentCreationSource,type CreationCurrentSource,type createCreationCurrentSourcePort} from './current-source';
import {verifyCreationPlan} from './compiler';
import {constructionProofDigest,validConstructionId} from '../wilds-construction-project';
export type CreationControllerInput = Readonly<{
    environment: () => Readonly<{
        ownerId: string;
        worldId: string;
        spaceId: string;
    }>;
    journal: CreationCrewJournal;
    authorize: CreationCrewAuthorize;
    createAdmission: (fence: () => Promise<boolean>) => CreationAdmissionPort;
    prepare: (definition: CreationDefinition, plan: CreationPlan, workerIds: readonly string[]) => Promise<CreationCrewBatch>;
    project: Parameters<typeof createCreationPhysicalStore>[0]['project'];
    canReplace?: Parameters<typeof createCreationPhysicalStore>[0]['canReplace'];
    currentSources?: ReturnType<typeof createCreationCurrentSourcePort>;
    /** Stages exact durable transaction bytes without executing. The execute adapter must use
     * the fence in its final Native dispatch callback and retain this operation ID for lookup. */
    prepareEvolution?: (input:Readonly<{definition:CreationDefinition;plan:CreationPlan;workerIds:readonly string[];source:CreationCurrentSource}>)=>Promise<Readonly<{operationId:string;execute:(fence:()=>Promise<boolean>)=>Promise<CreationCommitResult>}>>;
}>;
export type CreationController = ReturnType<typeof createCreationController>;
export function createCreationController(input: CreationControllerInput) {
    const physical = createCreationPhysicalStore({ project: input.project, canReplace: input.canReplace }), outcomes = new Map<string, CreationAdmissionOutcome>();
    let closed = false;
    const scheduler = createCreationScheduler({ journal: input.journal, authorize: async (batch) => {
            const bound = () => { const scope = input.environment(); return !closed && scope.ownerId === batch.operation.actorId && scope.worldId === batch.operation.command.instance.worldId && scope.spaceId === batch.operation.command.instance.spaceId; };
            if (!bound())
                return null;
            const evidence = await input.authorize(batch);
            return bound() ? evidence : null;
        }, createAdmission: fence => { const port = input.createAdmission(fence); return { async execute(operation) { const outcome = await port.execute(operation); outcomes.set(operation.operationId, outcome); return outcome; }, async lookup(id) { const outcome = await port.lookup(id); outcomes.set(id, outcome); return outcome; } }; } });
    const same = (scope: ReturnType<CreationControllerInput['environment']>) => !closed && JSON.stringify(input.environment()) === JSON.stringify(scope);
    async function finish(batch: CreationCrewBatch, plan: CreationPlan, scope: ReturnType<CreationControllerInput['environment']>): Promise<CreationCommitResult> {
        const result = await scheduler.run(batch);
        if (!same(scope))
            return { status: 'unknown', operationId: batch.operation.operationId };
        if (result.phase === 'cancelled')
            return { status: 'rejected', reason: 'The build was cancelled before admission.', writes: 0 };
        let outcome = outcomes.get(batch.operation.operationId);
        if (result.phase === 'admitted' && outcome?.status !== 'admitted')
            outcome = await input.createAdmission(async () => false).lookup(batch.operation.operationId);
        if (result.phase !== 'admitted' || outcome?.status !== 'admitted')
            return { status: 'unknown', operationId: batch.operation.operationId };
        if (!await physical.adopt(batch.operation, outcome, plan, () => same(scope)) || !same(scope))
            return { status: 'unknown', operationId: batch.operation.operationId };
        return { status: 'admitted', instance: outcome.instance };
    }
    async function evolve(definition:CreationDefinition,plan:CreationPlan,workerIds:readonly string[],selected:CreationInstanceRef):Promise<CreationCommitResult>{
        const reject=(reason:string):CreationCommitResult=>({status:'rejected',reason,writes:0});
        if(closed||!input.prepareEvolution||!input.currentSources)return reject('Evolving this object requires its current source and an authenticated evolution transaction. The selected object remains intact.');
        const scope=input.environment(),query={instanceId:selected.instanceId,worldId:scope.worldId,spaceId:scope.spaceId};
        const exact=(source:CreationCurrentSource)=>same(scope)&&source.instance.head===selected.head&&source.instance.definitionDigest===selected.definitionDigest&&source.instance.ownerId===scope.ownerId;
        let before:Awaited<ReturnType<typeof input.currentSources.read>>;
        try{before=await input.currentSources.read(query);}catch{return reject('The selected object could not be reopened.');}
        if(before.status!=='available'||!exact(before)||plan.worldId!==scope.worldId||plan.spaceId!==scope.spaceId||!verifyCreationPlan(plan)||plan.definitionDigest!==definition.digest||plan.evolution?.instanceId!==selected.instanceId||plan.evolution?.head!==selected.head||plan.evolution?.definitionDigest!==selected.definitionDigest||definition.creatorId!==before.instance.creatorId||definition.seed!==before.definition.seed||constructionProofDigest(plan.pose)!==constructionProofDigest(before.instance.pose)||!workerIds.length||workerIds.length>32||new Set(workerIds).size!==workerIds.length)return reject('The selected object or its placement changed. Reopen it before applying this edit.');
        let prepared:Awaited<ReturnType<NonNullable<CreationControllerInput['prepareEvolution']>>>;
        try{prepared=await input.prepareEvolution({definition,plan,workerIds:[...workerIds],source:before});}catch{return reject('Current sources, crew mandates and evolution admission must be verified before changing this object.');}
        if(!same(scope)||!validConstructionId(prepared.operationId))return reject('The creation account or transaction binding changed before dispatch.');
        const unknown=():CreationCommitResult=>({status:'unknown',operationId:prepared.operationId});
        const fence=async()=>{if(!same(scope))return false;const source=await input.currentSources!.read(query);return source.status==='available'&&exact(source)&&await verifyCurrentCreationSource(source)&&same(scope);};
        let result:CreationCommitResult;
        try{result=await prepared.execute(fence);}catch{return unknown();}
        if(result.status==='unknown')return unknown();
        if(result.status==='rejected')return result;
        if(!same(scope)||result.instance.instanceId!==selected.instanceId||result.instance.definitionDigest!==definition.digest)return unknown();
        try{
            const after=await input.currentSources.read(query);
            if(after.status!=='available'||!same(scope)||after.instance.head!==result.instance.head||after.instance.parentHead!==selected.head||after.instance.revision!==before.instance.revision+1||after.instance.creatorId!==before.instance.creatorId||after.instance.ownerId!==scope.ownerId||after.instance.definitionDigest!==definition.digest||after.planDigest!==plan.digest)return unknown();
            if(!await physical.adoptCurrent(after,plan,()=>same(scope))||!same(scope))return unknown();
            return {status:'admitted',instance:after.instance};
        }catch{return unknown();}
    }
    return { scope: input.environment, snapshot: physical.snapshot, subscribe: physical.subscribe,
        async hydrate(instanceId: string, plan: CreationPlan): Promise<boolean> {
            if (closed || !input.currentSources) return false;
            const scope = input.environment();
            const source = await input.currentSources.read({ instanceId, worldId: scope.worldId, spaceId: scope.spaceId });
            if (source.status !== 'available' || !same(scope)) return false;
            return physical.adoptCurrent(source, plan, () => same(scope));
        },
        async commit(definition: CreationDefinition, plan: CreationPlan, workerIds: readonly string[], selected?: CreationInstanceRef | null): Promise<CreationCommitResult> {
            if (selected)
                return evolve(definition,plan,workerIds,selected);
            const scope = input.environment();
            if (closed || scope.ownerId !== definition.creatorId || scope.worldId !== plan.worldId || scope.spaceId !== plan.spaceId)
                return { status: 'rejected', reason: 'Creation ownership or location changed.', writes: 0 };
            let batch: CreationCrewBatch;
            try {
                batch = await input.prepare(definition, plan, workerIds);
            }
            catch {
                return { status: 'rejected', reason: 'Current sources, crew mandates and world admission must be verified before building.', writes: 0 };
            }
            if (!same(scope) || !verifyCreationCrewBatch(batch) || batch.operation.definitionDigest !== definition.digest || batch.operation.planDigest !== plan.digest || batch.operation.actorId !== scope.ownerId || batch.operation.command.instance.worldId !== scope.worldId || batch.operation.command.instance.spaceId !== scope.spaceId)
                return { status: 'rejected', reason: 'The build source binding changed before dispatch.', writes: 0 };
            try {
                return await finish(batch, plan, scope);
            }
            catch {
                return { status: 'unknown', operationId: batch.operation.operationId };
            }
        }, async recover(batchId: string, plan: CreationPlan): Promise<CreationCommitResult> {
            const scope = input.environment(), batch = await input.journal.readBatch(batchId);
            if (!batch || batch.operation.actorId !== scope.ownerId || batch.operation.planDigest !== plan.digest)
                return { status: 'unknown', operationId: batchId };
            const { head, ...basis } = batch;
            void head;
            const original = sealConstructionProof({ ...basis, phase: 'prepared' as const, revision: 0 });
            return finish(original, plan, scope);
        }, close() { closed = true; physical.close(); outcomes.clear(); }
    };
}
