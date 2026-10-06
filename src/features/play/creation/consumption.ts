import { isPlayerBreaths, advancePlayerBreaths, recoverPlayerBreaths, type PlayerBreaths } from '../player-breath-energy';
import { assertCreationData } from './definition';
import type { CreationAuthorityContext } from './state';
import { verifyCreationResourceCustody, spendCreationResourceCustody, CREATION_RESOURCE_RULE_HEAD, CREATION_RESOURCE_RULES, type CreationResourceCustody } from './resource-registry';
import { sealConstructionProof, constructionProofDigest, validConstructionId, validConstructionHead, validConstructionKai } from '../wilds-construction-project';
export type CreationMetabolismSource = Readonly<{
    schema: 'wildz.creation-metabolism.v1';
    id: string;
    head: string;
    actorId: string;
    revision: number;
    parentHead: string | null;
    kaiUPulse: number;
    breaths: PlayerBreaths;
}>;
export type CreationConsumptionCommand = Readonly<{
    operationId: string;
    actorId: string;
    expectedPlayerHead: string;
    expectedResourceHead: string;
    actorHead: string;
    kaiUPulse: number;
    quantity: number;
}>;
export const CREATION_CONSUMPTION_RULE_ID = 'creation.produce-consumption.v1';
export const CREATION_CONSUMPTION_RULE_HEAD = constructionProofDigest({ id: CREATION_CONSUMPTION_RULE_ID, version: 1, resourceRule: CREATION_RESOURCE_RULE_HEAD, produceRecoveryBreaths: CREATION_RESOURCE_RULES.produceRecoveryBreaths, source: 'finite-produce-custody', clock: 'existing-kai-day', effect: 'bounded-reserve-and-exact-food-debit' });
/** Structural seal; this is not an admitted player or a source of free energy. */
export function sealCreationMetabolismSource(basis: Omit<CreationMetabolismSource, 'head'>): CreationMetabolismSource {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== 'actorId,breaths,id,kaiUPulse,parentHead,revision,schema' || basis.schema !== 'wildz.creation-metabolism.v1' || !validConstructionId(basis.actorId) || basis.id !== `metabolism:${basis.actorId}` || !Number.isSafeInteger(basis.revision) || basis.revision < 0 || (basis.revision === 0 ? basis.parentHead !== null : !validConstructionHead(basis.parentHead)) || !validConstructionKai(basis.kaiUPulse) || !isPlayerBreaths(basis.breaths) || !basis.breaths.clockRooted || basis.breaths.lastKaiUPulse !== basis.kaiUPulse)
        throw Error('creation_metabolism_source_invalid');
    return sealConstructionProof(basis);
}
export function verifyCreationMetabolismSource(value: unknown): value is CreationMetabolismSource {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationMetabolismSource;
        return head === sealCreationMetabolismSource(basis).head;
    }
    catch {
        return false;
    }
}
export type CreationConsumptionProposal = Readonly<{
    status: 'rejected';
    writes: 0;
    reason: string;
}> | Readonly<{
    status: 'proposed';
    player: CreationMetabolismSource;
    resource: CreationResourceCustody;
    restoredMicroBreaths: number;
    operationId: string;
}>;
/** Exact source-bound candidate. Food custody and metabolism must advance together on the Native rail. */
export function consumeCreationProduce(player: CreationMetabolismSource, resource: CreationResourceCustody, command: CreationConsumptionCommand, context: CreationAuthorityContext): CreationConsumptionProposal {
    const reject = (reason: string): CreationConsumptionProposal => ({ status: 'rejected', writes: 0, reason });
    try {
        assertCreationData(command);
        if (Object.keys(command).sort().join(',') !== 'actorHead,actorId,expectedPlayerHead,expectedResourceHead,kaiUPulse,operationId,quantity' || ![command.operationId, command.actorId].every(validConstructionId) || context.actorId !== command.actorId || !validConstructionKai(command.kaiUPulse) || !Number.isSafeInteger(command.quantity) || command.quantity < 1 || !validConstructionHead(command.actorHead) || !verifyCreationMetabolismSource(player) || player.actorId !== command.actorId || player.head !== command.expectedPlayerHead || command.kaiUPulse < player.kaiUPulse || !verifyCreationResourceCustody(resource) || resource.kind !== 'produce' || resource.ownerId !== command.actorId || resource.containerId !== null || resource.spent || resource.head !== command.expectedResourceHead || command.quantity > resource.quantity)
            return reject('creation_food_source_invalid');
        const required = [{ id: player.id, head: player.head, kind: 'player-metabolism' }, { id: resource.id, head: resource.head, kind: 'material' }, { id: `actor:${command.actorId}`, head: command.actorHead, kind: 'actor' }, { id: `rule:${CREATION_CONSUMPTION_RULE_ID}`, head: CREATION_CONSUMPTION_RULE_HEAD, kind: 'rule' }];
        if (new Set(context.sources.map(s => s.id)).size !== context.sources.length || context.rules[CREATION_CONSUMPTION_RULE_ID] !== CREATION_CONSUMPTION_RULE_HEAD || required.some(r => !context.sources.some(s => s.id === r.id && s.head === r.head && s.kind === r.kind && context.verifySource(s))))
            return reject('creation_food_authority_unverified');
        const elapsed = advancePlayerBreaths(player.breaths, command.kaiUPulse), recovered = recoverPlayerBreaths(elapsed, command.quantity * CREATION_RESOURCE_RULES.produceRecoveryBreaths), restoredMicroBreaths = recovered.reserveMicroBreaths - elapsed.reserveMicroBreaths;
        if (restoredMicroBreaths <= 0)
            return reject('creation_food_recovery_unneeded');
        const { head, ...basis } = player;
        return { status: 'proposed', operationId: command.operationId, restoredMicroBreaths, player: sealCreationMetabolismSource({ ...basis, parentHead: head, revision: player.revision + 1, kaiUPulse: command.kaiUPulse, breaths: recovered }), resource: spendCreationResourceCustody(resource, command.quantity, command.kaiUPulse) };
    }
    catch (error) {
        return reject(error instanceof Error ? error.message : 'creation_food_consumption_failed');
    }
}
