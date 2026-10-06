import { proposeCreationAction, type CreationActionRequest } from './action-transition';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import type { CreationResourceSelection } from './resources';
import { constructionProofDigest, sealConstructionProof } from '../wilds-construction-project';
import { sealCreationInstance } from './instance';
import { CREATION_MATERIALS } from './registry';
export const CREATION_REPAIR_RULE_ID = 'creation.repair.v1', CREATION_REPAIR_RULE_HEAD = constructionProofDigest({ id: CREATION_REPAIR_RULE_ID, conditionPerUnit: 25, equipmentWearCapacityPerUnit: .25, materials: CREATION_MATERIALS });
export type CreationRepairCommand = CreationActionRequest & Readonly<{
    action: 'repair';
    nodeId: string;
    resources: CreationResourceSelection;
}>;
export function prepareCreationRepair(state: CreationState, command: CreationRepairCommand, context: CreationAuthorityContext): CreationTransition {
    const consumed: typeof command.resources.lots[number][] = [];
    const result = proposeCreationAction(state, command, context, { id: CREATION_REPAIR_RULE_ID, head: CREATION_REPAIR_RULE_HEAD, stages: ['functional', 'finished', 'destroyed'] }, 'edit', current => {
        if (current.ownerId !== command.actorId)
            throw Error('creation_repair_owner_required');
        const node = current.nodeStates[command.nodeId], definition = state.definitions[current.definitionDigest], shape = definition?.nodes.find(n => n.id === command.nodeId);
        if (!node || !shape || (node.condition >= 100 && (node.kind !== 'equipment' || node.durability >= node.capacity)) || !Object.hasOwn(CREATION_MATERIALS, shape.material) || Object.keys(command.resources.deficits).length || command.resources.lots.length > 256 || !command.resources.lots.length || new Set(command.resources.lots.map(l => l.id)).size !== command.resources.lots.length)
            throw Error('creation_repair_invalid');
        const required = Math.max(1, Math.ceil((100 - node.condition) / 25), node.kind === 'equipment' ? Math.ceil((node.capacity - node.durability) / Math.max(1, node.capacity / 4)) : 0);
        let paid = 0;
        for (const lot of command.resources.lots) {
            const source = state.resources[lot.id];
            if (lot.kind !== shape.material || !source || source.quantity !== lot.quantity || !Number.isSafeInteger(lot.quantity) || lot.quantity <= 0 || source.head !== lot.head || source.ownerId !== command.actorId || state.custody[lot.id] !== command.actorId || source.spent || state.reservations[lot.id] || current.embeddedResources.some(r => r.id === lot.id) || command.expectedHeads[lot.id] !== lot.head || !context.sources.some(s => s.id === lot.id && s.head === lot.head && context.verifySource(s)))
                throw Error('creation_repair_material_unavailable');
            paid += lot.quantity;
            consumed.push(lot);
        }
        if (paid !== required)
            throw Error('creation_repair_exact_material_required');
        const { head, ...basis } = current, nodeStates = { ...current.nodeStates, [node.nodeId]: node.kind === 'equipment' ? { ...node, condition: 100, durability: node.capacity } : { ...node, condition: 100 } };
        return sealCreationInstance({ ...basis, nodeStates, stage: current.stage === 'destroyed' ? 'functional' : current.stage, embeddedResources: [...current.embeddedResources, ...consumed], parentHead: head, revision: current.revision + 1, kaiUPulse: command.kaiUPulse });
    });
    if (result.status !== 'proposed' || !result.successorSources.length)
        return result;
    const resources = { ...result.state.resources };
    for (const lot of consumed) {
        const { head, ...basis } = resources[lot.id];
        resources[lot.id] = sealConstructionProof({ ...basis, spent: true, quantity: 0, parentHead: head, operationId: command.operationId });
    }
    return { ...result, state: { ...result.state, resources }, successorSources: [...result.successorSources, ...consumed.map(lot => resources[lot.id])] };
}
