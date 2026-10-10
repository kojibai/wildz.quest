import { initializeCreationComponents } from './components';
import { sealCreationInstance, verifyCreationInstance, type CreationInstance } from './instance';
import { constructionProofDigest, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
import { proposeCreationAction, type CreationActionRequest } from './action-transition';
import {creationEquipmentAimOrigin,validCreationAim,validCreationPoint,type CreationAim} from './equipment-aim';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import type { CreationPoint } from './types';
import {CREATION_EQUIPMENT_PROFILES,CREATION_GEAR_PROFILES,CREATION_GEAR_PROFILE_HEAD,creationEquipmentProfile} from './equipment-profiles';
export {CREATION_EQUIPMENT_PROFILES,creationEquipmentProfile} from './equipment-profiles';
export const CREATION_EQUIPMENT_RULE_ID = 'creation.equipment.v1', CREATION_EQUIPMENT_RULE_HEAD = constructionProofDigest({ id: CREATION_EQUIPMENT_RULE_ID, profiles: CREATION_EQUIPMENT_PROFILES, slots: ['hand'], maximumMass: 25 });
export const CREATION_GEAR_EQUIPMENT_RULE_ID='creation.equipment.v2',CREATION_GEAR_EQUIPMENT_RULE_HEAD=constructionProofDigest({id:CREATION_GEAR_EQUIPMENT_RULE_ID,previous:CREATION_EQUIPMENT_RULE_HEAD,gear:CREATION_GEAR_PROFILE_HEAD});
export function creationEquipmentRule(profileId?:string){return profileId&&CREATION_GEAR_PROFILES[profileId]?{id:CREATION_GEAR_EQUIPMENT_RULE_ID,head:CREATION_GEAR_EQUIPMENT_RULE_HEAD}:{id:CREATION_EQUIPMENT_RULE_ID,head:CREATION_EQUIPMENT_RULE_HEAD};}
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
    const candidate=state.instances[command.instanceId]?.nodeStates[command.nodeId];
    return proposeCreationAction(state, command, context, creationEquipmentRule(candidate?.kind==='equipment'?candidate.actionProfileId:undefined), 'use', current => {
        const node = current.nodeStates[command.nodeId], definition = state.definitions[current.definitionDigest], fixed = definition && initializeCreationComponents(definition, command.kaiUPulse)[command.nodeId];
        if (!['equip', 'unequip'].includes(command.action) || !fixed || fixed.kind !== 'equipment' || node?.kind !== 'equipment' || fixed.capacity !== node.capacity || fixed.actionProfileId !== node.actionProfileId || fixed.capabilityId !== node.capabilityId || Math.abs(fixed.mass - node.mass) > 1e-8 || current.ownerId !== command.actorId || command.slot !== 'hand' || !node || node.kind !== 'equipment' || node.condition <= 0 || node.durability <= 0 || node.mass > 25 || !creationEquipmentProfile(node.actionProfileId))
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
    aim?: CreationAim;
    hitPosition?:CreationPoint;
}>;
export type CreationDischargeCommand=CreationActionRequest&Readonly<{action:'discharge'|'work';nodeId:string;equipment:CreationEquipmentActionRequest}>;
/** A miss still consumes real wear; it cannot fabricate target damage or resource yield. */
export function dischargeCreationEquipment(state:CreationState,command:CreationDischargeCommand,context:CreationAuthorityContext):CreationTransition {
 const node=state.instances[command.instanceId]?.nodeStates[command.nodeId];
 return proposeCreationAction(state,command,context,creationEquipmentRule(node?.kind==='equipment'?node.actionProfileId:undefined),'use',current=>{
  const held=currentCreationEquipment(current,command.actorId),profile=held&&creationEquipmentProfile(held.actionProfileId),request=command.equipment;
  if(!held||held.nodeId!==command.nodeId||!profile?.mode||command.action==='discharge'&&!['bow','rifle'].includes(profile.mode)||command.action==='work'&&profile.kind!=='tool'||request.actionId!==command.operationId||request.actorId!==command.actorId||request.targetId!==current.instanceId||request.targetHead!==current.head||request.expectedHead!==current.head||request.kaiUPulse!==command.kaiUPulse||command.action==='discharge'&&!validCreationAim(request.aim))throw Error('creation_equipment_discharge_invalid');
  const result=resolveCreationEquipmentAction(current,request);if(result.status!=='proposed')throw Error(result.reason);
  return result.instance;
 });
}
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
        const profile = creationEquipmentProfile(node.actionProfileId);
        if (!profile || node.equipmentKind !== profile.kind || node.lastActionKaiUPulse === undefined || node.lastActionId === request.actionId || node.durability < profile.wear || node.lastActionKaiUPulse > 0 && request.kaiUPulse - node.lastActionKaiUPulse < profile.recoveryKaiUPulse)
            return reject('creation_equipment_recovery_or_wear');
        if(request.hitPosition!==undefined&&!validCreationPoint(request.hitPosition))return reject('creation_equipment_target_out_of_range');
        const coordinates = [...Object.values(request.position), ...Object.values(request.targetPosition)];
        const origin=profile.mode&&request.hitPosition?creationEquipmentAimOrigin(request.position):request.position,target=profile.mode&&request.hitPosition?request.hitPosition:request.targetPosition;
        if (coordinates.length !== 6 || !coordinates.every(Number.isFinite) || !Object.values(target).every(Number.isFinite)||Math.hypot(origin.x-target.x,origin.y-target.y,origin.z-target.z)>profile.range+.00001)
            return reject('creation_equipment_target_out_of_range');
        const { head, ...basis } = instance, next = sealCreationInstance({ ...basis, nodeStates: { ...instance.nodeStates, [node.nodeId]: { ...node, durability: node.durability - profile.wear, lastActionKaiUPulse: request.kaiUPulse, lastActionId: request.actionId } }, revision: instance.revision + 1, parentHead: head, kaiUPulse: request.kaiUPulse });
        return { status: 'proposed', instance: next, damage: profile.damage, work: profile.work, targetId: request.targetId, targetHead: request.targetHead, actionId: request.actionId };
    }
    catch {
        return reject('creation_equipment_action_invalid');
    }
}
