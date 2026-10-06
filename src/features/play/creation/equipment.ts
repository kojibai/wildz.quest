import { initializeCreationComponents } from './components';
import { sealCreationInstance, verifyCreationInstance, type CreationInstance } from './instance';
import { constructionProofDigest, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
import { proposeCreationAction, type CreationActionRequest } from './action-transition';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import type { CreationPoint } from './types';
export const CREATION_EQUIPMENT_PROFILES = Object.freeze({ 'creation.timber.tool.v1': { kind: 'tool', damage: 0, range: 2.5, recoveryKaiUPulse: 1000000, wear: 1, work: 1 }, 'creation.stone.tool.v1': { kind: 'tool', damage: 0, range: 2.5, recoveryKaiUPulse: 1000000, wear: 1, work: 2 }, 'creation.timber.weapon.v1': { kind: 'weapon', damage: 4, range: 2.5, recoveryKaiUPulse: 1000000, wear: 1, work: 0 }, 'creation.stone.weapon.v1': { kind: 'weapon', damage: 8, range: 2, recoveryKaiUPulse: 1500000, wear: 2, work: 0 } });
export const CREATION_EQUIPMENT_RULE_ID = 'creation.equipment.v1', CREATION_EQUIPMENT_RULE_HEAD = constructionProofDigest({ id: CREATION_EQUIPMENT_RULE_ID, profiles: CREATION_EQUIPMENT_PROFILES, slots: ['hand'], maximumMass: 25 });
export type CreationEquipCommand = CreationActionRequest & Readonly<{
    action: 'equip' | 'unequip';
    nodeId: string;
    slot: string;
}>;
export function currentCreationEquipment(instance: CreationInstance, actorId: string) {
    if (!verifyCreationInstance(instance) || instance.ownerId !== actorId || !['functional', 'finished'].includes(instance.stage))
        return null;
    const node = Object.values(instance.nodeStates).find(n => n.kind === 'equipment' && n.condition > 0 && n.durability > 0 && n.equippedBy === actorId);
    return node?.kind === 'equipment' ? node : null;
}
export function equipCreation(state: CreationState, command: CreationEquipCommand, context: CreationAuthorityContext): CreationTransition {
    return proposeCreationAction(state, command, context, { id: CREATION_EQUIPMENT_RULE_ID, head: CREATION_EQUIPMENT_RULE_HEAD }, 'use', current => {
        const node = current.nodeStates[command.nodeId], definition = state.definitions[current.definitionDigest], fixed = definition && initializeCreationComponents(definition, command.kaiUPulse)[command.nodeId];
        if (!['equip', 'unequip'].includes(command.action) || !fixed || fixed.kind !== 'equipment' || node?.kind !== 'equipment' || fixed.capacity !== node.capacity || fixed.actionProfileId !== node.actionProfileId || fixed.capabilityId !== node.capabilityId || Math.abs(fixed.mass - node.mass) > 1e-8 || current.ownerId !== command.actorId || command.slot !== 'hand' || !node || node.kind !== 'equipment' || node.condition <= 0 || node.durability <= 0 || node.mass > 25 || !Object.hasOwn(CREATION_EQUIPMENT_PROFILES, node.actionProfileId))
            throw Error('creation_equip_unavailable');
        const { head, ...basis } = current;
        const states = Object.fromEntries(Object.entries(current.nodeStates).map(([id, n]) => [id, n.kind === 'equipment' ? { ...n, equippedBy: id === command.nodeId && command.action === 'equip' ? command.actorId : null } : n]));
        return sealCreationInstance({ ...basis, nodeStates: states, revision: current.revision + 1, parentHead: head, kaiUPulse: command.kaiUPulse });
    });
}
export type CreationEquipmentActionRequest = Readonly<{
    actionId: string;
    actorId: string;
    expectedHead: string;
    targetId: string;
    targetHead: string;
    spaceId: string;
    position: CreationPoint;
    targetPosition: CreationPoint;
    kaiUPulse: number;
}>;
export type CreationEquipmentActionProposal = {
    status: 'rejected';
    reason: string;
    writes: 0;
} | {
    status: 'proposed';
    instance: CreationInstance;
    damage: number;
    work: number;
    targetId: string;
    targetHead: string;
    actionId: string;
};
/** Candidate effects only. Target authority, casualty and resource changes join the atomic action admission. */
export function resolveCreationEquipmentAction(instance: CreationInstance, request: CreationEquipmentActionRequest): CreationEquipmentActionProposal {
    const reject = (reason: string): CreationEquipmentActionProposal => ({ status: 'rejected', reason, writes: 0 });
    try {
        if (![request.actionId, request.actorId, request.targetId].every(validConstructionId) || !validConstructionHead(request.targetHead) || !validConstructionKai(request.kaiUPulse) || request.expectedHead !== instance.head || request.spaceId !== instance.spaceId || request.kaiUPulse < instance.kaiUPulse)
            return reject('creation_equipment_request_invalid');
        const node = currentCreationEquipment(instance, request.actorId);
        if (!node)
            return reject('creation_equipped_custody_unavailable');
        const profile = CREATION_EQUIPMENT_PROFILES[node.actionProfileId as keyof typeof CREATION_EQUIPMENT_PROFILES];
        if (!profile || node.equipmentKind !== profile.kind || node.lastActionKaiUPulse === undefined || node.lastActionId === request.actionId || node.durability < profile.wear || node.lastActionKaiUPulse > 0 && request.kaiUPulse - node.lastActionKaiUPulse < profile.recoveryKaiUPulse)
            return reject('creation_equipment_recovery_or_wear');
        const coordinates = [...Object.values(request.position), ...Object.values(request.targetPosition)];
        if (coordinates.length !== 6 || !coordinates.every(Number.isFinite) || Math.hypot(request.position.x - request.targetPosition.x, request.position.y - request.targetPosition.y, request.position.z - request.targetPosition.z) > profile.range)
            return reject('creation_equipment_target_out_of_range');
        const { head, ...basis } = instance, next = sealCreationInstance({ ...basis, nodeStates: { ...instance.nodeStates, [node.nodeId]: { ...node, durability: node.durability - profile.wear, lastActionKaiUPulse: request.kaiUPulse, lastActionId: request.actionId } }, revision: instance.revision + 1, parentHead: head, kaiUPulse: request.kaiUPulse });
        return { status: 'proposed', instance: next, damage: profile.damage, work: profile.work, targetId: request.targetId, targetHead: request.targetHead, actionId: request.actionId };
    }
    catch {
        return reject('creation_equipment_action_invalid');
    }
}
