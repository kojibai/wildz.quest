import { assertCreationData } from './definition';
import { constructionProofDigest, sealConstructionProof, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
export type CreationResourceLot = Readonly<{
    schema: 'wildz.creation-resource-lot.v1';
    id: string;
    head: string;
    kind: 'seed' | 'water' | 'produce';
    quantity: number;
    ownerId: string;
    sourceId: string;
    sourceHead: string;
    operationId: string;
    parentHeads: readonly string[];
    kaiUPulse: number;
}>;
export const CREATION_RESOURCE_RULES = Object.freeze({ schema: 'wildz.creation-resource-rules.v1', version: 1, maximumLotQuantity: 256, seedSourceCapacity: 16, waterSourceCapacity: 64, producePerSeed: 1, waterPerProduce: 1, produceRecoveryBreaths: 64 });
export const CREATION_RESOURCE_RULE_HEAD = constructionProofDigest(CREATION_RESOURCE_RULES);
export function sealCreationResourceLot(basis: Omit<CreationResourceLot, 'head'>): CreationResourceLot {
    assertCreationData(basis);
    if (Object.keys(basis).sort().join(',') !== ['schema', 'id', 'kind', 'quantity', 'ownerId', 'sourceId', 'sourceHead', 'operationId', 'parentHeads', 'kaiUPulse'].sort().join(',') || !Array.isArray(basis.parentHeads) || basis.schema !== 'wildz.creation-resource-lot.v1' || ![basis.id, basis.ownerId, basis.sourceId, basis.operationId].every(validConstructionId) || !['seed', 'water', 'produce'].includes(basis.kind) || !Number.isSafeInteger(basis.quantity) || basis.quantity < 1 || basis.quantity > 256 || !validConstructionHead(basis.sourceHead) || !validConstructionKai(basis.kaiUPulse) || basis.parentHeads.length < 1 || basis.parentHeads.length > 32 || new Set(basis.parentHeads).size !== basis.parentHeads.length || basis.parentHeads.some(h => !validConstructionHead(h)))
        throw Error('creation_resource_lot_invalid');
    return sealConstructionProof(basis);
}
/** Structural integrity only; enclosing source admission is verified separately. */
export function verifyCreationResourceLot(value: unknown): value is CreationResourceLot {
    try {
        assertCreationData(value);
        const { head, ...basis } = value as CreationResourceLot;
        return sealCreationResourceLot(basis).head === head;
    }
    catch {
        return false;
    }
}
