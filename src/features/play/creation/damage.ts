import { proposeCreationAction, type CreationActionRequest } from './action-transition';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import { sealCreationInstance, type CreationNodeState } from './instance';
import { constructionProofDigest } from '../wilds-construction-project';
import { resolveCreationEquipmentAction, CREATION_EQUIPMENT_PROFILES, type CreationEquipmentActionRequest } from './equipment';
export const CREATION_DAMAGE_RULE_ID = 'creation.damage.v1';
export const CREATION_DAMAGE_RULE_HEAD = constructionProofDigest({ id: CREATION_DAMAGE_RULE_ID, salvageRate: .5, demolitionCondition: 100, profiles: CREATION_EQUIPMENT_PROFILES, occupiedTransition: 'requires-participant-relocation' });
export type CreationAttack = CreationActionRequest & Readonly<{
    action: 'demolish' | 'damage';
    nodeId: string;
    equipmentId?: string;
    equipment?: CreationEquipmentActionRequest;
}>;
export type CreationDamageResult = CreationTransition & Readonly<{
    salvage?: Readonly<Record<string, number>>;
}>;
/** This source proposal joins equipment wear, structure change and salvage in one admission.
 * Occupied/storage-bearing collapses fail closed until their participant transition is available. */
export function resolveCreationDamage(state: CreationState, attack: CreationAttack, context: CreationAuthorityContext): CreationDamageResult {
    let salvage: Record<string, number> = {}, weapon: ReturnType<typeof resolveCreationEquipmentAction> | undefined;
    const transition = proposeCreationAction(state, attack, context, { id: CREATION_DAMAGE_RULE_ID, head: CREATION_DAMAGE_RULE_HEAD }, 'demolish', current => {
        const target = current.nodeStates[attack.nodeId];
        if (!target || target.condition <= 0)
            throw Error('creation_damage_target_unavailable');
        let amount = 100;
        if (attack.action === 'demolish') {
            if (current.ownerId !== attack.actorId)
                throw Error('creation_demolition_owner_required');
        }
        else {
            if (attack.equipmentId === current.instanceId)
                throw Error('creation_damage_self_target_unavailable');
            const equipped = attack.equipmentId && state.instances[attack.equipmentId], request = attack.equipment;
            if (!equipped || !request || request.actionId !== attack.operationId || request.actorId !== attack.actorId || request.targetId !== current.instanceId || request.targetHead !== current.head || request.kaiUPulse !== attack.kaiUPulse || attack.expectedHeads[equipped.instanceId] !== equipped.head || !context.sources.some(s => s.id === equipped.instanceId && s.head === equipped.head && s.kind === 'creation' && context.verifySource(s)))
                throw Error('creation_damage_equipment_unverified');
            weapon = resolveCreationEquipmentAction(equipped, request);
            if (weapon.status !== 'proposed' || weapon.damage <= 0)
                throw Error('creation_damage_weapon_unavailable');
            amount = weapon.damage;
        }
        const nodes: Record<string, CreationNodeState> = { ...current.nodeStates, [target.nodeId]: { ...target, condition: Math.max(0, target.condition - amount) } };
        const definition = state.definitions[current.definitionDigest];
        if (!definition)
            throw Error('creation_damage_definition_missing');
        const affected = new Set<string>(nodes[target.nodeId].condition === 0 ? [target.nodeId] : []);
        // Reverse edges keep the collapse traversal linear in the changed dependency graph.
        const dependants = new Map<string, string[]>();
        for (const node of definition.nodes)
            for (const parent of [...node.supports, ...(node.parentId ? [node.parentId] : [])]) {
                const list = dependants.get(parent) || [];
                list.push(node.id);
                dependants.set(parent, list);
            }
        const queue = [...affected];
        for (let i = 0; i < queue.length; i++)
            for (const id of dependants.get(queue[i]) || []) {
                if (affected.has(id))
                    continue;
                affected.add(id);
                queue.push(id);
                nodes[id] = { ...nodes[id], condition: 0 };
            }
        for (const id of affected) {
            const n = nodes[id];
            if ((n.kind === 'bed' || n.kind === 'habitat') && n.occupantIds.length || n.kind === 'storage' && n.lotIds.length || n.kind === 'garden' && (n.planted || n.waterUnits || n.produce))
                throw Error('creation_collapse_participant_transition_required');
            if (n.kind === 'equipment')
                nodes[id] = { ...n, equippedBy: null, durability: 0 };
        }
        const destroyed = Object.values(nodes).every(n => n.condition === 0);
        if (destroyed) {
            const totals: Record<string, number> = {};
            for (const r of current.embeddedResources)
                totals[r.kind] = (totals[r.kind] || 0) + r.quantity;
            salvage = Object.fromEntries(Object.entries(totals).map(([kind, quantity]) => [kind, Math.floor(quantity / 2)]).filter(([, quantity]) => Number(quantity) > 0));
        }
        const { head, ...basis } = current;
        return sealCreationInstance({ ...basis, nodeStates: nodes, stage: destroyed ? 'destroyed' : current.stage, embeddedResources: destroyed ? [] : current.embeddedResources, revision: current.revision + 1, parentHead: head, kaiUPulse: attack.kaiUPulse });
    });
    if (transition.status !== 'proposed' || !transition.successorSources.length)
        return transition;
    if (weapon?.status === 'proposed') {
        const equipped = weapon.instance;
        return { ...transition, state: { ...transition.state, instances: { ...transition.state.instances, [equipped.instanceId]: equipped } }, successorSources: [...transition.successorSources, equipped], salvage };
    }
    return { ...transition, salvage };
}
