import { parseCreationDefinition } from './definition';
import { CREATION_MATERIALS } from './registry';
import { deriveCreationGeometry } from './geometry';
import { constructionProofDigest, freezeConstructionProof, validConstructionKai } from '../wilds-construction-project';
import type { CreationDefinition } from './types';
import type { CreationNodeState } from './instance';
import {creationEquipmentProfileId,CREATION_GEAR_PROFILE_HEAD,hasCreationGearProfile} from './equipment-profiles';
export const CREATION_COMPONENT_RULE_ID = 'creation.construct.components.v1';
export const CREATION_COMPONENT_RULE_HEAD = constructionProofDigest({ id: CREATION_COMPONENT_RULE_ID, version: 1, storageSlotsPerCubicMetre: 4, maximumSlots: 256, bedOccupants: 1, habitatMaximumOccupants: 8, equipmentProfiles: { timber: { durability: 120, massLimit: 25 }, stone: { durability: 180, massLimit: 25 } }, bedMinimumFootprint: [.7, 1.9], bedHeight: [.1, 1], habitatMinimumInterior: [.8, 1.8, .8], equipmentAssemblyMaximumMass: 25, garden: 'empty-input-conserved', logicLimit: 1, jointMaximumTravel: 3 });
export const CREATION_GEAR_COMPONENT_RULE_ID='creation.construct.components.v2';
export const CREATION_GEAR_COMPONENT_RULE_HEAD=constructionProofDigest({id:CREATION_GEAR_COMPONENT_RULE_ID,previous:CREATION_COMPONENT_RULE_HEAD,gear:CREATION_GEAR_PROFILE_HEAD});
export function creationComponentRuleForDefinition(definition:CreationDefinition){return hasCreationGearProfile(definition)?{id:CREATION_GEAR_COMPONENT_RULE_ID,head:CREATION_GEAR_COMPONENT_RULE_HEAD}:{id:CREATION_COMPONENT_RULE_ID,head:CREATION_COMPONENT_RULE_HEAD};}
/** Candidate initialization, not admission. Parameters cannot grant stats, contents or energy. */
export function initializeCreationComponents(input: CreationDefinition, kaiUPulse: number): Readonly<Record<string, CreationNodeState>> {
    const definition = parseCreationDefinition(input);
    if (!validConstructionKai(kaiUPulse))
        throw Error('creation_component_time_invalid');
    const nodes = new Set(definition.nodes.map(n => n.id)), output: Record<string, CreationNodeState> = {};
    const equipmentNodes = definition.nodes.filter(n => n.behaviors.some(b => b.id === 'tool' || b.id === 'weapon'));
    const assemblyMass = equipmentNodes.length ? definition.nodes.reduce((sum, node) => sum + deriveCreationGeometry(node, { position: { x: 0, y: 0, z: 0 }, yaw: 0 }).volume * (CREATION_MATERIALS[node.material]?.density || 0), 0) : 0;
    if (equipmentNodes.length && (equipmentNodes.length !== 1 || !Number.isFinite(assemblyMass) || assemblyMass <= 0 || assemblyMass > 25 || definition.nodes.some(n => n.behaviors.some(b => !['tool', 'weapon'].includes(b.id)))))
        throw Error('creation_equipment_assembly_mass_or_component_unavailable');
    for (const node of definition.nodes) {
        const common = { version: 1 as const, nodeId: node.id, condition: 100, supportIds: node.supports };
        if (!node.behaviors.length) {
            output[node.id] = { ...common, kind: 'condition' };
            continue;
        }
        if (node.behaviors.length !== 1)
            throw Error('creation_multiple_component_nodes_required');
        const behavior = node.behaviors[0], p = behavior.parameters, keys = Object.keys(p);
        if (behavior.version !== 1)
            throw Error('creation_component_law_unavailable');
        const allowed = behavior.id === 'joint' ? ['axis', 'travel'] : ['sensor', 'logic'].includes(behavior.id) ? ['target'] : ['tool','weapon'].includes(behavior.id)?['equipment']:[];
        if (keys.some(k => !allowed.includes(k)))
            throw Error('creation_component_parameter_unavailable');
        const volume = deriveCreationGeometry(node, { position: { x: 0, y: 0, z: 0 }, yaw: 0 }).volume;
        let state: CreationNodeState;
        switch (behavior.id) {
            case 'storage':
                state = { ...common, kind: 'storage', capacity: Math.max(1, Math.min(256, Math.floor(volume * 4))), lotIds: [] };
                break;
            case 'bed':
                if (node.shape.kind !== 'box' || Math.min(node.shape.width, node.shape.depth) < .7 || Math.max(node.shape.width, node.shape.depth) < 1.9 || node.shape.height < .1 || node.shape.height > 1)
                    throw Error('creation_bed_fit_unavailable');
                state = { ...common, kind: 'bed', capacity: 1, occupantIds: [] };
                break;
            case 'habitat': {
                const inset = (node.shape.thickness || .15) * 2;
                if (node.shape.kind !== 'shell' || node.shape.width - inset < .8 || node.shape.depth - inset < .8 || node.shape.height - inset < 1.8 || !node.shape.doorway || node.shape.doorway.width < .8 || node.shape.doorway.height < 1.8)
                    throw Error('creation_habitat_fit_unavailable');
                state = { ...common, kind: 'habitat', capacity: Math.max(1, Math.min(8, Math.floor((node.shape.width - inset) * (node.shape.depth - inset) / 2))), occupantIds: [] };
                break;
            }
            case 'tool':
            case 'weapon': {
                const mass = assemblyMass;
                if (!['timber', 'stone'].includes(node.material) || mass <= 0 || mass > 25)
                    throw Error('creation_equipment_material_or_mass_unavailable');
                const capacity = node.material === 'stone' ? 180 : 120;
                const actionProfileId=creationEquipmentProfileId(behavior.id,node.material,p.equipment);
                state = { ...common, kind: 'equipment', equipmentKind: behavior.id, capabilityId: p.equipment===undefined?`${behavior.id === 'tool' ? 'harvest' : 'strike'}.${node.material}.v1`:`${behavior.id==='tool'?'work':'shoot'}.${p.equipment}.v2`, durability: capacity, capacity, mass, actionProfileId, equippedBy: null, lastActionKaiUPulse: 0, lastActionId: null };
                break;
            }
            case 'garden':
                state = { ...common, kind: 'garden', planted: 0, waterUnits: 0, fertility: 50, produce: 0, lastGrowthKaiUPulse: kaiUPulse };
                break;
            case 'joint': {
                const travel = p.travel === undefined ? Math.min(1, node.shape.height) : p.travel;
                if (!Number.isFinite(travel) || typeof travel !== 'number' || travel <= 0 || travel > Math.min(3, Math.max(node.shape.width, node.shape.height, node.shape.depth)) || p.axis !== undefined && !['x', 'y', 'z'].includes(String(p.axis)))
                    throw Error('creation_component_parameter_invalid');
                state = { ...common, kind: 'joint', position: 0, minimum: 0, maximum: travel };
                break;
            }
            case 'sensor':
            case 'logic': {
                if (typeof p.target !== 'string' || !nodes.has(p.target) || p.target === node.id)
                    throw Error('creation_component_parameter_target_invalid');
                state = behavior.id === 'sensor' ? { ...common, kind: 'sensor', signal: false, targetIds: [p.target] } : { ...common, kind: 'logic', counter: 0, limit: 1, targetIds: [p.target], consumedEventIds: [] };
                break;
            }
            default: throw Error('creation_component_law_unavailable');
        }
        output[node.id] = state;
    }
    return freezeConstructionProof(output);
}
