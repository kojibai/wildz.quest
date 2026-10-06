import { constructionProofDigest, sealConstructionProof, validConstructionKai, validConstructionId } from '../wilds-construction-project';
import { sealCreationResourceLot, CREATION_RESOURCE_RULES, CREATION_RESOURCE_RULE_HEAD } from './resource-registry';
import type { CreationAuthorityContext } from './state';
export type CreationFiniteResourceSource = Readonly<{
    schema: 'wildz.creation-finite-resource-source.v1';
    id: string;
    head: string;
    parentHead: string | null;
    kind: 'seed' | 'water';
    worldId: string;
    spaceId: string;
    capacity: number;
    remaining: number;
    kaiUPulse: number;
}>;
export function extractCreationResource(source: CreationFiniteResourceSource, input: Readonly<{
    operationId: string;
    actorId: string;
    expectedHead: string;
    quantity: number;
    lotId: string;
    kaiUPulse: number;
}>, authority: CreationAuthorityContext) {
    if (Object.keys(source).sort().join(',') !== ['schema', 'id', 'head', 'parentHead', 'kind', 'worldId', 'spaceId', 'capacity', 'remaining', 'kaiUPulse'].sort().join(',') || source.schema !== 'wildz.creation-finite-resource-source.v1' || !['seed', 'water'].includes(source.kind) || ![source.id, source.worldId, source.spaceId, input.operationId, input.actorId, input.lotId].every(validConstructionId) || !Number.isSafeInteger(source.capacity) || source.capacity < 0 || source.capacity > (source.kind === 'seed' ? CREATION_RESOURCE_RULES.seedSourceCapacity : CREATION_RESOURCE_RULES.waterSourceCapacity) || !Number.isSafeInteger(source.remaining) || source.remaining < 0 || source.remaining > source.capacity || input.actorId !== authority.actorId || !Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > source.remaining || !validConstructionKai(input.kaiUPulse) || input.kaiUPulse < source.kaiUPulse || input.expectedHead !== source.head)
        throw Error('creation_resource_extraction_invalid');
    const { head, ...basis } = source;
    if (head !== constructionProofDigest(basis) || authority.rules['creation.resources.v1'] !== CREATION_RESOURCE_RULE_HEAD || !authority.sources.some(s => s.id === source.id && s.head === head && s.kind === 'resource-source' && authority.verifySource(s)) || !authority.sources.some(s => s.id === 'rule:creation.resources.v1' && s.head === CREATION_RESOURCE_RULE_HEAD && s.kind === 'rule' && authority.verifySource(s)) || !authority.sources.some(s => s.id === `actor:${input.actorId}` && s.kind === 'actor' && authority.verifySource(s)))
        throw Error('creation_resource_source_unverified');
    const next = sealConstructionProof({ ...basis, parentHead: head, remaining: source.remaining - input.quantity, kaiUPulse: input.kaiUPulse }), lot = sealCreationResourceLot({ schema: 'wildz.creation-resource-lot.v1', id: input.lotId, kind: source.kind, quantity: input.quantity, ownerId: input.actorId, sourceId: source.id, sourceHead: head, operationId: input.operationId, parentHeads: [head], kaiUPulse: input.kaiUPulse });
    return { status: 'proposed' as const, source: next, lot };
}
