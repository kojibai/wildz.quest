import { proposeCreationAction, type CreationActionRequest } from './action-transition';
import { assertCreationData } from './definition';
import { initializeCreationComponents } from './components';
import { sealCreationInstance } from './instance';
import type { CreationState, CreationAuthorityContext, CreationTransition } from './state';
import { CREATION_GARDEN_RULE_HEAD, advanceCreationGarden, harvestCreationGarden, type CreationGardenState } from './garden';
import { CREATION_RESOURCE_RULE_HEAD, createCreationResourceCustody, verifyCreationResourceCustody, spendCreationResourceCustody, sealCreationResourceLot, type CreationResourceCustody } from './resource-registry';
import { constructionProofDigest, validConstructionId, freezeConstructionProof } from '../wilds-construction-project';
export type CreationGardenCommand = CreationActionRequest & Readonly<{
    nodeId: string;
}> & (Readonly<{
    action: 'care';
    inputs: readonly Readonly<{
        id: string;
        quantity: number;
    }>[];
}> | Readonly<{
    action: 'harvest';
    quantity: number;
    lotId: string;
}>);
export const CREATION_GARDEN_ACTION_RULE_ID = 'creation.garden.actions.v1';
export const CREATION_GARDEN_ACTION_RULE_HEAD = constructionProofDigest({ id: CREATION_GARDEN_ACTION_RULE_ID, version: 1, gardenRule: CREATION_GARDEN_RULE_HEAD, resourceRule: CREATION_RESOURCE_RULE_HEAD, maximumInputs: 32, custody: 'exact-finite-source-with-origin', harvest: 'causal-lot-genesis-and-garden-debit' });
/** A source-bound candidate. No resource or garden successor is usable before atomic admission. */
export function proposeCreationGardenAction(state: CreationState, command: CreationGardenCommand, context: CreationAuthorityContext): CreationTransition {
    const reject = (reason: string): CreationTransition => ({ status: 'rejected', state, writes: 0, reason });
    try {
        assertCreationData(command);
        const fields = ['operationId', 'action', 'actorId', 'instanceId', 'nodeId', 'kaiUPulse', 'expectedHeads', ...(command.action === 'care' ? ['inputs'] : ['quantity', 'lotId'])];
        if (!['care', 'harvest'].includes(command.action) || Object.keys(command).sort().join(',') !== fields.sort().join(',') || !validConstructionId(command.nodeId))
            return reject('creation_garden_command_invalid');
        if (!context.sources.some(s => s.id === `actor:${command.actorId}` && s.kind === 'actor' && s.head === command.expectedHeads[s.id] && context.verifySource(s)))
            return reject('creation_garden_actor_unverified');
        if (command.action === 'care' && (!Array.isArray(command.inputs) || !command.inputs.length || command.inputs.length > 32 || new Set(command.inputs.map(i => i.id)).size !== command.inputs.length || command.inputs.some(i => Object.keys(i).sort().join(',') !== 'id,quantity' || !validConstructionId(i.id) || !Number.isSafeInteger(i.quantity) || i.quantity < 1 || i.quantity > 256)))
            return reject('creation_garden_inputs_invalid');
        if (command.action === 'harvest' && (!validConstructionId(command.lotId) || !Number.isSafeInteger(command.quantity) || command.quantity < 1 || command.quantity > 256 || command.expectedHeads[command.lotId] !== null))
            return reject('creation_garden_harvest_invalid');
        const resources: Record<string, CreationResourceCustody> = {};
        const transition = proposeCreationAction(state, command, context, { id: CREATION_GARDEN_ACTION_RULE_ID, head: CREATION_GARDEN_ACTION_RULE_HEAD, genesisIds: command.action === 'harvest' ? [command.lotId] : [] }, command.action === 'harvest' ? 'harvest' : 'use', current => {
            const component = current.nodeStates[command.nodeId], definition = state.definitions[current.definitionDigest];
            const initialized = definition && initializeCreationComponents(definition, current.kaiUPulse)[command.nodeId];
            if (component?.kind !== 'garden' || component.condition <= 0 || initialized?.kind !== 'garden')
                throw Error('creation_garden_unavailable');
            let garden: CreationGardenState;
            if (command.action === 'care') {
                let seedUnits = 0, waterUnits = 0;
                for (const selected of command.inputs) {
                    const source = state.resources[selected.id];
                    if (!verifyCreationResourceCustody(source) || !['seed', 'water'].includes(source.kind) || source.spent || source.containerId !== null || source.ownerId !== command.actorId || state.custody[source.id] !== command.actorId || state.reservations[source.id] || source.head !== command.expectedHeads[source.id] || !context.sources.some(s => s.id === source.id && s.head === source.head && s.kind === 'material' && context.verifySource(s)))
                        throw Error('creation_garden_input_source_unavailable');
                    resources[source.id] = spendCreationResourceCustody(source, selected.quantity, command.kaiUPulse);
                    if (source.kind === 'seed')
                        seedUnits += selected.quantity;
                    else
                        waterUnits += selected.quantity;
                }
                garden = advanceCreationGarden(component, command.kaiUPulse, { seedUnits, waterUnits });
            }
            else {
                if (Object.hasOwn(state.resources, command.lotId) || Object.hasOwn(state.instances, command.lotId) || Object.hasOwn(state.custody, command.lotId) || Object.hasOwn(state.reservations, command.lotId))
                    throw Error('creation_garden_lot_exists');
                const grown = advanceCreationGarden(component, command.kaiUPulse, { seedUnits: 0, waterUnits: 0 }), harvested = harvestCreationGarden(grown, command.quantity);
                garden = harvested.garden;
                const lot = sealCreationResourceLot({ schema: 'wildz.creation-resource-lot.v1', id: command.lotId, kind: 'produce', quantity: harvested.quantity, ownerId: command.actorId, sourceId: current.instanceId, sourceHead: current.head, operationId: command.operationId, parentHeads: [current.head], kaiUPulse: command.kaiUPulse });
                resources[lot.id] = createCreationResourceCustody(lot);
            }
            const { head, ...basis } = current;
            return sealCreationInstance({ ...basis, revision: current.revision + 1, parentHead: head, kaiUPulse: command.kaiUPulse, nodeStates: { ...current.nodeStates, [command.nodeId]: { ...component, ...garden } } });
        });
        if (transition.status !== 'proposed' || !transition.successorSources.length)
            return transition;
        return { ...transition, state: freezeConstructionProof({ ...transition.state, resources: { ...transition.state.resources, ...resources }, custody: { ...transition.state.custody, ...Object.fromEntries(Object.values(resources).map(r => [r.id, r.ownerId])) } }), successorSources: [...transition.successorSources, ...Object.values(resources)] };
    }
    catch (error) {
        return reject(error instanceof Error ? error.message : 'creation_garden_action_failed');
    }
}
